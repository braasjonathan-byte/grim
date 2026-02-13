
-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can read own and friends profiles" ON public.profiles;

-- Create new policy: only owner or accepted friends can read profiles
CREATE POLICY "Users can read own and accepted friends profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = auth.uid() AND f.friend_id = profiles.user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = profiles.user_id)
      )
  )
);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);
