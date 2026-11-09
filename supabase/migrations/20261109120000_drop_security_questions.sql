-- Security-question password reset is retired (replaced by forgot-password via Gmail API).
-- Neither the RPC nor the table is used by the app any more; the table was empty when dropped.
DROP FUNCTION IF EXISTS public.get_my_security_question_indices();
DROP TABLE IF EXISTS public.security_answers;
