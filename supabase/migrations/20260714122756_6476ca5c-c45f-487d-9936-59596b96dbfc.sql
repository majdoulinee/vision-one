
-- Allow a member to leave their own org (non-owner). Owners must transfer / be removed by another owner via RPC.
DROP POLICY IF EXISTS members_delete_self ON public.org_members;
CREATE POLICY members_delete_self ON public.org_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND role <> 'owner'::public.org_role);

-- Set a member's role, protecting the last-owner invariant.
CREATE OR REPLACE FUNCTION public.org_set_member_role(
  p_org uuid, p_user uuid, p_role public.org_role, p_motif text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old public.org_role; v_owners int;
BEGIN
  IF NOT public.has_org_role(p_org, ARRAY['owner'::public.org_role, 'admin'::public.org_role]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN RAISE EXCEPTION 'motif_required_min_5'; END IF;

  SELECT role INTO v_old FROM public.org_members WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF v_old = p_role THEN RETURN; END IF;

  -- Only an owner can promote to owner or demote another owner
  IF (p_role = 'owner'::public.org_role OR v_old = 'owner'::public.org_role)
     AND NOT public.has_org_role(p_org, ARRAY['owner'::public.org_role]) THEN
    RAISE EXCEPTION 'only_owner_can_change_owner';
  END IF;

  -- Prevent removing the last owner
  IF v_old = 'owner'::public.org_role AND p_role <> 'owner'::public.org_role THEN
    SELECT count(*) INTO v_owners FROM public.org_members WHERE org_id = p_org AND role = 'owner'::public.org_role;
    IF v_owners <= 1 THEN RAISE EXCEPTION 'cannot_demote_last_owner'; END IF;
  END IF;

  UPDATE public.org_members SET role = p_role WHERE org_id = p_org AND user_id = p_user;

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
  VALUES (p_org, auth.uid(), 'org_member_role_changed', 'org_member', p_user::text,
    jsonb_build_object('old_role', v_old, 'new_role', p_role, 'motif', p_motif));
END $$;

-- Remove a member (kick), protecting the last owner.
CREATE OR REPLACE FUNCTION public.org_remove_member(
  p_org uuid, p_user uuid, p_motif text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old public.org_role; v_owners int;
BEGIN
  IF NOT public.has_org_role(p_org, ARRAY['owner'::public.org_role, 'admin'::public.org_role]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'use_leave_instead'; END IF;
  IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN RAISE EXCEPTION 'motif_required_min_5'; END IF;

  SELECT role INTO v_old FROM public.org_members WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;

  IF v_old = 'owner'::public.org_role THEN
    IF NOT public.has_org_role(p_org, ARRAY['owner'::public.org_role]) THEN
      RAISE EXCEPTION 'only_owner_can_remove_owner';
    END IF;
    SELECT count(*) INTO v_owners FROM public.org_members WHERE org_id = p_org AND role = 'owner'::public.org_role;
    IF v_owners <= 1 THEN RAISE EXCEPTION 'cannot_remove_last_owner'; END IF;
  END IF;

  DELETE FROM public.org_members WHERE org_id = p_org AND user_id = p_user;

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
  VALUES (p_org, auth.uid(), 'org_member_removed', 'org_member', p_user::text,
    jsonb_build_object('old_role', v_old, 'motif', p_motif));
END $$;

-- A member leaves the org (self-service). Cannot leave if last owner.
CREATE OR REPLACE FUNCTION public.org_leave(p_org uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role public.org_role; v_owners int;
BEGIN
  SELECT role INTO v_role FROM public.org_members WHERE org_id = p_org AND user_id = auth.uid() FOR UPDATE;
  IF v_role IS NULL THEN RAISE EXCEPTION 'not_a_member'; END IF;

  IF v_role = 'owner'::public.org_role THEN
    SELECT count(*) INTO v_owners FROM public.org_members WHERE org_id = p_org AND role = 'owner'::public.org_role;
    IF v_owners <= 1 THEN RAISE EXCEPTION 'cannot_leave_as_last_owner'; END IF;
  END IF;

  DELETE FROM public.org_members WHERE org_id = p_org AND user_id = auth.uid();

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
  VALUES (p_org, auth.uid(), 'org_member_left', 'org_member', auth.uid()::text,
    jsonb_build_object('old_role', v_role));
END $$;

-- Extend a pending invitation by 7 days.
CREATE OR REPLACE FUNCTION public.org_extend_invitation(p_inv_id uuid) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid; v_accepted timestamptz; v_new timestamptz;
BEGIN
  SELECT org_id, accepted_at INTO v_org, v_accepted
    FROM public.invitations WHERE id = p_inv_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_accepted IS NOT NULL THEN RAISE EXCEPTION 'already_accepted'; END IF;
  IF NOT public.has_org_role(v_org, ARRAY['owner'::public.org_role, 'admin'::public.org_role]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_new := now() + interval '7 days';
  UPDATE public.invitations SET expires_at = v_new WHERE id = p_inv_id;

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
  VALUES (v_org, auth.uid(), 'invitation_extended', 'invitation', p_inv_id::text,
    jsonb_build_object('new_expires_at', v_new));

  RETURN v_new;
END $$;

-- Client asks a platform admin to revoke a consultant link.
CREATE OR REPLACE FUNCTION public.client_request_consultant_revocation(
  p_link_id uuid, p_motif text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_client uuid; v_consultant uuid; v_statut text;
BEGIN
  IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN RAISE EXCEPTION 'motif_required_min_5'; END IF;

  SELECT client_org_id, consultant_org_id, statut
    INTO v_client, v_consultant, v_statut
    FROM public.consultant_links WHERE id = p_link_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_statut <> 'actif' THEN RAISE EXCEPTION 'not_active'; END IF;

  IF NOT public.has_org_role(v_client, ARRAY['owner'::public.org_role, 'admin'::public.org_role]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_log(org_id, user_id, action, entity_type, entity_id, meta)
  VALUES (v_client, auth.uid(), 'consultant_revocation_requested', 'consultant_link', p_link_id::text,
    jsonb_build_object('motif', p_motif, 'consultant_org', v_consultant));

  -- Notify all platform admins
  INSERT INTO public.notifications(user_id, org_id, kind, title, body, link, meta)
  SELECT p.id, v_client, 'consultant_revocation_requested',
         'Demande de révocation de rattachement consultant',
         'Un client demande la révocation d''un rattachement. Motif : ' || p_motif,
         '/app/admin/consultants',
         jsonb_build_object('link_id', p_link_id, 'consultant_org', v_consultant, 'motif', p_motif)
  FROM public.profiles p WHERE p.platform_role = 'admin'::public.platform_role;
END $$;

-- Ensure execute rights (RPCs are SECURITY DEFINER; callable by authenticated).
REVOKE ALL ON FUNCTION public.org_set_member_role(uuid, uuid, public.org_role, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_remove_member(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_leave(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_extend_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_request_consultant_revocation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_set_member_role(uuid, uuid, public.org_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_remove_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_leave(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_extend_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_request_consultant_revocation(uuid, text) TO authenticated;
