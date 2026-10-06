ALTER TABLE public.meal_logs ADD COLUMN nova_group smallint, ADD COLUMN sugar_g numeric;
ALTER TABLE public.custom_foods ADD COLUMN nova_group smallint, ADD COLUMN sugar_g numeric;
ALTER TABLE public.foods ADD COLUMN nova_group smallint, ADD COLUMN sugar_g numeric;