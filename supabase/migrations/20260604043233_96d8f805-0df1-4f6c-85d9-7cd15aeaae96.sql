CREATE OR REPLACE FUNCTION public.get_my_access_status()
RETURNS TABLE(
  nickname text,
  must_change_password boolean,
  is_honorary boolean,
  theme text,
  role public.app_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.nickname,
    COALESCE(p.must_change_password, false) AS must_change_password,
    COALESCE(p.is_honorary, false) AS is_honorary,
    COALESCE(p.theme, 'default') AS theme,
    COALESCE(
      (
        SELECT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        ORDER BY CASE WHEN ur.role = 'admin'::public.app_role THEN 0 ELSE 1 END
        LIMIT 1
      ),
      'member'::public.app_role
    ) AS role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_access_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO service_role;