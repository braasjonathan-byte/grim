
-- Table to store archived workout plans
CREATE TABLE public.archived_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_name TEXT NOT NULL DEFAULT '',
  plan_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.archived_plans ENABLE ROW LEVEL SECURITY;

-- Users can only access their own archives
CREATE POLICY "Users can read own archives"
ON public.archived_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own archives"
ON public.archived_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own archives"
ON public.archived_plans FOR DELETE
USING (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "Admins can read all archives"
ON public.archived_plans FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
