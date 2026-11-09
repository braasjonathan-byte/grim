-- Resolve a login name (what the user types on the login screen) to its auth user.
-- Login is `${name}@trainapp.local`, independent of the editable profiles.nickname,
-- so password-reset functions must resolve via auth.users, not profiles.
CREATE OR REPLACE FUNCTION public.resolve_login_user(_login text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(_login)) || '@trainapp.local'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_login_user(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_user(text) TO service_role;
