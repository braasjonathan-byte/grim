
DROP POLICY IF EXISTS "Users can add comments" ON public.workout_comments;

CREATE POLICY "Friends can add comments"
ON public.workout_comments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND (
    auth.uid() = target_user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
      AND (
        (f.user_id = auth.uid() AND f.friend_id = target_user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = target_user_id)
      )
    )
  )
);
