CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  food_number integer,
  group_name text,
  kcal numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fiber_g numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_foods_name_lower ON public.foods (lower(name));
CREATE INDEX idx_foods_name_trgm ON public.foods USING gin (name gin_trgm_ops);
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read foods" ON public.foods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage foods" ON public.foods FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.custom_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kcal numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fiber_g numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own custom foods" ON public.custom_foods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own custom foods" ON public.custom_foods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own custom foods" ON public.custom_foods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own custom foods" ON public.custom_foods FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  servings numeric NOT NULL DEFAULT 1,
  instructions text,
  visibility text NOT NULL DEFAULT 'private',
  kcal_per_serving numeric NOT NULL DEFAULT 0,
  fat_g_per_serving numeric NOT NULL DEFAULT 0,
  protein_g_per_serving numeric NOT NULL DEFAULT 0,
  carbs_g_per_serving numeric NOT NULL DEFAULT 0,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own recipes" ON public.recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated read public recipes" ON public.recipes FOR SELECT TO authenticated USING (visibility = 'public');
CREATE POLICY "Users insert own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_recipes_updated BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.nutrition_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_kcal integer NOT NULL DEFAULT 2000,
  protein_g integer NOT NULL DEFAULT 100,
  fat_g integer NOT NULL DEFAULT 70,
  carbs_g integer NOT NULL DEFAULT 250,
  activity_level text NOT NULL DEFAULT 'moderate',
  goal_type text NOT NULL DEFAULT 'maintain',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON public.nutrition_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_nutrition_goals_updated BEFORE UPDATE ON public.nutrition_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'lunch',
  food_id uuid,
  custom_food_id uuid,
  recipe_id uuid,
  item_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 100,
  unit text NOT NULL DEFAULT 'g',
  kcal numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meal_logs_user_date ON public.meal_logs (user_id, log_date);
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own meal logs" ON public.meal_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own meal logs" ON public.meal_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own meal logs" ON public.meal_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own meal logs" ON public.meal_logs FOR DELETE USING (auth.uid() = user_id);

-- Optional: also store weight/age on profiles already exists; nutrition needs height_cm too
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm numeric;