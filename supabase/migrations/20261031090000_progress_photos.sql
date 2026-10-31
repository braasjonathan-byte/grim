CREATE TABLE IF NOT EXISTS public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_on date NOT NULL DEFAULT (CURRENT_DATE),
  storage_path text NOT NULL,
  note text,
  pose text CHECK (pose IS NULL OR pose IN ('front','side','back')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own progress photos" ON public.progress_photos;
CREATE POLICY "Users manage own progress photos" ON public.progress_photos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS progress_photos_user_taken ON public.progress_photos (user_id, taken_on DESC);

INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', false)
  ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Progress photos read own" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos insert own" ON storage.objects;
DROP POLICY IF EXISTS "Progress photos delete own" ON storage.objects;
CREATE POLICY "Progress photos read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Progress photos insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Progress photos delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
