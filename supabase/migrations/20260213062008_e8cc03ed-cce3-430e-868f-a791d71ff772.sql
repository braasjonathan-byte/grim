
-- Drop existing policies on vapid_keys
DROP POLICY IF EXISTS "Only service role can manage vapid_keys" ON public.vapid_keys;
DROP POLICY IF EXISTS "Public can read vapid public key" ON public.vapid_keys;

-- Deny anon and authenticated users all access
CREATE POLICY "Deny anon access to vapid_keys"
ON public.vapid_keys FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated access to vapid_keys"
ON public.vapid_keys FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Allow service_role full access (used by edge functions)
CREATE POLICY "Service role can manage vapid_keys"
ON public.vapid_keys FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
