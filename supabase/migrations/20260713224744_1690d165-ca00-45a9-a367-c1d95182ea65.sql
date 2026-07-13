
REVOKE EXECUTE ON FUNCTION public.admin_assign_plan(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_link_consultant(uuid, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_link(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_platform_role(uuid, public.platform_role, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_proposition(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_return_proposition(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.comite_submit_proposition(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.comite_publish_lot(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bee_one_examine(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_assign_plan(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_consultant(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_link(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_platform_role(uuid, public.platform_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_proposition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_return_proposition(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comite_submit_proposition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comite_publish_lot(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bee_one_examine(uuid, text, text) TO authenticated;
