
CREATE TABLE public.social_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_post_comments_post_id ON public.social_post_comments(post_id);

ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read comments"
ON public.social_post_comments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Deny anon comments"
ON public.social_post_comments FOR ALL
TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Users can insert own comments"
ON public.social_post_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.social_post_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment"
ON public.social_post_comments FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
