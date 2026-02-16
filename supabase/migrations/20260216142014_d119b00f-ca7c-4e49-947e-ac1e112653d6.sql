
-- 1. Add referral and honorary columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS is_honorary boolean NOT NULL DEFAULT false;

-- Generate referral codes for existing profiles
UPDATE public.profiles SET referral_code = substr(md5(random()::text || user_id::text), 1, 8) WHERE referral_code IS NULL;

-- Mark Jonne as honorary
UPDATE public.profiles SET is_honorary = true WHERE LOWER(nickname) = 'jonne';

-- Trigger to auto-generate referral code on new profile
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := substr(md5(random()::text || NEW.user_id::text), 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Function to process referral after signup
CREATE OR REPLACE FUNCTION public.process_referral(referral_code_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  referrer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  
  SELECT user_id INTO referrer_id FROM profiles WHERE referral_code = referral_code_input;
  IF referrer_id IS NULL THEN RETURN false; END IF;
  IF referrer_id = auth.uid() THEN RETURN false; END IF;
  
  UPDATE profiles SET referred_by = referrer_id WHERE user_id = auth.uid() AND referred_by IS NULL;
  UPDATE profiles SET is_honorary = true WHERE user_id = referrer_id;
  
  RETURN true;
END;
$$;

-- 2. PR stars table
CREATE TABLE public.pr_stars (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  exercise text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise)
);
ALTER TABLE public.pr_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own stars" ON public.pr_stars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stars" ON public.pr_stars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stars" ON public.pr_stars FOR DELETE USING (auth.uid() = user_id);

-- 3. PR goals table
CREATE TABLE public.pr_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  exercise text NOT NULL,
  target_weight numeric NOT NULL,
  target_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise)
);
ALTER TABLE public.pr_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own goals" ON public.pr_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.pr_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.pr_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.pr_goals FOR DELETE USING (auth.uid() = user_id);

-- 4. Leaderboard function (security definer to read all completions)
CREATE OR REPLACE FUNCTION public.get_leaderboard(filter_year int, filter_month int DEFAULT NULL)
RETURNS TABLE(user_id uuid, nickname text, avatar_url text, done_count bigint, is_honorary boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  
  RETURN QUERY
  SELECT 
    p.user_id,
    p.nickname,
    p.avatar_url,
    COUNT(wc.id) AS done_count,
    p.is_honorary
  FROM profiles p
  LEFT JOIN workout_completions wc ON wc.user_id = p.user_id
    AND wc.done = true
    AND EXTRACT(YEAR FROM wc.updated_at) = filter_year
    AND (filter_month IS NULL OR EXTRACT(MONTH FROM wc.updated_at) = filter_month)
  GROUP BY p.user_id, p.nickname, p.avatar_url, p.is_honorary
  HAVING COUNT(wc.id) > 0
  ORDER BY done_count DESC;
END;
$$;
