
-- Drop old PIN-based tables
DROP POLICY IF EXISTS "Allow public read" ON public.workout_completions;
DROP POLICY IF EXISTS "Allow public insert" ON public.workout_completions;
DROP POLICY IF EXISTS "Allow public update" ON public.workout_completions;
DROP POLICY IF EXISTS "Allow public delete" ON public.workout_completions;
DROP TABLE IF EXISTS public.workout_completions;

DROP POLICY IF EXISTS "Allow public read pins" ON public.profile_pins;
DROP POLICY IF EXISTS "Allow public insert pins" ON public.profile_pins;
DROP POLICY IF EXISTS "Allow public update pins" ON public.profile_pins;
DROP TABLE IF EXISTS public.profile_pins;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nickname TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Workout plans (each row = one day's workout)
CREATE TABLE public.workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  day TEXT NOT NULL,
  session_name TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  tempo TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week, day)
);

ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can read plans (friends need to see them)
CREATE POLICY "Anyone can read plans" ON public.workout_plans
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own plans" ON public.workout_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans" ON public.workout_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans" ON public.workout_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Workout completions
CREATE TABLE public.workout_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  day TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  user_comment TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week, day)
);

ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

-- Anyone can read completions (friends need to see them)
CREATE POLICY "Anyone can read completions" ON public.workout_completions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own completions" ON public.workout_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own completions" ON public.workout_completions
  FOR UPDATE USING (auth.uid() = user_id);

-- Friendships (bidirectional: user_id sends request to friend_id)
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they received" ON public.friendships
  FOR UPDATE USING (auth.uid() = friend_id);

CREATE POLICY "Users can delete their friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nickname');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_workout_plans_updated_at
  BEFORE UPDATE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workout_completions_updated_at
  BEFORE UPDATE ON public.workout_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
