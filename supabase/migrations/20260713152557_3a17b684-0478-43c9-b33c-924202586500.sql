-- Lock down EXECUTE on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_platform_role(public.platform_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_platform_role(public.platform_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_referentiel_editor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_referentiel_editor() TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_org_role(uuid, public.org_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.org_role[]) TO authenticated;