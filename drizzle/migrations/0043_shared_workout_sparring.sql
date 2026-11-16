ALTER TABLE public.workout_plans ADD COLUMN sparring_reference jsonb;
CREATE OR REPLACE FUNCTION public.create_workout_sparring(_post_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.social_posts%ROWTYPE; c public.workout_completions%ROWTYPE; roster text; title text; new_id uuid; new_day text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;
 SELECT * INTO p FROM public.social_posts WHERE id = _post_id;
 IF p.id IS NULL OR p.user_id = auth.uid() OR p.workout_week IS NULL OR p.workout_day IS NULL THEN RAISE EXCEPTION 'Shared workout unavailable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.friendships WHERE status='accepted' AND ((user_id=auth.uid() AND friend_id=p.user_id) OR (friend_id=auth.uid() AND user_id=p.user_id))) OR public.are_blocked(auth.uid(), p.user_id) THEN RAISE EXCEPTION 'Accepted friend required'; END IF;
 SELECT * INTO c FROM public.workout_completions WHERE user_id=p.user_id AND week=p.workout_week AND day=p.workout_day AND done=true AND NOT coalesce(skipped,false);
 IF c.id IS NULL THEN RAISE EXCEPTION 'Completed workout unavailable'; END IF;
 SELECT string_agg(details, E'\n' ORDER BY id), string_agg(session_name, ' + ' ORDER BY id) INTO roster,title FROM public.workout_plans WHERE user_id=p.user_id AND week=p.workout_week AND day=p.workout_day;
 IF coalesce(trim(roster),'')='' THEN RAISE EXCEPTION 'Exercise roster unavailable'; END IF;
 new_day := to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') || '_' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
 INSERT INTO public.workout_plans(user_id,week,day,session_name,details,sparring_reference) VALUES(auth.uid(),0,new_day,title,roster,jsonb_build_object('post_id',p.id,'nickname',(SELECT nickname FROM public.profiles WHERE user_id=p.user_id),'logged_weights',c.logged_weights)) RETURNING id INTO new_id;
 RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_workout_sparring(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workout_sparring(uuid) TO authenticated;
