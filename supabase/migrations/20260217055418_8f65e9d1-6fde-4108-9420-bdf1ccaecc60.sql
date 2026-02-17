CREATE OR REPLACE FUNCTION public.get_leaderboard(filter_year integer, filter_month integer DEFAULT NULL::integer)
 RETURNS TABLE(user_id uuid, nickname text, avatar_url text, done_count bigint, is_honorary boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  
  RETURN QUERY
  SELECT 
    p.user_id,
    p.nickname,
    p.avatar_url,
    COUNT(wc.id) AS done_count,
    p.is_honorary
  FROM profiles p
  LEFT JOIN workout_completions wc ON wc.user_id = p.user_id
    AND wc.done = true
    AND EXTRACT(YEAR FROM wc.updated_at) = filter_year
    AND (filter_month IS NULL OR EXTRACT(MONTH FROM wc.updated_at) = filter_month)
    AND EXISTS (
      SELECT 1 FROM workout_plans wp
      WHERE wp.user_id = wc.user_id
        AND wp.week = wc.week
        AND wp.day = wc.day
        AND wp.details IS NOT NULL
        AND TRIM(wp.details) != ''
    )
  GROUP BY p.user_id, p.nickname, p.avatar_url, p.is_honorary
  HAVING COUNT(wc.id) > 0
  ORDER BY done_count DESC;
END;
$function$