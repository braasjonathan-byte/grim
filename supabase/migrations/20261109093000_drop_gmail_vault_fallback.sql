-- Mail now goes via the Gmail API (edge secrets GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET /
-- GMAIL_REFRESH_TOKEN); the SMTP app-password vault fallback is no longer used.
DROP FUNCTION IF EXISTS public.get_gmail_app_password();
