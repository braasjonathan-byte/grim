REVOKE EXECUTE ON FUNCTION public.get_my_access_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_access_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO service_role;