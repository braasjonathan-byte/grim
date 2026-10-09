ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS main_sport text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ftp_watt integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_ftp_watt_range CHECK (ftp_watt IS NULL OR (ftp_watt BETWEEN 30 AND 700));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_len CHECK (display_name IS NULL OR char_length(display_name) <= 40);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_main_sport_len CHECK (main_sport IS NULL OR char_length(main_sport) <= 40);