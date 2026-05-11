
-- Rename Jonne to Grim
UPDATE public.profiles SET nickname = 'Grim' WHERE LOWER(nickname) = 'jonne';

-- Update is_jonne() to keep working under the new nickname
CREATE OR REPLACE FUNCTION public.is_jonne()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND LOWER(nickname) = 'grim'
  )
$$;
