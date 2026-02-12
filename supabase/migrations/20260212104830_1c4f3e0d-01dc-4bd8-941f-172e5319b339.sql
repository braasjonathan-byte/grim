
-- Allow users to delete their own completions (needed for leaving a plan)
CREATE POLICY "Users can delete own completions"
  ON public.workout_completions FOR DELETE
  USING (auth.uid() = user_id);
