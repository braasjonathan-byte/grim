
CREATE POLICY "Users can read profiles of pending request senders"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'pending'
      AND f.friend_id = auth.uid()
      AND f.user_id = profiles.user_id
  )
);
