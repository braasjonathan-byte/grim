
-- Drop the restrictive policies that block all access
DROP POLICY IF EXISTS "Users can read own and accepted friends profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

-- Create PERMISSIVE policy for authenticated users (own profile + accepted friends)
CREATE POLICY "Users can read own and accepted friends profiles"
ON public.profiles
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
