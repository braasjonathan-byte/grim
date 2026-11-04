-- Adaptiv förbrukning av/på synkas till molnet (tidigare bara localStorage grim_adaptive_tdee_enabled_v1)
ALTER TABLE public.nutrition_goals ADD COLUMN IF NOT EXISTS adaptive_tdee_enabled boolean NOT NULL DEFAULT true;
