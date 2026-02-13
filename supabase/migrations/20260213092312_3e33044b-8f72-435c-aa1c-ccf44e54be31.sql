
-- Drop the existing permissive-to-all SELECT policy
DROP POLICY IF EXISTS "Anyone can read custom exercises" ON public.custom_exercises;

-- Restrict SELECT to authenticated users only
CREATE POLICY "Authenticated users can read custom exercises"
ON public.custom_exercises
FOR SELECT
TO authenticated
USING (true);
