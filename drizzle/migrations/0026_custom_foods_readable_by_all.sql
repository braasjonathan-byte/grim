DROP POLICY "Users read own custom foods" ON public.custom_foods;
CREATE POLICY "Authenticated users read all custom foods"
  ON public.custom_foods FOR SELECT
  TO authenticated
  USING (true);