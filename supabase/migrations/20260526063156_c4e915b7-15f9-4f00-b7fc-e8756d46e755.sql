ALTER TABLE public.nutrition_goals
  ADD COLUMN IF NOT EXISTS meal_slots text[] NOT NULL DEFAULT ARRAY['frukost','lunch','middag','mellanmål'];