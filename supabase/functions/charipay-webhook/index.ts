// charipay-webhook -- Edge Function (Deno / Supabase)
//
// Recoit les evenements webhook ChariPay (paiement confirme / echoue) pour
// les sessions de paiement de packs de credits en ligne. C'est la SEULE
// source de verite pour crediter un wallet suite a un paiement en ligne --
// jamais la redirection navigateur (doc ChariPay : la confirmation arrive
// par webhook, c'est la source de verite).
//
// Verification de signature (doc charipay.ma/fr/api-docs) :
//   - En-tetes: X-CHARI-SIGNATURE, X-CHARI-TIMESTAMP, X-CHARI-SIGNATURE-NEXT
//     (ce dernier uniquement pendant une rotation de secret).
//   - Algorithme: HMAC-SHA256 hexadecimal minuscule, calcule sur la chaine
//     TIMESTAMP.CORPS_BRUT (corps NON reparse), avec le secret de signature
//     obtenu a l'enregistrement de l'endpoint webhook (POST
//     /api/v1/partner/webhooks/endpoints, champ signingSecret, montre une
//     seule fois).
//   - Tolerance d'horloge : 5 minutes. Comparaison en temps constant.
//
// Deduplication : ChariPay peut livrer plusieurs fois le meme evenement
// avec des Chari-Webhook-Id differents mais le meme Chari-Event-Id -- on
// deduplique donc sur ce dernier (table payment_webhook_events, PK event_id).
//
// IMPORTANT (a verifier des la creation du compte sandbox ChariPay) : la
// doc publique ne publie pas le schema exact du corps JSON delivre au
// webhook. Ce code cherche la reference de session (notre
// payment_sessions.id, envoye comme orderId / externalId / urls.externalReference
// a la creation) a plusieurs emplacements plausibles dans extractSessionId().
// Utilise le bouton Send a test event du portail sandbox ChariPay pour voir
// un vrai payload et ajuster cette fonction si besoin -- c'est le seul
// endroit a corriger le cas echeant.

import { createClient } from "npm:@supabase/supabase-js@2";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function extractSessionId(payload) {
  const data = (payload && payload.data) || payload;
  return (
    (data && data.orderId) ||
    (data && data.externalId) ||
    (data && data.externalReference) ||
    (data && data.ExternalId) ||
    (payload && payload.orderId) ||
    (payload && payload.externalId) ||
    null
  );
}

function extractProviderSessionId(payload) {
  const data = (payload && payload.data) || payload;
  return (data && data.sessionId) || (payload && payload.sessionId) || null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rawBody = await req.text();

  const signature = req.headers.get("x-chari-signature");
  const signatureNext = req.headers.get("x-chari-signature-next");
  const timestamp = req.headers.get("x-chari-timestamp");
  const eventIdHeader = req.headers.get("chari-event-id");
  const eventTypeHeader = req.headers.get("chari-event-type");

  const WEBHOOK_SECRET = Deno.env.get("CHARIPAY_WEBHOOK_SECRET");
  const WEBHOOK_SECRET_NEXT = Deno.env.get("CHARIPAY_WEBHOOK_SECRET_NEXT");

  if (!WEBHOOK_SECRET) {
    console.error("CHARIPAY_WEBHOOK_SECRET manquant (secret Supabase).");
    return json({ error: "webhook_not_configured" }, 500);
  }
  if (!signature || !timestamp) {
    return json({ error: "missing_signature" }, 401);
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
    return json({ error: "timestamp_out_of_range" }, 401);
  }

  const signedMessage = timestamp + "." + rawBody;
  const expected = await hmacHex(WEBHOOK_SECRET, signedMessage);
  let valid = /^[0-9a-f]{64}$/i.test(signature) && timingSafeEqualHex(expected, signature.toLowerCase());

  if (!valid && WEBHOOK_SECRET_NEXT && signatureNext) {
    const expectedNext = await hmacHex(WEBHOOK_SECRET_NEXT, signedMessage);
    valid = /^[0-9a-f]{64}$/i.test(signatureNext) && timingSafeEqualHex(expectedNext, signatureNext.toLowerCase());
  }

  if (!valid) {
    console.error("Signature ChariPay invalide ou expiree.");
    return json({ error: "invalid_signature" }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return json({ error: "invalid_json" }, 400);
  }

  const eventType = eventTypeHeader || payload.eventType || payload.type || null;
  const eventId = eventIdHeader || payload.eventId || payload.id || null;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (eventId) {
    const { error: dedupErr } = await admin
      .from("payment_webhook_events")
      .insert({ event_id: eventId, event_type: eventType || "unknown", payload });
    if (dedupErr) {
      const alreadySeen = dedupErr.code === "23505" || String(dedupErr.message).toLowerCase().indexOf("duplicate") !== -1;
      if (alreadySeen) {
        return json({ ok: true, deduped: true });
      }
      console.error("Echec insertion payment_webhook_events (on continue quand meme)", dedupErr);
    }
  }

  const sessionId = extractSessionId(payload);
  const providerSessionId = extractProviderSessionId(payload);

  if (!sessionId) {
    console.error("Webhook ChariPay recu sans reference de session exploitable", payload);
    return json({ ok: true, warning: "no_session_reference" });
  }

  try {
    if (eventType === "payment.succeeded" || eventType === "order.paid") {
      const { error } = await admin.rpc("charipay_mark_paid", {
        p_session_id: sessionId,
        p_provider_session_id: providerSessionId,
        p_raw: payload,
      });
      if (error) throw error;
    } else if (eventType === "payment.failed") {
      const { error } = await admin.rpc("charipay_mark_failed", {
        p_session_id: sessionId,
        p_provider_session_id: providerSessionId,
        p_raw: payload,
      });
      if (error) throw error;
    }
    return json({ ok: true });
  } catch (e) {
    console.error("Erreur traitement webhook ChariPay", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
