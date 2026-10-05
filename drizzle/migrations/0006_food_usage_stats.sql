CREATE TABLE public.food_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  food_source text NOT NULL,
  food_id uuid NOT NULL,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, food_source, food_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_usage_stats TO authenticated;
GRANT ALL ON public.food_usage_stats TO service_role;
ALTER TABLE public.food_usage_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own usage select" ON public.food_usage_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own usage insert" ON public.food_usage_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own usage update" ON public.food_usage_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own usage delete" ON public.food_usage_stats FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX food_usage_stats_user_idx ON public.food_usage_stats (user_id, last_used_at DESC);

CREATE OR REPLACE FUNCTION public.bump_food_usage(p_source text, p_food_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  INSERT INTO public.food_usage_stats (user_id, food_source, food_id, use_count, last_used_at)
  VALUES (auth.uid(), p_source, p_food_id, 1, now())
  ON CONFLICT (user_id, food_source, food_id)
  DO UPDATE SET use_count = public.food_usage_stats.use_count + 1, last_used_at = now();
$$;
GRANT EXECUTE ON FUNCTION public.bump_food_usage(text, uuid) TO authenticated;

INSERT INTO public.food_usage_stats (user_id, food_source, food_id, use_count, last_used_at)
SELECT user_id, src, fid, count(*)::int, max(created_at) FROM (
  SELECT user_id, 'food' src, food_id fid, created_at FROM public.meal_logs WHERE food_id IS NOT NULL
  UNION ALL SELECT user_id, 'custom_food', custom_food_id, created_at FROM public.meal_logs WHERE custom_food_id IS NOT NULL
  UNION ALL SELECT user_id, 'recipe', recipe_id, created_at FROM public.meal_logs WHERE recipe_id IS NOT NULL
) s GROUP BY user_id, src, fid
ON CONFLICT DO NOTHING;