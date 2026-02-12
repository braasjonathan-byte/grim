
DROP POLICY "Users can read own and friends profiles" ON public.profiles;

CREATE POLICY "Users can read own and friends profiles"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = user_id)
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE (
      (f.status = 'accepted' OR f.status = 'pending')
      AND (
        (f.user_id = auth.uid() AND f.friend_id = profiles.user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = profiles.user_id)
      )
    )
  )
);
