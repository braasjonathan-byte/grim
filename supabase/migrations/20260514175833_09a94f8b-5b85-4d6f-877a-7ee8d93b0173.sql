
CREATE POLICY "Creator can read own group"
ON public.chat_groups FOR SELECT
TO authenticated
USING (auth.uid() = created_by);
