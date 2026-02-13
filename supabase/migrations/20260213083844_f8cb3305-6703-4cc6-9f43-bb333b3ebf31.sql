
CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own suggestions"
ON public.suggestions FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own suggestions"
ON public.suggestions FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Deny anon access to suggestions"
ON public.suggestions FOR ALL TO anon
USING (false) WITH CHECK (false);
