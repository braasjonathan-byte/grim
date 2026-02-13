
-- Table to store temporary passwords without changing the real one
CREATE TABLE public.temp_passwords (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  temp_password text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  used boolean NOT NULL DEFAULT false
);

ALTER TABLE public.temp_passwords ENABLE ROW LEVEL SECURITY;

-- Only service role should access this table
CREATE POLICY "Deny anon access to temp_passwords"
ON public.temp_passwords FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated access to temp_passwords"
ON public.temp_passwords FOR ALL TO authenticated
USING (false) WITH CHECK (false);
