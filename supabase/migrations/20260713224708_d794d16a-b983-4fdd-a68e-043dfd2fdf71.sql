
-- ============================================================
-- 1. PLANS
-- ============================================================
CREATE TABLE public.plans (
  code text PRIMARY KEY,
  label text NOT NULL,
  prix_mad numeric NOT NULL DEFAULT 0,
  quota_gen_jour int NOT NULL DEFAULT 0,
  credits_mensuels int NOT NULL DEFAULT 0,
  marque_blanche boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_read_all_auth" ON public.plans FOR SELECT TO authenticated USING (true);

ALTER TABLE public.wallets
  ADD COLUMN plan_code text REFERENCES public.plans(code),
  ADD COLUMN plan_assigne_le timestamptz,
  ADD COLUMN plan_facture_ref text;

INSERT INTO public.plans(code, label, prix_mad, quota_gen_jour, credits_mensuels, marque_blanche) VALUES
  ('campagne',      'Campagne',       0,    5,  0,  false),
  ('consultant',    'Consultant',     1500, 20, 50, true),
  ('groupe',        'Groupe',         3000, 50, 150, false),
  ('institutionnel','Institutionnel', 8000, 200, 500, false);

-- ============================================================
-- 2. CONSULTANT LINKS
-- ============================================================
CREATE TABLE public.consultant_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('operateur','lecteur')),
  credits_source text NOT NULL CHECK (credits_source IN ('client','consultant')),
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','revoque')),
  accorde_par uuid,
  accorde_le timestamptz NOT NULL DEFAULT now(),
  motif_accord text,
  revoque_par uuid,
  revoque_le timestamptz,
  motif_revocation text
);
CREATE INDEX ON public.consultant_links(client_org_id) WHERE statut = 'actif';
CREATE INDEX ON public.consultant_links(consultant_org_id) WHERE statut = 'actif';
GRANT SELECT ON public.consultant_links TO authenticated;
GRANT ALL ON public.consultant_links TO service_role;
ALTER TABLE public.consultant_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consultant_links_read_members" ON public.consultant_links FOR SELECT TO authenticated
  USING (
    public.has_platform_role('admin'::public.platform_role)
    OR public.is_org_member(consultant_org_id)
    OR public.is_org_member(client_org_id)
  );

-- ============================================================
-- 3. REF LOTS + PROPOSITIONS + BEE ONE
-- ============================================================
CREATE TYPE public.proposition_statut AS ENUM
  ('brouillon','soumise','validee_comite','approuvee_admin','publiee','rejetee','renvoyee_comite');

CREATE TABLE public.ref_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_cible text NOT NULL,
  statut text NOT NULL DEFAULT 'en_preparation'
    CHECK (statut IN ('en_preparation','soumis_admin','autorise_publication','publie','abandonne')),
  note_version text,
  cree_par uuid,
  cree_le timestamptz NOT NULL DEFAULT now(),
  publie_le timestamptz,
  publie_par uuid
);
GRANT SELECT ON public.ref_lots TO authenticated;
GRANT ALL ON public.ref_lots TO service_role;
ALTER TABLE public.ref_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_lots_read_editors" ON public.ref_lots FOR SELECT TO authenticated
  USING (public.is_referentiel_editor());

CREATE TABLE public.ref_propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.ref_lots(id) ON DELETE CASCADE,
  profil_code text,
  zone_code text,
  cle_norme text NOT NULL,
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb NOT NULL,
  provenance text NOT NULL CHECK (provenance IN ('comite_experts','bee_one')),
  bee_one_n int,
  bee_one_periode text,
  justification text NOT NULL,
  statut public.proposition_statut NOT NULL DEFAULT 'brouillon',
  auteur uuid,
  cree_le timestamptz NOT NULL DEFAULT now(),
  valide_comite_par uuid,
  valide_comite_le timestamptz,
  approuve_admin_par uuid,
  approuve_admin_le timestamptz,
  motif_rejet text,
  motif_renvoi text
);
CREATE INDEX ON public.ref_propositions(lot_id);
CREATE INDEX ON public.ref_propositions(statut);
GRANT SELECT ON public.ref_propositions TO authenticated;
GRANT ALL ON public.ref_propositions TO service_role;
ALTER TABLE public.ref_propositions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_propositions_read_editors" ON public.ref_propositions FOR SELECT TO authenticated
  USING (public.is_referentiel_editor());

CREATE TABLE public.bee_one_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recu_le timestamptz NOT NULL DEFAULT now(),
  profil_code text,
  zone_code text,
  cle_norme text NOT NULL,
  valeur_agrege jsonb NOT NULL,
  n_echantillon int NOT NULL DEFAULT 0,
  seuil_k_anonymat int NOT NULL DEFAULT 30,
  statut text NOT NULL DEFAULT 'a_examiner'
    CHECK (statut IN ('a_examiner','acceptee','ecartee','signalee','bloquee_k')),
  motif text,
  examine_par uuid,
  examine_le timestamptz
);
GRANT SELECT ON public.bee_one_ingestions TO authenticated;
GRANT ALL ON public.bee_one_ingestions TO service_role;
ALTER TABLE public.bee_one_ingestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bee_one_read_editors" ON public.bee_one_ingestions FOR SELECT TO authenticated
  USING (public.is_referentiel_editor());

-- ============================================================
-- 4. IMMUTABILITY TRIGGER on ref_versions
-- ============================================================
CREATE OR REPLACE FUNCTION public.ref_versions_immutable_when_published()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.publiee = true THEN
    RAISE EXCEPTION 'ref_versions is immutable once published';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ref_versions_immutable ON public.ref_versions;
CREATE TRIGGER trg_ref_versions_immutable
  BEFORE UPDATE OR DELETE ON public.ref_versions
  FOR EACH ROW EXECUTE FUNCTION public.ref_versions_immutable_when_published();

-- ============================================================
-- 5. RPC: ADMIN
-- ============================================================

-- Assigner un plan
CREATE OR REPLACE FUNCTION public.admin_assign_plan(
  p_org_id uuid, p_plan_code text, p_facture_ref text, p_motif text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credits int; v_ledger uuid;
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN RAISE EXCEPTION 'motif_required_min_10'; END IF;
  SELECT credits_mensuels INTO v_credits FROM public.plans WHERE code = p_plan_code AND actif = true;
  IF v_credits IS NULL THEN RAISE EXCEPTION 'plan_not_found_or_inactive'; END IF;

  UPDATE public.wallets
    SET plan_code = p_plan_code, plan_assigne_le = now(), plan_facture_ref = p_facture_ref, updated_at = now()
    WHERE org_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;

  IF v_credits > 0 THEN
    v_ledger := public.grant_credits(p_org_id, v_credits,
      'Crédits inclus dans le plan '||p_plan_code||' (facture: '||COALESCE(p_facture_ref,'-')||')', 'octroi_admin');
  END IF;

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
  VALUES (p_org_id, auth.uid(), 'plan_assigned', 'organization', p_org_id::text,
    jsonb_build_object('plan', p_plan_code, 'facture_ref', p_facture_ref, 'motif', p_motif, 'credits_octroi', v_credits));
END $$;

-- Attacher un consultant
CREATE OR REPLACE FUNCTION public.admin_link_consultant(
  p_consultant_org uuid, p_client_org uuid, p_role text, p_source text, p_motif text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN RAISE EXCEPTION 'motif_required_min_10'; END IF;
  IF p_role NOT IN ('operateur','lecteur') THEN RAISE EXCEPTION 'bad_role'; END IF;
  IF p_source NOT IN ('client','consultant') THEN RAISE EXCEPTION 'bad_source'; END IF;

  INSERT INTO public.consultant_links(consultant_org_id, client_org_id, role, credits_source, accorde_par, motif_accord)
    VALUES (p_consultant_org, p_client_org, p_role, p_source, auth.uid(), p_motif)
    RETURNING id INTO v_id;

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
  VALUES (p_client_org, auth.uid(), 'consultant_linked', 'consultant_link', v_id::text,
    jsonb_build_object('consultant_org', p_consultant_org, 'role', p_role, 'source', p_source, 'motif', p_motif));

  -- Notify client owners
  INSERT INTO public.notifications(user_id, org_id, kind, title, body, link, meta)
  SELECT m.user_id, p_client_org, 'consultant_linked',
         'Un cabinet a été rattaché à votre organisation',
         'Le rôle accordé est '||p_role||'. Vous pouvez demander la révocation.',
         '/settings', jsonb_build_object('link_id', v_id, 'consultant_org', p_consultant_org)
  FROM public.org_members m WHERE m.org_id = p_client_org AND m.role IN ('owner','admin');

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_link(p_link_id uuid, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client uuid;
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN RAISE EXCEPTION 'motif_required_min_5'; END IF;

  UPDATE public.consultant_links
    SET statut = 'revoque', revoque_par = auth.uid(), revoque_le = now(), motif_revocation = p_motif
    WHERE id = p_link_id AND statut = 'actif'
    RETURNING client_org_id INTO v_client;
  IF v_client IS NULL THEN RAISE EXCEPTION 'not_found_or_already_revoked'; END IF;

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
  VALUES (v_client, auth.uid(), 'consultant_revoked', 'consultant_link', p_link_id::text,
    jsonb_build_object('motif', p_motif));
END $$;

-- Rôle plateforme
CREATE OR REPLACE FUNCTION public.admin_set_user_platform_role(
  p_user_id uuid, p_role public.platform_role, p_motif text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_modify_self'; END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN RAISE EXCEPTION 'motif_required_min_10'; END IF;

  UPDATE public.profiles SET platform_role = p_role WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, meta)
  VALUES (auth.uid(), 'platform_role_changed', 'user', p_user_id::text,
    jsonb_build_object('new_role', p_role, 'motif', p_motif));
END $$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_user_id uuid, p_actif boolean, p_motif text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_modify_self'; END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN RAISE EXCEPTION 'motif_required_min_10'; END IF;

  UPDATE public.profiles SET actif = p_actif WHERE id = p_user_id;
  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, meta)
  VALUES (auth.uid(), CASE WHEN p_actif THEN 'user_activated' ELSE 'user_deactivated' END,
          'user', p_user_id::text, jsonb_build_object('motif', p_motif));
END $$;

-- Add profiles.actif if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;

-- ============================================================
-- 6. RPC: PROPOSITIONS / PUBLICATION
-- ============================================================

CREATE OR REPLACE FUNCTION public.comite_submit_proposition(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_platform_role('comite'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ref_propositions SET statut = 'validee_comite',
    valide_comite_par = auth.uid(), valide_comite_le = now()
   WHERE id = p_id AND statut IN ('brouillon','soumise','renvoyee_comite');
  IF NOT FOUND THEN RAISE EXCEPTION 'bad_state_or_not_found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_approve_proposition(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ref_propositions SET statut = 'approuvee_admin',
    approuve_admin_par = auth.uid(), approuve_admin_le = now()
   WHERE id = p_id AND statut = 'validee_comite';
  IF NOT FOUND THEN RAISE EXCEPTION 'bad_state_or_not_found'; END IF;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, meta)
  VALUES (auth.uid(), 'proposition_approved', 'ref_proposition', p_id::text, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_return_proposition(p_id uuid, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_platform_role('admin'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 10 THEN RAISE EXCEPTION 'motif_required_min_10'; END IF;
  UPDATE public.ref_propositions SET statut = 'renvoyee_comite', motif_renvoi = p_motif
   WHERE id = p_id AND statut = 'validee_comite';
  IF NOT FOUND THEN RAISE EXCEPTION 'bad_state_or_not_found'; END IF;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, meta)
  VALUES (auth.uid(), 'proposition_returned', 'ref_proposition', p_id::text,
    jsonb_build_object('motif', p_motif));
END $$;

CREATE OR REPLACE FUNCTION public.comite_publish_lot(p_lot_id uuid, p_note text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_version text; v_pending int;
BEGIN
  IF NOT public.has_platform_role('comite'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_note IS NULL OR length(trim(p_note)) < 10 THEN RAISE EXCEPTION 'note_required_min_10'; END IF;

  SELECT count(*) INTO v_pending FROM public.ref_propositions
   WHERE lot_id = p_lot_id AND statut <> 'approuvee_admin';
  IF v_pending > 0 THEN RAISE EXCEPTION 'lot_has_% propositions non approuvees', v_pending; END IF;

  SELECT version_cible INTO v_version FROM public.ref_lots WHERE id = p_lot_id FOR UPDATE;
  IF v_version IS NULL THEN RAISE EXCEPTION 'lot_not_found'; END IF;

  INSERT INTO public.ref_versions(version, publiee, note_publication, publiee_le, publiee_par)
    VALUES (v_version, true, p_note, now(), auth.uid())
    ON CONFLICT (version) DO UPDATE SET publiee = true,
      note_publication = EXCLUDED.note_publication,
      publiee_le = EXCLUDED.publiee_le, publiee_par = EXCLUDED.publiee_par;

  UPDATE public.ref_propositions SET statut = 'publiee' WHERE lot_id = p_lot_id;
  UPDATE public.ref_lots SET statut = 'publie', publie_le = now(), publie_par = auth.uid(),
    note_version = p_note WHERE id = p_lot_id;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, meta)
  VALUES (auth.uid(), 'ref_lot_published', 'ref_lot', p_lot_id::text,
    jsonb_build_object('version', v_version, 'note', p_note));

  RETURN v_version;
END $$;

-- Add missing columns on ref_versions if not present
ALTER TABLE public.ref_versions
  ADD COLUMN IF NOT EXISTS note_publication text,
  ADD COLUMN IF NOT EXISTS publiee_le timestamptz,
  ADD COLUMN IF NOT EXISTS publiee_par uuid;

-- ============================================================
-- 7. RPC: BEE ONE
-- ============================================================
CREATE OR REPLACE FUNCTION public.bee_one_examine(
  p_id uuid, p_decision text, p_motif text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_platform_role('comite'::public.platform_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('acceptee','ecartee','signalee') THEN RAISE EXCEPTION 'bad_decision'; END IF;

  UPDATE public.bee_one_ingestions
     SET statut = p_decision::text, motif = p_motif,
         examine_par = auth.uid(), examine_le = now()
   WHERE id = p_id AND statut = 'a_examiner';
  IF NOT FOUND THEN RAISE EXCEPTION 'bad_state_or_not_found'; END IF;
END $$;

-- Auto-block ingestions under k-anonymity threshold
CREATE OR REPLACE FUNCTION public.bee_one_check_k()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.n_echantillon < NEW.seuil_k_anonymat THEN
    NEW.statut := 'bloquee_k';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bee_one_k ON public.bee_one_ingestions;
CREATE TRIGGER trg_bee_one_k BEFORE INSERT ON public.bee_one_ingestions
  FOR EACH ROW EXECUTE FUNCTION public.bee_one_check_k();

REVOKE EXECUTE ON FUNCTION public.ref_versions_immutable_when_published() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bee_one_check_k() FROM PUBLIC, anon, authenticated;
