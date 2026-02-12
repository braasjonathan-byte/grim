
-- Table for storing workout completions synced across devices
CREATE TABLE public.workout_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile TEXT NOT NULL CHECK (profile IN ('J', 'W')),
  week INTEGER NOT NULL,
  day TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  user_comment TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile, week, day)
);

-- Public access since we use PIN protection at app level (no auth.users involved)
ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write (PIN protection is app-level, no auth needed)
CREATE POLICY "Allow public read" ON public.workout_completions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.workout_completions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.workout_completions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.workout_completions FOR DELETE USING (true);

-- Table for profile PINs
CREATE TABLE public.profile_pins (
  profile TEXT PRIMARY KEY CHECK (profile IN ('J', 'W')),
  pin_hash TEXT NOT NULL
);

ALTER TABLE public.profile_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read pins" ON public.profile_pins FOR SELECT USING (true);
CREATE POLICY "Allow public insert pins" ON public.profile_pins FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update pins" ON public.profile_pins FOR UPDATE USING (true);
