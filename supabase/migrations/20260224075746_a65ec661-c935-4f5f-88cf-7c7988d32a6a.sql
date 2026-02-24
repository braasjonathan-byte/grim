CREATE POLICY "Friends can read roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = user_roles.user_id)
      OR (f.friend_id = auth.uid() AND f.user_id = user_roles.user_id)
    )
  )
);