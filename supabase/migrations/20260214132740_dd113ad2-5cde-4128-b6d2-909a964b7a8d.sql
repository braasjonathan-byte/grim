-- Add unique constraint on nickname (case-insensitive)
CREATE UNIQUE INDEX idx_profiles_nickname_unique ON public.profiles (LOWER(nickname));
