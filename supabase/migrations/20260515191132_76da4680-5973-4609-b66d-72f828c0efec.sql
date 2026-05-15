ALTER TABLE public.workout_comments REPLICA IDENTITY FULL;
ALTER TABLE public.workout_likes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_likes;