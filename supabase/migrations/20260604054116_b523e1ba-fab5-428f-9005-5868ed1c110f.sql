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
    CASE
      WHEN LOWER(COALESCE(p.nickname, '')) = 'grim'
        OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'jonne@trainapp.local'
        OR LOWER(COALESCE(auth.jwt() -> 'user_metadata' ->> 'nickname', '')) = 'jonne'
      THEN 'Grim'
      ELSE p.nickname
    END AS nickname,
    COALESCE(p.must_change_password, false) AS must_change_password,
    CASE
      WHEN LOWER(COALESCE(p.nickname, '')) = 'grim'
        OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'jonne@trainapp.local'
        OR LOWER(COALESCE(auth.jwt() -> 'user_metadata' ->> 'nickname', '')) = 'jonne'
      THEN true
      ELSE COALESCE(p.is_honorary, false)
    END AS is_honorary,
    COALESCE(p.theme, 'default') AS theme,
    CASE
      WHEN LOWER(COALESCE(p.nickname, '')) = 'grim'
        OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'jonne@trainapp.local'
        OR LOWER(COALESCE(auth.jwt() -> 'user_metadata' ->> 'nickname', '')) = 'jonne'
      THEN 'admin'::public.app_role
      ELSE 'member'::public.app_role
    END AS role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_access_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_access_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO service_role;

UPDATE public.profiles
SET nickname = 'Grim', is_honorary = true
WHERE user_id IN (
  SELECT u.id
  FROM auth.users u
  WHERE LOWER(u.email) = 'jonne@trainapp.local'
)
OR LOWER(nickname) = 'grim';

DELETE FROM public.user_roles
WHERE role = 'admin'::public.app_role
  AND user_id NOT IN (
    SELECT p.user_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(p.nickname) = 'grim'
      OR LOWER(u.email) = 'jonne@trainapp.local'
  );

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE LOWER(u.email) = 'jonne@trainapp.local'
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;