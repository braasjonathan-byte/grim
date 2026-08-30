-- Shift Jessica's plan from weeks 8-20 to 1-13
UPDATE public.workout_plans
SET week = week - 7
WHERE user_id = 'a43870cc-1036-472b-92cc-b91dda3ddfcc' AND week > 0;

-- Fill the missing Monday in (new) week 1 using week 2's Monday
INSERT INTO public.workout_plans (user_id, week, day, session_name, details, tempo, is_circuit, created_at)
SELECT user_id, 1, day, session_name, details, tempo, is_circuit, created_at
FROM public.workout_plans
WHERE user_id = 'a43870cc-1036-472b-92cc-b91dda3ddfcc' AND week = 2 AND day = 'Mån'
ON CONFLICT (user_id, week, day) DO NOTHING;

-- Extend to a full 20 weeks by repeating the (identical) weekly pattern from week 13
INSERT INTO public.workout_plans (user_id, week, day, session_name, details, tempo, is_circuit, created_at)
SELECT p.user_id, w.wk, p.day, p.session_name, p.details, p.tempo, p.is_circuit, p.created_at
FROM public.workout_plans p
CROSS JOIN generate_series(14, 20) AS w(wk)
WHERE p.user_id = 'a43870cc-1036-472b-92cc-b91dda3ddfcc' AND p.week = 13
ON CONFLICT (user_id, week, day) DO NOTHING;