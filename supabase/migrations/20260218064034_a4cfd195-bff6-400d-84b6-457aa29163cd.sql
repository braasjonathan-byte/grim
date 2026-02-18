CREATE POLICY "Friends can read stars"
ON public.pr_stars
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = auth.uid() AND f.friend_id = pr_stars.user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = pr_stars.user_id)
      )
  )
);