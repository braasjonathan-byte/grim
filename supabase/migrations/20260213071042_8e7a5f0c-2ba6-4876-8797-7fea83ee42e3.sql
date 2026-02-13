
-- Create secure email storage table (only owner can access)
CREATE TABLE public.user_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own email"
ON public.user_emails FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email"
ON public.user_emails FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email"
ON public.user_emails FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email"
ON public.user_emails FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Migrate existing emails
INSERT INTO public.user_emails (user_id, email)
SELECT user_id, email FROM public.profiles WHERE email IS NOT NULL AND email != ''
ON CONFLICT (user_id) DO NOTHING;

-- Drop email column from profiles
ALTER TABLE public.profiles DROP COLUMN email;
