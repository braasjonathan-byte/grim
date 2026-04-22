-- Update handle_new_user to auto-friend Jonne for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jonne_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nickname');

  -- Find Jonne
  SELECT user_id INTO jonne_id FROM public.profiles WHERE LOWER(nickname) = 'jonne' LIMIT 1;

  -- Auto-create accepted friendship with Jonne (skip if this IS Jonne)
  IF jonne_id IS NOT NULL AND jonne_id <> NEW.id THEN
    INSERT INTO public.friendships (user_id, friend_id, status)
    VALUES (NEW.id, jonne_id, 'accepted')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: make all existing users friends with Jonne
DO $$
DECLARE
  jonne_id uuid;
BEGIN
  SELECT user_id INTO jonne_id FROM public.profiles WHERE LOWER(nickname) = 'jonne' LIMIT 1;
  IF jonne_id IS NULL THEN RETURN; END IF;

  -- Insert accepted friendships for all users that don't already have one with Jonne
  INSERT INTO public.friendships (user_id, friend_id, status)
  SELECT p.user_id, jonne_id, 'accepted'
  FROM public.profiles p
  WHERE p.user_id <> jonne_id
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE ((f.user_id = p.user_id AND f.friend_id = jonne_id)
          OR (f.friend_id = p.user_id AND f.user_id = jonne_id))
    );

  -- Promote any existing pending friendships with Jonne to accepted
  UPDATE public.friendships
  SET status = 'accepted'
  WHERE status <> 'accepted'
    AND (user_id = jonne_id OR friend_id = jonne_id);
END $$;