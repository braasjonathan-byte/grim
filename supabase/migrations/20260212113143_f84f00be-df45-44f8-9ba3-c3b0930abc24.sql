
-- Restrict profiles to self + friends
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

CREATE POLICY "Users can read own and friends profiles"
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

-- Create a secure RPC for searching users by nickname (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.search_users_by_nickname(search_term text, requesting_user_id uuid)
RETURNS TABLE(user_id uuid, nickname text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL OR auth.uid() != requesting_user_id THEN
    RETURN;
  END IF;

  -- Escape ILIKE wildcards
  search_term := replace(replace(replace(search_term, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT p.user_id, p.nickname
  FROM public.profiles p
  WHERE p.nickname ILIKE '%' || search_term || '%'
    AND p.user_id != requesting_user_id
  LIMIT 10;
END;
$$;
