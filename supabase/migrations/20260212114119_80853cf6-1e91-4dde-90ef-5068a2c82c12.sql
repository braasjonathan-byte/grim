CREATE POLICY "Users can update own exercises"
ON public.custom_exercises
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);