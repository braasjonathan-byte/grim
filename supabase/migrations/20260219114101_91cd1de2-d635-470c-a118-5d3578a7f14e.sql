
-- Create daily challenge completions table
CREATE TABLE public.daily_challenge_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_date DATE NOT NULL,
  challenge_text TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique: one completion per user per day
CREATE UNIQUE INDEX idx_daily_challenge_user_date ON public.daily_challenge_completions (user_id, challenge_date);

-- Enable RLS
ALTER TABLE public.daily_challenge_completions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own challenge completions"
ON public.daily_challenge_completions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own challenge completions"
ON public.daily_challenge_completions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own challenge completions"
ON public.daily_challenge_completions FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Deny anon access to daily challenges"
ON public.daily_challenge_completions FOR ALL
USING (false)
WITH CHECK (false);
