CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins write app settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.curated_recipe_overrides (
  recipe_id text PRIMARY KEY,
  data jsonb,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.curated_recipe_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.curated_recipe_overrides TO authenticated;
GRANT ALL ON public.curated_recipe_overrides TO service_role;
ALTER TABLE public.curated_recipe_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read recipe overrides" ON public.curated_recipe_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write recipe overrides" ON public.curated_recipe_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.exercise_unit_overrides (
  exercise_name_lower text PRIMARY KEY,
  exercise_name text NOT NULL,
  unit text CHECK (unit IN ('reps','seconds','meters')),
  bodyweight boolean,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.exercise_unit_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exercise_unit_overrides TO authenticated;
GRANT ALL ON public.exercise_unit_overrides TO service_role;
ALTER TABLE public.exercise_unit_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read unit overrides" ON public.exercise_unit_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write unit overrides" ON public.exercise_unit_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.post_reports ADD COLUMN resolved boolean NOT NULL DEFAULT false;
GRANT UPDATE ON public.post_reports TO authenticated;
CREATE POLICY "Admins resolve reports" ON public.post_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));