
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Everyone can read their own role
CREATE POLICY "Users can read own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Deny anon
CREATE POLICY "Deny anon access to user_roles"
ON public.user_roles FOR ALL TO anon
USING (false) WITH CHECK (false);

-- Auto-assign member role on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'member')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_assign_role
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_profile_role();

-- Assign member role to all existing users who don't have one
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'member' FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read announcements
CREATE POLICY "Authenticated users can read announcements"
ON public.announcements FOR SELECT TO authenticated
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can create announcements"
ON public.announcements FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete announcements"
ON public.announcements FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Deny anon
CREATE POLICY "Deny anon access to announcements"
ON public.announcements FOR ALL TO anon
USING (false) WITH CHECK (false);
