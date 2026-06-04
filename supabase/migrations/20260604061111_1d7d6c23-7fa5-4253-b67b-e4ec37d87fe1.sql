GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

UPDATE public.profiles
SET nickname = 'Grim', is_honorary = true
WHERE user_id IN (
  SELECT id
  FROM auth.users
  WHERE lower(email) = 'jonne@trainapp.local'
)
OR lower(nickname) = 'grim';

DELETE FROM public.user_roles
WHERE role = 'admin'::public.app_role
  AND user_id NOT IN (
    SELECT p.user_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE lower(p.nickname) = 'grim'
       OR lower(u.email) = 'jonne@trainapp.local'
  );

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'jonne@trainapp.local'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = u.id
      AND ur.role = 'admin'::public.app_role
  );