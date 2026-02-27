
-- Update get_suggestion_nicknames to allow all authenticated users to see nicknames for suggestions
CREATE OR REPLACE FUNCTION public.get_suggestion_nicknames(user_ids text[])
 RETURNS TABLE(user_id text, nickname text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id::text, p.nickname
  FROM profiles p
  WHERE p.user_id::text = ANY(user_ids);
END;
$function$;
