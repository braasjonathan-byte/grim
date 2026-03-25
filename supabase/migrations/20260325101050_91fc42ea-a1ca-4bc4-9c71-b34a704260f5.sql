-- Allow users to read profiles of people in the same event group
CREATE POLICY "Users can read profiles of group co-members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_group_members gm1
    JOIN event_group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.user_id
  )
);