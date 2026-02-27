
-- Table for manual PR overrides
CREATE TABLE public.pr_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  exercise text NOT NULL,
  weight numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise)
);

ALTER TABLE public.pr_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own overrides" ON public.pr_overrides FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own overrides" ON public.pr_overrides FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own overrides" ON public.pr_overrides FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own overrides" ON public.pr_overrides FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Friends can read overrides" ON public.pr_overrides FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND ((f.user_id = auth.uid() AND f.friend_id = pr_overrides.user_id)
      OR (f.friend_id = auth.uid() AND f.user_id = pr_overrides.user_id))
  )
);
