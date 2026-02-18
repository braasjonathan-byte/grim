
-- Drop the broken deny-all policy that blocks everyone
DROP POLICY IF EXISTS "Deny anon access to user_roles" ON public.user_roles;

-- Re-create it to only target the anon role
CREATE POLICY "Deny anon access to user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Drop and re-create the read policy as PERMISSIVE so authenticated users can read their own role
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;

CREATE POLICY "Users can read own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
