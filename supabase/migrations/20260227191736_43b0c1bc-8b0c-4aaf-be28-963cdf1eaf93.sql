
-- 1. Allow all authenticated users to read all suggestions
DROP POLICY IF EXISTS "Users can view own suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Admins can view all suggestions" ON public.suggestions;

CREATE POLICY "Authenticated users can read all suggestions"
ON public.suggestions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Create suggestion_replies table for admin comments
CREATE TABLE public.suggestion_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id uuid NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestion_replies ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read replies
CREATE POLICY "Authenticated users can read replies"
ON public.suggestion_replies
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can insert replies
CREATE POLICY "Admins can insert replies"
ON public.suggestion_replies
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete replies
CREATE POLICY "Admins can delete replies"
ON public.suggestion_replies
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Deny anon access
CREATE POLICY "Deny anon access to suggestion_replies"
ON public.suggestion_replies
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
