
DROP POLICY IF EXISTS "Anyone can read completions" ON public.workout_completions;

CREATE POLICY "Users can read own and friends completions"
ON public.workout_completions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = workout_completions.user_id)
      OR (f.friend_id = auth.uid() AND f.user_id = workout_completions.user_id)
    )
  )
);
