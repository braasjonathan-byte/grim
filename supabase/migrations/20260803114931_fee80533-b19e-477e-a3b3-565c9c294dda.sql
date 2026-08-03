
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(current_setting('app.allow_protected_profile', true), '') = 'on'
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.is_honorary := OLD.is_honorary;
  NEW.protein_bars := OLD.protein_bars;
  NEW.referral_code := OLD.referral_code;
  NEW.referred_by := OLD.referred_by;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_protein_bar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.done = true AND (OLD.done IS NULL OR OLD.done = false) THEN
    IF EXISTS (
      SELECT 1 FROM workout_plans wp
      WHERE wp.user_id = NEW.user_id AND wp.week = NEW.week AND wp.day = NEW.day
      AND wp.details IS NOT NULL AND TRIM(wp.details) != ''
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM workout_completions wc
        WHERE wc.user_id = NEW.user_id
          AND wc.done = true
          AND wc.id != NEW.id
          AND DATE(wc.updated_at) = CURRENT_DATE
          AND EXISTS (
            SELECT 1 FROM workout_plans wp2
            WHERE wp2.user_id = wc.user_id AND wp2.week = wc.week AND wp2.day = wc.day
            AND wp2.details IS NOT NULL AND TRIM(wp2.details) != ''
          )
      ) THEN
        PERFORM set_config('app.allow_protected_profile', 'on', true);
        UPDATE profiles SET protein_bars = protein_bars + 1 WHERE user_id = NEW.user_id;
        PERFORM set_config('app.allow_protected_profile', 'off', true);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_avatar_item(p_item_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_price integer;
  v_balance integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  IF EXISTS (SELECT 1 FROM avatar_owned_items WHERE user_id = auth.uid() AND item_id = p_item_id) THEN
    RETURN false;
  END IF;

  SELECT price INTO v_price FROM avatar_shop_items WHERE id = p_item_id AND is_active = true;
  IF v_price IS NULL THEN RETURN false; END IF;

  SELECT protein_bars INTO v_balance FROM profiles WHERE user_id = auth.uid();
  IF v_balance < v_price THEN RETURN false; END IF;

  PERFORM set_config('app.allow_protected_profile', 'on', true);
  UPDATE profiles SET protein_bars = protein_bars - v_price WHERE user_id = auth.uid();
  PERFORM set_config('app.allow_protected_profile', 'off', true);

  INSERT INTO avatar_owned_items (user_id, item_id) VALUES (auth.uid(), p_item_id);

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_referral(referral_code_input text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  referrer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT user_id INTO referrer_id FROM profiles WHERE referral_code = referral_code_input;
  IF referrer_id IS NULL THEN RETURN false; END IF;
  IF referrer_id = auth.uid() THEN RETURN false; END IF;

  PERFORM set_config('app.allow_protected_profile', 'on', true);
  UPDATE profiles SET referred_by = referrer_id WHERE user_id = auth.uid() AND referred_by IS NULL;
  UPDATE profiles SET is_honorary = true WHERE user_id = referrer_id;
  PERFORM set_config('app.allow_protected_profile', 'off', true);

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := substr(md5(random()::text || NEW.user_id::text), 1, 8);
  END IF;
  RETURN NEW;
END;
$function$;
