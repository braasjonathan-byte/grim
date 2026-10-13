ALTER TABLE public.nutrition_goals ADD COLUMN weekly_loss_kg numeric;
ALTER TABLE public.nutrition_goals ADD CONSTRAINT nutrition_goals_weekly_loss_kg_check CHECK (weekly_loss_kg IS NULL OR (weekly_loss_kg >= 0 AND weekly_loss_kg <= 1.5));
COMMENT ON COLUMN public.nutrition_goals.weekly_loss_kg IS 'Önskad viktminskning i kg per vecka (0–1,5); dagligt kcal-mål räknas ut från detta.';