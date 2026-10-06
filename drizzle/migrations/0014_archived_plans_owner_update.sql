GRANT UPDATE ON public.archived_plans TO authenticated;
CREATE POLICY "Users can update own archived plans" ON public.archived_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);