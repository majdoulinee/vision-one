import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendInvitationEmail } from "@/lib/invitations.functions";
import { formatError } from "@/lib/format-error";
import { type OrgRole } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/**
 * Formulaire d'invitation (email + rôle), extrait de settings.tsx pour être
 * réutilisé tel quel par l'écran 6 de l'onboarding (§7), avec un choix de
 * rôles restreint (member/viewer) plutôt que la liste complète.
 */
export function InviteMemberForm({
  orgId,
  allowedRoles,
  defaultRole,
  onSent,
  submitLabel,
}: {
  orgId: string;
  allowedRoles: OrgRole[];
  defaultRole?: OrgRole;
  onSent?: () => void;
  submitLabel?: string;
}) {
  const { t } = useTranslation();
  const sendEmail = useServerFn(sendInvitationEmail);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>(defaultRole ?? allowedRoles[0]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");
      const token = crypto.randomUUID().replace(/-/g, "");
      const invEmail = email.toLowerCase();
      const { data: inv, error } = await supabase
        .from("invitations")
        .insert({
          org_id: orgId,
          email: invEmail,
          role,
          token,
          invited_by: authUser.id,
          expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      const result = await sendEmail({ data: { invitationId: inv.id } });
      const link = `${window.location.origin}/invite/${token}`;
      if (result?.sent) {
        toast.success(t("settings.emailSent", { email: invEmail }));
      } else {
        await navigator.clipboard.writeText(link).catch(() => undefined);
        toast.warning(t("settings.emailFailed") + ` — ${link}`);
      }
      setEmail("");
      onSent?.();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1 space-y-1">
        <Label htmlFor="inviteEmail">{t("settings.email")}</Label>
        <Input
          id="inviteEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="inviteRole">{t("settings.role")}</Label>
        <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
          <SelectTrigger id="inviteRole" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedRoles.map((r) => (
              <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={busy}>
        {submitLabel ?? t("settings.sendInvite")}
      </Button>
    </form>
  );
}
