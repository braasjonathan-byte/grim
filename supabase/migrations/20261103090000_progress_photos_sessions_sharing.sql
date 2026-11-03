-- Flera bilder per tillfälle + frivillig delning till vän (default helt privat).
ALTER TABLE public.progress_photos ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE TABLE IF NOT EXISTS public.progress_photo_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.progress_photos(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, recipient_id),
  CHECK (owner_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS progress_photo_shares_recipient ON public.progress_photo_shares (recipient_id);
ALTER TABLE public.progress_photo_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pp_owns_photo(_photo uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.progress_photos WHERE id = _photo AND user_id = _uid) $$;
CREATE OR REPLACE FUNCTION public.pp_are_friends(_a uuid, _b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.friendships WHERE status = 'accepted'
    AND ((user_id = _a AND friend_id = _b) OR (user_id = _b AND friend_id = _a))) $$;
CREATE OR REPLACE FUNCTION public.pp_shared_with(_photo uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.progress_photo_shares s
    WHERE s.photo_id = _photo AND s.recipient_id = _uid AND public.pp_are_friends(s.owner_id, _uid)) $$;
CREATE OR REPLACE FUNCTION public.pp_path_shared_with(_path text, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.progress_photos p JOIN public.progress_photo_shares s ON s.photo_id = p.id
    WHERE p.storage_path = _path AND s.recipient_id = _uid AND public.pp_are_friends(s.owner_id, _uid)) $$;

DROP POLICY IF EXISTS "Owner manages shares" ON public.progress_photo_shares;
CREATE POLICY "Owner manages shares" ON public.progress_photo_shares FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id AND public.pp_owns_photo(photo_id, auth.uid()) AND public.pp_are_friends(owner_id, recipient_id));
DROP POLICY IF EXISTS "Recipient sees own shares" ON public.progress_photo_shares;
CREATE POLICY "Recipient sees own shares" ON public.progress_photo_shares FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Recipient may remove share" ON public.progress_photo_shares;
CREATE POLICY "Recipient may remove share" ON public.progress_photo_shares FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Friends read shared progress photos" ON public.progress_photos;
CREATE POLICY "Friends read shared progress photos" ON public.progress_photos FOR SELECT TO authenticated
  USING (public.pp_shared_with(id, auth.uid()));

DROP POLICY IF EXISTS "Progress photos read shared" ON storage.objects;
CREATE POLICY "Progress photos read shared" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND public.pp_path_shared_with(name, auth.uid()));

UPDATE storage.buckets SET public = false WHERE id = 'progress-photos';
