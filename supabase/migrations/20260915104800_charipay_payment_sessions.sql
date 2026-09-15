-- Intégration ChariPay (paiement en ligne des packs de crédits) — version démo.
-- Nouvelle fonctionnalité (hors audit Agridata / hors Lot 3) : permet de payer
-- un pack de crédits en ligne par carte via ChariPay (https://charipay.ma),
-- en plus du circuit existant "demande + virement + octroi manuel admin".
--
-- Principe : la confirmation de paiement fait foi uniquement via webhook
-- signé ChariPay (jamais via la redirection navigateur, cf doc ChariPay :
-- "the result reaches you by webhook, and it's the source of truth").
-- Le crédit du wallet passe par une fonction SECURITY DEFINER dédiée,
-- exécutable uniquement par le rôle service_role (utilisé par l'Edge
-- Function webhook), jamais par un utilisateur authentifié — même logique
-- de verrouillage que consume_credits/refund_credits/grant_credits (VO-22).

CREATE TABLE public.payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  demandeur_id uuid NOT NULL REFERENCES auth.users(id),
  pack text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  montant_mad numeric NOT NULL CHECK (montant_mad > 0),
  provider text NOT NULL DEFAULT 'charipay',
  provider_session_id text,
  checkout_url text,
  statut text NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','payee','echouee','expiree','annulee')),
  raw_create jsonb,
  raw_webhook jsonb,
  ledger_id uuid REFERENCES public.credit_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_sessions_provider_session_id_key
  ON public.payment_sessions (provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE INDEX payment_sessions_org_id_idx ON public.payment_sessions (org_id);

ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- Lecture : membre de l'org ou admin plateforme (même règle que credit_requests).
CREATE POLICY payment_sessions_select_org_or_admin
  ON public.payment_sessions FOR SELECT TO authenticated
  USING (is_org_member(org_id) OR has_platform_role('admin'::platform_role));

-- Création : uniquement le owner de l'org, pour lui-même (même règle que credit_requests).
CREATE POLICY payment_sessions_owner_insert
  ON public.payment_sessions FOR INSERT TO authenticated
  WITH CHECK (has_org_role(org_id, ARRAY['owner'::org_role]) AND demandeur_id = auth.uid());

-- Volontairement aucune policy UPDATE/DELETE pour authenticated : seul le
-- service_role (Edge Function webhook, qui contourne la RLS) peut faire
-- transitionner le statut, via les fonctions ci-dessous.

-- Déduplication des évènements webhook ChariPay (Chari-Event-Id) : un même
-- évènement peut être livré plusieurs fois (retries) avec des Chari-Webhook-Id
-- différents mais le même Chari-Event-Id — cf doc ChariPay.
CREATE TABLE public.payment_webhook_events (
  event_id uuid PRIMARY KEY,
  provider text NOT NULL DEFAULT 'charipay',
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
-- Aucune policy : ni anon ni authenticated n'ont accès, seul service_role
-- (qui contourne la RLS) lit/écrit cette table technique.

CREATE OR REPLACE FUNCTION public.charipay_mark_paid(
  p_session_id uuid,
  p_provider_session_id text,
  p_raw jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.payment_sessions%ROWTYPE;
  v_new int;
  v_entry uuid;
BEGIN
  SELECT * INTO r FROM public.payment_sessions WHERE id = p_session_id FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'payment_session_not_found:%', p_session_id;
  END IF;
  IF r.statut = 'payee' THEN
    RETURN r.ledger_id; -- idempotent : rejeu webhook déjà traité
  END IF;
  IF r.statut <> 'en_attente' THEN
    RAISE EXCEPTION 'payment_session_not_pending:%', r.statut;
  END IF;

  PERFORM set_config('app.allow_credit_mutation', 'on', true);
  UPDATE public.wallets SET credits = credits + r.credits, updated_at = now()
    WHERE org_id = r.org_id RETURNING credits INTO v_new;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'wallet_not_found:%', r.org_id;
  END IF;

  INSERT INTO public.credit_ledger(org_id, delta, solde_apres, type, ref_id, auteur_id, motif)
    VALUES (r.org_id, r.credits, v_new, 'achat_en_ligne', r.id, r.demandeur_id,
            'Achat en ligne ChariPay — pack ' || r.pack || ' (' || r.montant_mad || ' MAD)')
    RETURNING id INTO v_entry;

  UPDATE public.payment_sessions
    SET statut = 'payee',
        provider_session_id = COALESCE(p_provider_session_id, provider_session_id),
        raw_webhook = p_raw, ledger_id = v_entry, updated_at = now()
    WHERE id = p_session_id;

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
    VALUES (r.org_id, r.demandeur_id, 'credits_achat_en_ligne', 'payment_session', r.id::text,
            jsonb_build_object('credits', r.credits, 'montant_mad', r.montant_mad, 'ledger_id', v_entry));

  INSERT INTO public.notifications(user_id, org_id, kind, title, body, link, meta)
    VALUES (r.demandeur_id, r.org_id, 'paiement_credite',
            'Paiement reçu',
            r.credits || ' crédits ont été ajoutés à votre solde (pack ' || r.pack || ').',
            '/app/credits',
            jsonb_build_object('payment_session_id', r.id, 'ledger_id', v_entry));

  RETURN v_entry;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.charipay_mark_paid(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.charipay_mark_failed(
  p_session_id uuid,
  p_provider_session_id text,
  p_raw jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.payment_sessions
    SET statut = 'echouee',
        provider_session_id = COALESCE(p_provider_session_id, provider_session_id),
        raw_webhook = p_raw, updated_at = now()
    WHERE id = p_session_id AND statut = 'en_attente';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.charipay_mark_failed(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
