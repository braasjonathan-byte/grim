
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / background jobs and admins may change protected fields.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.is_honorary := OLD.is_honorary;
  NEW.protein_bars := OLD.protein_bars;
  NEW.referral_code := OLD.referral_code;
  NEW.referred_by := OLD.referred_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();
