
-- 1. Extend wallets
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS credits_alerte int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS autorise_negatif boolean NOT NULL DEFAULT false;

-- 2. credit_pricing
CREATE TABLE IF NOT EXISTS public.credit_pricing (
  action text PRIMARY KEY,
  label text NOT NULL,
  cout int NOT NULL CHECK (cout >= 0),
  actif boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT ON public.credit_pricing TO authenticated;
GRANT ALL ON public.credit_pricing TO service_role;
ALTER TABLE public.credit_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_read_all" ON public.credit_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "pricing_admin_write" ON public.credit_pricing FOR ALL TO authenticated
  USING (public.has_platform_role('admin'::public.platform_role))
  WITH CHECK (public.has_platform_role('admin'::public.platform_role));

INSERT INTO public.credit_pricing (action, label, cout) VALUES
  ('prefaisabilite',    'Pré-faisabilité',                0),
  ('recommandation',    'Recommandation / mode inversé',  0),
  ('budget_campagne',   'Budget de campagne',             1),
  ('budget_reprevision','Re-prévision d''un budget',      0),
  ('bp_complet',        'Business plan complet',          3),
  ('contre_expertise',  'Rapport de contre-expertise',    2),
  ('export_pdf',        'Export PDF vérifiable',          0)
ON CONFLICT (action) DO NOTHING;

-- 3. credit_ledger (append-only)
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  delta int NOT NULL CHECK (delta <> 0),
  solde_apres int NOT NULL,
  type text NOT NULL CHECK (type IN ('octroi_admin','consommation','remboursement','ajustement','achat_en_ligne')),
  action text,
  ref_id uuid,
  auteur_id uuid REFERENCES auth.users(id),
  motif text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_org_at_idx ON public.credit_ledger(org_id, at DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_type_idx ON public.credit_ledger(type);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_select_org_or_admin" ON public.credit_ledger FOR SELECT TO authenticated
  USING (public.is_org_member(org_id) OR public.has_platform_role('admin'::public.platform_role));

CREATE OR REPLACE FUNCTION public.credit_ledger_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'credit_ledger is append-only'; END $$;
REVOKE ALL ON FUNCTION public.credit_ledger_immutable() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS credit_ledger_no_update ON public.credit_ledger;
CREATE TRIGGER credit_ledger_no_update BEFORE UPDATE ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.credit_ledger_immutable();
DROP TRIGGER IF EXISTS credit_ledger_no_delete ON public.credit_ledger;
CREATE TRIGGER credit_ledger_no_delete BEFORE DELETE ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.credit_ledger_immutable();

-- 4. credit_requests
CREATE TABLE IF NOT EXISTS public.credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  demandeur_id uuid NOT NULL REFERENCES auth.users(id),
  pack text NOT NULL,
  credits int NOT NULL CHECK (credits > 0),
  montant_mad numeric(12,2),
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','accordee','refusee')),
  message text,
  traitee_par uuid REFERENCES auth.users(id),
  traitee_le timestamptz,
  motif_refus text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_requests_statut_idx ON public.credit_requests(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_requests_org_idx ON public.credit_requests(org_id);
GRANT SELECT, INSERT ON public.credit_requests TO authenticated;
GRANT ALL ON public.credit_requests TO service_role;
ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_select_org_or_admin" ON public.credit_requests FOR SELECT TO authenticated
  USING (public.is_org_member(org_id) OR public.has_platform_role('admin'::public.platform_role));
CREATE POLICY "requests_owner_insert" ON public.credit_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner']::public.org_role[]) AND demandeur_id = auth.uid());

-- 5. RPCs

-- consume_credits: atomic debit; returns ledger entry id (or NULL if free action)
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_org_id uuid, p_action text, p_ref_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cost int; v_active boolean; v_credits int; v_autorise boolean; v_new int; v_entry uuid;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT cout, actif INTO v_cost, v_active FROM public.credit_pricing WHERE action = p_action;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'unknown_action:%', p_action; END IF;
  IF NOT v_active THEN RAISE EXCEPTION 'action_disabled:%', p_action; END IF;
  IF v_cost = 0 THEN RETURN NULL; END IF;

  SELECT credits, autorise_negatif INTO v_credits, v_autorise
    FROM public.wallets WHERE org_id = p_org_id FOR UPDATE;
  IF v_credits IS NULL THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF v_credits < v_cost AND NOT v_autorise THEN
    RAISE EXCEPTION 'insufficient_credits:solde=% requis=%', v_credits, v_cost;
  END IF;
  v_new := v_credits - v_cost;
  UPDATE public.wallets SET credits = v_new, updated_at = now() WHERE org_id = p_org_id;
  INSERT INTO public.credit_ledger(org_id, delta, solde_apres, type, action, ref_id, auteur_id)
    VALUES (p_org_id, -v_cost, v_new, 'consommation', p_action, p_ref_id, auth.uid())
    RETURNING id INTO v_entry;
  RETURN v_entry;
END $$;
REVOKE ALL ON FUNCTION public.consume_credits(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, text, uuid) TO authenticated;

-- refund_credits: idempotent refund of a prior consumption
CREATE OR REPLACE FUNCTION public.refund_credits(p_ledger_id uuid, p_motif text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.credit_ledger%ROWTYPE; v_new int; v_entry uuid;
BEGIN
  SELECT * INTO r FROM public.credit_ledger WHERE id = p_ledger_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.type <> 'consommation' THEN RAISE EXCEPTION 'not_a_consumption'; END IF;
  IF r.auteur_id <> auth.uid() AND NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.credit_ledger
     WHERE type = 'remboursement' AND action = r.action
       AND org_id = r.org_id AND COALESCE(ref_id::text,'') = COALESCE(r.ref_id::text,'')
       AND at > r.at
  ) THEN RETURN NULL; END IF;
  UPDATE public.wallets SET credits = credits + (-r.delta), updated_at = now()
    WHERE org_id = r.org_id RETURNING credits INTO v_new;
  INSERT INTO public.credit_ledger(org_id, delta, solde_apres, type, action, ref_id, auteur_id, motif)
    VALUES (r.org_id, -r.delta, v_new, 'remboursement', r.action, r.ref_id, auth.uid(), p_motif)
    RETURNING id INTO v_entry;
  RETURN v_entry;
END $$;
REVOKE ALL ON FUNCTION public.refund_credits(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, text) TO authenticated;

-- grant_credits: admin only; delta may be negative (adjustment)
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_org_id uuid, p_delta int, p_motif text, p_type text DEFAULT 'octroi_admin'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new int; v_entry uuid;
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_delta = 0 THEN RAISE EXCEPTION 'delta_zero'; END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN RAISE EXCEPTION 'motif_required_min_10'; END IF;
  IF p_type NOT IN ('octroi_admin','ajustement','achat_en_ligne') THEN RAISE EXCEPTION 'bad_type'; END IF;
  UPDATE public.wallets SET credits = credits + p_delta, updated_at = now()
    WHERE org_id = p_org_id RETURNING credits INTO v_new;
  IF v_new IS NULL THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  INSERT INTO public.credit_ledger(org_id, delta, solde_apres, type, action, auteur_id, motif)
    VALUES (p_org_id, p_delta, v_new, p_type, NULL, auth.uid(), p_motif)
    RETURNING id INTO v_entry;
  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
    VALUES (p_org_id, auth.uid(), 'credits_'||p_type, 'organization', p_org_id::text,
            jsonb_build_object('delta', p_delta, 'motif', p_motif, 'ledger_id', v_entry));
  RETURN v_entry;
END $$;
REVOKE ALL ON FUNCTION public.grant_credits(uuid, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, int, text, text) TO authenticated;

-- decide_credit_request: admin accepts / refuses a pending request
CREATE OR REPLACE FUNCTION public.decide_credit_request(
  p_request_id uuid, p_decision text, p_motif text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.credit_requests%ROWTYPE; v_entry uuid;
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.credit_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.statut <> 'en_attente' THEN RAISE EXCEPTION 'already_treated'; END IF;
  IF p_decision NOT IN ('accordee','refusee') THEN RAISE EXCEPTION 'bad_decision'; END IF;
  IF p_decision = 'accordee' THEN
    v_entry := public.grant_credits(r.org_id, r.credits,
      'Demande '||r.pack||' accordée (req '||substring(r.id::text,1,8)||')', 'octroi_admin');
    UPDATE public.credit_requests
       SET statut = 'accordee', traitee_par = auth.uid(), traitee_le = now()
     WHERE id = p_request_id;
  ELSE
    IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN RAISE EXCEPTION 'motif_refus_required'; END IF;
    UPDATE public.credit_requests
       SET statut = 'refusee', traitee_par = auth.uid(), traitee_le = now(), motif_refus = p_motif
     WHERE id = p_request_id;
  END IF;
  RETURN v_entry;
END $$;
REVOKE ALL ON FUNCTION public.decide_credit_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_credit_request(uuid, text, text) TO authenticated;
