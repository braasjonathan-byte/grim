
-- Function to get nicknames for suggestion user_ids (admin only)
CREATE OR REPLACE FUNCTION public.get_suggestion_nicknames(user_ids text[])
RETURNS TABLE(user_id text, nickname text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_jonne() THEN
    -- Non-admin: only return own nickname
    RETURN QUERY
    SELECT p.user_id::text, p.nickname
    FROM profiles p
    WHERE p.user_id::text = ANY(user_ids)
      AND p.user_id = auth.uid();
  ELSE
    -- Admin: return all nicknames
    RETURN QUERY
    SELECT p.user_id::text, p.nickname
    FROM profiles p
    WHERE p.user_id::text = ANY(user_ids);
  END IF;
END;
$$;
