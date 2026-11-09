-- Server-only key/value config (e.g. Gmail API credentials for forgot-password).
-- Values are inserted out-of-band, never committed. RLS on with NO policies → only service role can read.
CREATE TABLE IF NOT EXISTS public.app_private_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_private_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_private_config FROM anon, authenticated;
COMMENT ON TABLE public.app_private_config IS 'Server-only config (service role). RLS on, no policies.';
