
-- Fix overly permissive friendship update policy
DROP POLICY IF EXISTS "Users can update friendships they received" ON public.friendships;

CREATE POLICY "Users can accept friendships they received"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = friend_id AND status = 'pending')
WITH CHECK (auth.uid() = friend_id AND status = 'accepted');
