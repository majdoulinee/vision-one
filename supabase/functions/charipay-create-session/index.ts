// charipay-create-session -- Edge Function (Deno / Supabase)
//
// Nouvelle fonctionnalite paiement en ligne (hors audit Agridata) : permet
// a l'owner d'une organisation de payer un pack de credits par carte via
// ChariPay (https://charipay.ma), en plus du circuit existant demande +
// virement + octroi manuel admin (voir app.credits.tsx).
//
// Le client envoie seulement org_id et pack. Le prix et le nombre de
// credits ne sont jamais acceptes depuis la requete : ils sont relus dans
// la table PACKS ci-dessous, cote serveur.
//
// La cle secrete ChariPay (CHARIPAY_API_KEY) ne quitte jamais cette
// fonction : le navigateur ne recoit que l'URL de paiement hebergee.
//
// Cette fonction ne credite JAMAIS le wallet elle-meme. Elle cree la
// session ChariPay et la ligne payment_sessions a l'etat en_attente. Seule
// la fonction charipay-webhook (confirmation signee) credite les credits.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PACKS = {
  starter: { credits: 10, mad: 1000 },
  pro: { credits: 50, mad: 4500 },
  enterprise: { credits: 200, mad: 16000 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing_authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const CHARIPAY_API_KEY = Deno.env.get("CHARIPAY_API_KEY");
    const CHARIPAY_API_BASE_URL = Deno.env.get("CHARIPAY_API_BASE_URL") || "https://api-psp.charipay.ma";
    const SITE_URL = Deno.env.get("SITE_URL");

    if (!CHARIPAY_API_KEY) {
      return json({ error: "charipay_not_configured", message: "CHARIPAY_API_KEY manquant (secret Supabase)." }, 500);
    }
    if (!SITE_URL) {
      return json({ error: "site_url_not_configured", message: "SITE_URL manquant (secret Supabase)." }, 500);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData || !userData.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const orgId = typeof body.org_id === "string" ? body.org_id : null;
    const packCode = typeof body.pack === "string" ? body.pack : null;
    const phone = typeof body.phone === "string" ? body.phone : null;
    if (!orgId || !packCode) return json({ error: "missing_params" }, 400);
    const pack = PACKS[packCode];
    if (!pack) {
      return json({ error: "unknown_pack", message: "Pack inconnu: " + packCode }, 400);
    }

    const { data: membership, error: memErr } = await userClient
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership || membership.role !== "owner") {
      return json({ error: "forbidden", message: "Seul le owner de l'organisation peut payer en ligne." }, 403);
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const fullName = (profile && profile.full_name ? profile.full_name : "").trim();
    const nameParts = fullName ? fullName.split(" ").filter(Boolean) : [];
    const firstName = nameParts[0] || "Client";
    const lastName = nameParts.slice(1).join(" ") || "Vision One";
    const email = (profile && profile.email) || user.email;
    if (!email) {
      return json({ error: "missing_email", message: "Aucun e-mail associe a ce compte." }, 400);
    }

    const { data: session, error: insErr } = await userClient
      .from("payment_sessions")
      .insert({
        org_id: orgId,
        demandeur_id: user.id,
        pack: packCode,
        credits: pack.credits,
        montant_mad: pack.mad,
        provider: "charipay",
        statut: "en_attente",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    const sessionId = session.id;

    const acceptUrl = SITE_URL + "/app/credits/retour?session=" + sessionId + "&result=success";
    const declineUrl = SITE_URL + "/app/credits/retour?session=" + sessionId + "&result=cancel";

    let chariRes;
    try {
      chariRes = await fetch(CHARIPAY_API_BASE_URL + "/v1/payment-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CHARI-PAY-API-KEY": CHARIPAY_API_KEY,
          "Idempotency-Key": sessionId,
        },
        body: JSON.stringify({
          amount: pack.mad,
          orderId: sessionId,
          singleUse: true,
          externalId: sessionId,
          config: {
            customer: { email, firstName, lastName, phone: phone || "+212600000000" },
            urls: { accept: acceptUrl, decline: declineUrl, externalReference: sessionId },
            frontend: { companyName: "Vision One" },
          },
          metadata: { org_id: orgId, pack: packCode, session_id: sessionId },
          notifyOnFailure: true,
        }),
      });
    } catch (fetchErr) {
      await admin.from("payment_sessions").update({ statut: "echouee", raw_create: { fetch_error: String(fetchErr) } }).eq("id", sessionId);
      throw fetchErr;
    }

    const chariBody = await chariRes.json().catch(() => null);
    if (!chariRes.ok) {
      await admin.from("payment_sessions").update({ statut: "echouee", raw_create: chariBody }).eq("id", sessionId);
      return json({ error: "charipay_error", message: (chariBody && chariBody.error && chariBody.error.message) || ("HTTP " + chariRes.status), details: chariBody }, 502);
    }

    const checkoutUrl = chariBody && chariBody.checkoutUrl;
    const providerSessionId = (chariBody && chariBody.sessionId) || null;
    if (!checkoutUrl) {
      await admin.from("payment_sessions").update({ statut: "echouee", raw_create: chariBody }).eq("id", sessionId);
      return json({ error: "charipay_no_checkout_url", details: chariBody }, 502);
    }

    await admin.from("payment_sessions").update({
      provider_session_id: providerSessionId,
      checkout_url: checkoutUrl,
      raw_create: chariBody,
    }).eq("id", sessionId);

    return json({ sessionId, checkoutUrl });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
