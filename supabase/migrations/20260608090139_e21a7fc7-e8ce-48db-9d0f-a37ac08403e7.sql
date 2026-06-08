
-- Allow 'blocked' as a friendships status and track who initiated the block
ALTER TABLE public.friendships DROP CONSTRAINT IF EXISTS friendships_status_check;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_status_check
  CHECK (status IN ('pending', 'accepted', 'blocked'));

ALTER TABLE public.friendships
  ADD COLUMN IF NOT EXISTS blocked_by uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Helper: returns true if either user has blocked the other.
CREATE OR REPLACE FUNCTION public.are_blocked(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'blocked'
      AND ((user_id = _a AND friend_id = _b) OR (user_id = _b AND friend_id = _a))
  );
$$;

GRANT EXECUTE ON FUNCTION public.are_blocked(uuid, uuid) TO authenticated;

-- Update social_posts SELECT policy to hide posts from users blocked either way
DROP POLICY IF EXISTS "Users can read public posts" ON public.social_posts;
CREATE POLICY "Users can read public posts"
ON public.social_posts
FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    NOT public.are_blocked(auth.uid(), user_id)
    AND (
      visibility = 'public'
      OR (visibility = 'group' AND group_id IN (
        SELECT group_id FROM public.event_group_members WHERE user_id = auth.uid()
      ))
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.user_id = auth.uid() AND f.friend_id = social_posts.user_id)
            OR (f.friend_id = auth.uid() AND f.user_id = social_posts.user_id)
          )
      )
    )
  )
);

-- Allow users to UPDATE their own friendships row to set status='blocked'
DROP POLICY IF EXISTS "Users can block their friendships" ON public.friendships;
CREATE POLICY "Users can block their friendships"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = friend_id)
WITH CHECK (
  (status = 'blocked' AND blocked_by = auth.uid())
  OR (auth.uid() = friend_id AND status = 'accepted')
);
