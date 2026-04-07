INSERT INTO storage.buckets (id, name, public) VALUES ('exercise-images', 'exercise-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for exercise images" ON storage.objects FOR SELECT USING (bucket_id = 'exercise-images');
CREATE POLICY "Admin upload exercise images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'exercise-images');