-- Säkerhetsfynd 1: admin/premium får bara komma från user_roles (has_role),
-- aldrig från nickname, e-post eller user_metadata i JWT.
CREATE OR REPLACE FUNCTION public.get_my_access_status()
 RETURNS TABLE(nickname text, must_change_password boolean, is_honorary boolean, theme text, role app_role)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.nickname AS nickname,
    COALESCE(p.must_change_password, false) AS must_change_password,
    (COALESCE(p.is_honorary, false) OR public.has_role(p.user_id, 'admin'::public.app_role)) AS is_honorary,
    COALESCE(p.theme, 'default') AS theme,
    CASE WHEN public.has_role(p.user_id, 'admin'::public.app_role)
      THEN 'admin'::public.app_role ELSE 'member'::public.app_role END AS role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$function$;

-- Säkerhetsfynd 2: ingen anonym listning/läsning via storage-API:t.
DROP POLICY IF EXISTS "Anyone can read social images" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read share-videos" ON storage.objects;

-- Avatarer: ägaren får läsa sin egen mapp (krävs för upsert av avatar.jpg).
-- Visning sker via publik URL (bucketen är fortfarande public).
DROP POLICY IF EXISTS "Users can read own avatar" ON storage.objects;
CREATE POLICY "Users can read own avatar" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Sociala bilder: inloggad användare får läsa en fil om den är egen eller om
-- den hör till ett inlägg/bild/recept/supportmeddelande som användaren får läsa
-- enligt tabellernas egen RLS (SECURITY INVOKER => synlighet respekteras).
CREATE OR REPLACE FUNCTION public.can_read_social_image(object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  WITH u AS (
    SELECT 'https://gnhbkevtoajzdpsengki.supabase.co/storage/v1/object/public/social-images/' || object_name AS url
  )
  SELECT
    (storage.foldername(object_name))[1] = auth.uid()::text
    OR ((storage.foldername(object_name))[1] = 'support' AND (storage.foldername(object_name))[2] = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.social_posts sp, u WHERE sp.image_url = u.url)
    OR EXISTS (SELECT 1 FROM public.social_post_images spi, u WHERE spi.image_url = u.url)
    OR EXISTS (SELECT 1 FROM public.recipes r, u WHERE r.image_url = u.url)
    OR EXISTS (SELECT 1 FROM public.support_messages sm, u WHERE sm.message = '[bild]' || u.url);
$function$;

REVOKE EXECUTE ON FUNCTION public.can_read_social_image(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_read_social_image(text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated can read visible social images" ON storage.objects;
CREATE POLICY "Authenticated can read visible social images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'social-images' AND public.can_read_social_image(name));
