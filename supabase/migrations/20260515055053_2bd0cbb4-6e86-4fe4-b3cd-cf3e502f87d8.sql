REVOKE EXECUTE ON FUNCTION public.get_leaderboard(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer, integer) TO authenticated;