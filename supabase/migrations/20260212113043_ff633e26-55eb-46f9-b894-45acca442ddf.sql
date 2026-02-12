
DROP POLICY IF EXISTS "Anyone can read plans" ON public.workout_plans;

CREATE POLICY "Users can read own and friends plans"
ON public.workout_plans
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = workout_plans.user_id)
      OR (f.friend_id = auth.uid() AND f.user_id = workout_plans.user_id)
    )
  )
);
