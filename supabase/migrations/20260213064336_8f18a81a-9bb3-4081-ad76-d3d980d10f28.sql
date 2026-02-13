
-- Create table for security questions/answers
CREATE TABLE public.security_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  question_index integer NOT NULL CHECK (question_index BETWEEN 0 AND 3),
  answer_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_index)
);

ALTER TABLE public.security_answers ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own answers
CREATE POLICY "Users can read own security answers"
ON public.security_answers FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own security answers"
ON public.security_answers FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own security answers"
ON public.security_answers FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own security answers"
ON public.security_answers FOR DELETE TO authenticated
USING (auth.uid() = user_id);
