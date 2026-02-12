
-- Drop the overly permissive policy
DROP POLICY "Anyone can read profiles" ON public.profiles;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can read profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);
