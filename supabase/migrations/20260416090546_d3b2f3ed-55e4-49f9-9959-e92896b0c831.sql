
CREATE TABLE public.saved_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  details TEXT NOT NULL,
  tempo TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_workouts ENABLE ROW LEVEL SECURITY;

-- Users can read their own workouts
CREATE POLICY "Users can read own saved workouts"
ON public.saved_workouts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can read all public workouts
CREATE POLICY "Users can read public saved workouts"
ON public.saved_workouts
FOR SELECT
TO authenticated
USING (visibility = 'public');

-- Users can create their own workouts
CREATE POLICY "Users can create own saved workouts"
ON public.saved_workouts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own workouts
CREATE POLICY "Users can update own saved workouts"
ON public.saved_workouts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own workouts
CREATE POLICY "Users can delete own saved workouts"
ON public.saved_workouts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all saved workouts"
ON public.saved_workouts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Deny anon
CREATE POLICY "Deny anon access to saved workouts"
ON public.saved_workouts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
