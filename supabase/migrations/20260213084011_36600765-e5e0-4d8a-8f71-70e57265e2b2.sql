
-- Drop existing select policy
DROP POLICY "Users can view their own suggestions" ON public.suggestions;

-- Create new select policy: jonne sees all, others see own
CREATE OR REPLACE FUNCTION public.is_jonne()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND nickname = 'jonne'
  )
$$;

CREATE POLICY "Users can view suggestions"
ON public.suggestions FOR SELECT
USING (
  (auth.uid())::text = user_id
  OR public.is_jonne()
);
