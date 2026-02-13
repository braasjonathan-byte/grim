ALTER TABLE public.profiles ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET must_change_password = true;
