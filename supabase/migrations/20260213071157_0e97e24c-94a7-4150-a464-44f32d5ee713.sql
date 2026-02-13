CREATE POLICY "Users can update own comments"
ON public.workout_comments FOR UPDATE TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);