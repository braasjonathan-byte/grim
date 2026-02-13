
-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN email text;

-- Also fix vapid_keys RLS (security findings)
ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage vapid_keys"
ON public.vapid_keys
FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Public can read vapid public key"
ON public.vapid_keys
FOR SELECT
USING (true);
