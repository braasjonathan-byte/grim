DROP POLICY IF EXISTS "Anyone can view hidden exercises" ON public.hidden_exercises;
CREATE POLICY "Signed-in users can view hidden exercises" ON public.hidden_exercises FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.hidden_exercises FROM anon;