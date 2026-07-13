import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { invitationId: string };

function inviteHtml(params: {
  orgName: string;
  role: string;
  link: string;
  expiresAt: string;
  inviterName: string | null;
}) {
  const { orgName, role, link, expiresAt, inviterName } = params;
  const expires = new Date(expiresAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return `<!doctype html>
<html><body style="margin:0;background:#f3ecdf;font-family:Georgia,'Times New Roman',serif;color:#1b1a17;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3ecdf;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#faf5ea;border:1px solid #d8ceb8;">
        <tr><td style="padding:32px 40px 8px 40px;">
          <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.2em;color:#a04a1f;text-transform:uppercase;">Vision One</div>
          <h1 style="margin:12px 0 0 0;font-size:26px;font-weight:700;line-height:1.2;color:#1b1a17;">Vous êtes invité à rejoindre ${escapeHtml(orgName)}</h1>
        </td></tr>
        <tr><td style="padding:12px 40px 8px 40px;font-size:15px;line-height:1.55;color:#3a3833;">
          ${inviterName ? `<p><strong>${escapeHtml(inviterName)}</strong> vous invite à collaborer sur Vision One en tant que <strong>${escapeHtml(role)}</strong>.</p>` : `<p>Vous êtes invité à rejoindre <strong>${escapeHtml(orgName)}</strong> en tant que <strong>${escapeHtml(role)}</strong>.</p>`}
          <p>Vision One est la plateforme de planification financière agricole vérifiable — pré‑faisabilité, budget de campagne, business plan bancable.</p>
        </td></tr>
        <tr><td style="padding:16px 40px 8px 40px;">
          <a href="${link}" style="display:inline-block;background:#a04a1f;color:#faf5ea;padding:14px 24px;text-decoration:none;font-weight:600;font-family:Helvetica,Arial,sans-serif;font-size:15px;">Accepter l'invitation →</a>
        </td></tr>
        <tr><td style="padding:8px 40px 24px 40px;font-size:12px;color:#6b675f;line-height:1.5;">
          <p style="margin:0 0 6px 0;">Ou copiez ce lien dans votre navigateur :<br/><span style="word-break:break-all;color:#3a3833;">${link}</span></p>
          <p style="margin:12px 0 0 0;">Cette invitation expire le <strong>${expires}</strong>.</p>
        </td></tr>
        <tr><td style="padding:16px 40px 24px 40px;border-top:1px solid #e6dcc7;font-size:11px;color:#8b8578;font-family:Helvetica,Arial,sans-serif;">
          Vision One — Planification agricole vérifiable
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c] as string);
}

export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load invitation + org + inviter, scoped by RLS (caller must be member).
    const { data: inv, error: invErr } = await supabase
      .from("invitations")
      .select("id, email, role, token, org_id, expires_at, accepted_at")
      .eq("id", data.invitationId)
      .maybeSingle();
    if (invErr) throw new Error(invErr.message);
    if (!inv) throw new Error("Invitation introuvable");
    if (inv.accepted_at) throw new Error("Invitation déjà acceptée");

    // Only owners/admins may (re)send.
    const { data: role, error: roleErr } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", inv.org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!role || (role.role !== "owner" && role.role !== "admin")) {
      throw new Error("Non autorisé");
    }

    const [{ data: org }, { data: inviter }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", inv.org_id).maybeSingle(),
      supabase.from("profiles").select("full_name,email").eq("id", userId).maybeSingle(),
    ]);

    const origin = process.env.SITE_URL || "https://vision-one.lovable.app";
    const link = `${origin.replace(/\/$/, "")}/invite/${inv.token}`;

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return { sent: false, link, reason: "RESEND_API_KEY missing" };
    }
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

    const html = inviteHtml({
      orgName: org?.name ?? "Vision One",
      role: inv.role,
      link,
      expiresAt: inv.expires_at,
      inviterName: inviter?.full_name ?? inviter?.email ?? null,
    });

    // Prefer the Lovable gateway (Resend connector). Fall back to the direct
    // Resend API when the connector is not linked.
    const useGateway = Boolean(LOVABLE_API_KEY);
    const url = useGateway
      ? "https://connector-gateway.lovable.dev/resend/emails"
      : "https://api.resend.com/emails";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (useGateway) {
      headers["Authorization"] = `Bearer ${LOVABLE_API_KEY}`;
      headers["X-Connection-Api-Key"] = RESEND_API_KEY;
    } else {
      headers["Authorization"] = `Bearer ${RESEND_API_KEY}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Vision One <onboarding@resend.dev>",
        to: [inv.email],
        subject: `Invitation à rejoindre ${org?.name ?? "Vision One"}`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { sent: false, link, reason: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }

    // Audit log (best-effort).
    await supabase.from("audit_log").insert({
      org_id: inv.org_id,
      user_id: userId,
      action: "invitation.email_sent",
      target: inv.id,
      metadata: { email: inv.email },
    } as never).then(() => undefined, () => undefined);

    return { sent: true, link };
  });