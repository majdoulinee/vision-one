
CREATE OR REPLACE FUNCTION public.comite_notify_ref_publication(p_lot_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version text;
  v_note text;
  v_count int := 0;
BEGIN
  IF NOT (public.has_platform_role('comite'::public.platform_role)
       OR public.has_platform_role('admin'::public.platform_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT l.version_cible, l.note_version
    INTO v_version, v_note
    FROM public.ref_lots l
   WHERE l.id = p_lot_id AND l.statut = 'publie';
  IF v_version IS NULL THEN RAISE EXCEPTION 'lot_not_published'; END IF;

  WITH touched_profiles AS (
    SELECT DISTINCT profil_code
      FROM public.ref_propositions
     WHERE lot_id = p_lot_id AND profil_code IS NOT NULL
  ),
  touched_orgs AS (
    SELECT DISTINCT p.org_id
      FROM public.projects p
      JOIN touched_profiles tp ON tp.profil_code = p.profile_code
  ),
  recipients AS (
    SELECT m.user_id, m.org_id
      FROM public.org_members m
      JOIN touched_orgs t ON t.org_id = m.org_id
     WHERE m.role IN ('owner','admin','member')
  ),
  ins AS (
    INSERT INTO public.notifications(user_id, org_id, kind, title, body, link, meta)
    SELECT r.user_id, r.org_id, 'ref_version_published',
           'Nouvelle version référentiel v'||v_version,
           COALESCE(v_note,'Une nouvelle version du référentiel est disponible.')
             ||' — Vous pouvez re-prévoir vos budgets gratuitement.',
           '/app/referentiel',
           jsonb_build_object('version', v_version, 'lot_id', p_lot_id)
      FROM recipients r
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  INSERT INTO public.audit_log(user_id, action, entity_type, entity_id, meta)
  VALUES (auth.uid(), 'ref_publication_notified', 'ref_lot', p_lot_id::text,
    jsonb_build_object('version', v_version, 'notified', v_count));

  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.comite_notify_ref_publication(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comite_notify_ref_publication(uuid) TO authenticated;
