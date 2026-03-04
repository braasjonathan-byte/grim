CREATE POLICY "Friends can read challenge completions"
ON public.daily_challenge_completions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = daily_challenge_completions.user_id)
      OR (f.friend_id = auth.uid() AND f.user_id = daily_challenge_completions.user_id)
    )
  )
);