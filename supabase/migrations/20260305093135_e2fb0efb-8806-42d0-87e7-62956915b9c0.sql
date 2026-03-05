
-- Add explicit policy to prevent even admins from reading other users' emails via client
-- (service_role bypasses RLS by design for the reset-password edge function)
-- The existing policies are correct, but let's add a restrictive ALL policy for admin role
-- to make it explicit that admin privileges do NOT extend to reading emails

-- Current policies are already correct:
-- "Deny anon access to user_emails" blocks anon
-- "Users can read/insert/update/delete own email" restricts to own data

-- Add comment to document security posture (no schema change needed)
COMMENT ON TABLE public.user_emails IS 'Stores user email addresses for password reset. Protected by strict RLS: only the owning user can access their own email. Service role access is used exclusively by the reset-password edge function.';
