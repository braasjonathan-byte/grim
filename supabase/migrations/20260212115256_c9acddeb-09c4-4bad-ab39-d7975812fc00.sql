
CREATE OR REPLACE FUNCTION public.get_suggested_friends(requesting_user_id uuid)
RETURNS TABLE(user_id uuid, nickname text, mutual_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL OR auth.uid() != requesting_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH my_friends AS (
    SELECT 
      CASE WHEN f.user_id = requesting_user_id THEN f.friend_id ELSE f.user_id END AS friend_id
    FROM friendships f
    WHERE f.status = 'accepted'
      AND (f.user_id = requesting_user_id OR f.friend_id = requesting_user_id)
  ),
  friends_of_friends AS (
    SELECT 
      CASE WHEN f2.user_id = mf.friend_id THEN f2.friend_id ELSE f2.user_id END AS fof_id,
      mf.friend_id AS via_friend
    FROM my_friends mf
    JOIN friendships f2 ON f2.status = 'accepted'
      AND (f2.user_id = mf.friend_id OR f2.friend_id = mf.friend_id)
    WHERE CASE WHEN f2.user_id = mf.friend_id THEN f2.friend_id ELSE f2.user_id END != requesting_user_id
  ),
  -- Exclude people already friends or with pending requests
  existing AS (
    SELECT 
      CASE WHEN f.user_id = requesting_user_id THEN f.friend_id ELSE f.user_id END AS other_id
    FROM friendships f
    WHERE f.user_id = requesting_user_id OR f.friend_id = requesting_user_id
  )
  SELECT 
    fof.fof_id AS user_id,
    p.nickname,
    COUNT(DISTINCT fof.via_friend) AS mutual_count
  FROM friends_of_friends fof
  JOIN profiles p ON p.user_id = fof.fof_id
  WHERE fof.fof_id NOT IN (SELECT other_id FROM existing)
  GROUP BY fof.fof_id, p.nickname
  ORDER BY mutual_count DESC
  LIMIT 10;
END;
$$;
