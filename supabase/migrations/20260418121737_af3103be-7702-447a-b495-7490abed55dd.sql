UPDATE auth.users
SET encrypted_password = crypt('TuMiWi123?!', gen_salt('bf')),
    updated_at = now()
WHERE id = '801c5f0d-448a-4700-8688-f7f622a9808f';

UPDATE public.profiles
SET must_change_password = true
WHERE user_id = '801c5f0d-448a-4700-8688-f7f622a9808f';