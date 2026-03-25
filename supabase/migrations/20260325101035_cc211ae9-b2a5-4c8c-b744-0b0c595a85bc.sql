-- Allow authenticated users to insert popular events (so custom events are shared)
CREATE POLICY "Authenticated can insert popular events"
ON public.popular_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow admin to delete event_groups (for admin group deletion)
CREATE POLICY "Admins can delete groups"
ON public.event_groups
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to delete group members (cascade when deleting group)
CREATE POLICY "Admins can delete group members"
ON public.event_group_members
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to delete social posts in groups
CREATE POLICY "Admins can delete social posts"
ON public.social_posts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));