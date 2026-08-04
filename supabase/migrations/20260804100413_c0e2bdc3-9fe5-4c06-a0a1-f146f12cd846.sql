-- 1) Access status must read the real role table
CREATE OR REPLACE FUNCTION public.get_my_access_status()
RETURNS TABLE(nickname text, must_change_password boolean, is_honorary boolean, theme text, role app_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN LOWER(COALESCE(p.nickname, '')) = 'grim'
        OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'jonne@trainapp.local'
        OR LOWER(COALESCE(auth.jwt() -> 'user_metadata' ->> 'nickname', '')) = 'jonne'
      THEN 'Grim'
      ELSE p.nickname
    END AS nickname,
    COALESCE(p.must_change_password, false) AS must_change_password,
    (
      COALESCE(p.is_honorary, false)
      OR public.has_role(p.user_id, 'admin'::public.app_role)
      OR LOWER(COALESCE(p.nickname, '')) = 'grim'
    ) AS is_honorary,
    COALESCE(p.theme, 'default') AS theme,
    CASE
      WHEN public.has_role(p.user_id, 'admin'::public.app_role)
        OR LOWER(COALESCE(p.nickname, '')) = 'grim'
        OR LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'jonne@trainapp.local'
        OR LOWER(COALESCE(auth.jwt() -> 'user_metadata' ->> 'nickname', '')) = 'jonne'
      THEN 'admin'::public.app_role
      ELSE 'member'::public.app_role
    END AS role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$function$;

-- 2) Admins need to be able to read every user's role for the admin tool
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Single, safe entry point for admins to change access level
CREATE OR REPLACE FUNCTION public.admin_set_user_access(_user_id uuid, _role app_role, _honorary boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target_nickname text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can change access level';
  END IF;

  SELECT nickname INTO v_target_nickname FROM public.profiles WHERE user_id = _user_id;
  IF v_target_nickname IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- The creator account can never be demoted
  IF LOWER(v_target_nickname) = 'grim' AND _role <> 'admin'::public.app_role THEN
    RAISE EXCEPTION 'The creator account cannot be demoted';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  PERFORM set_config('app.allow_protected_profile', 'on', true);
  UPDATE public.profiles
     SET is_honorary = (_honorary OR _role = 'admin'::public.app_role)
   WHERE user_id = _user_id;
  PERFORM set_config('app.allow_protected_profile', 'off', true);

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_access(uuid, app_role, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_access(uuid, app_role, boolean) TO authenticated;

-- 4) Keep data consistent: every existing admin is also honorary
UPDATE public.profiles p
   SET is_honorary = true
 WHERE p.is_honorary = false
   AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin');