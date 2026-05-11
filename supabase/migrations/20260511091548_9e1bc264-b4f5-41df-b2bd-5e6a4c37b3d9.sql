
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  grim_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nickname');

  SELECT user_id INTO grim_id FROM public.profiles WHERE LOWER(nickname) = 'grim' LIMIT 1;

  IF grim_id IS NOT NULL AND grim_id <> NEW.id THEN
    INSERT INTO public.friendships (user_id, friend_id, status)
    VALUES (NEW.id, grim_id, 'accepted')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
