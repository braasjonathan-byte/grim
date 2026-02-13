
-- Drop the old permissive policy
DROP POLICY "Users can view suggestions" ON public.suggestions;

-- Users can view only their own suggestions
CREATE POLICY "Users can view own suggestions"
ON public.suggestions FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions"
ON public.suggestions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
