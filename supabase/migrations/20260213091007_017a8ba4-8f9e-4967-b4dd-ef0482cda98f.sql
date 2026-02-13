
CREATE POLICY "Target users can delete comments on their workouts"
ON public.workout_comments
FOR DELETE
USING (auth.uid() = target_user_id);
