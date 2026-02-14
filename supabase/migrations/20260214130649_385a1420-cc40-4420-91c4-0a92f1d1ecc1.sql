
-- Drop the existing SELECT policy that exposes answer_hash to clients
DROP POLICY IF EXISTS "Users can read own security answers" ON public.security_answers;

-- Create a security definer function that only returns question_index (not answer_hash)
CREATE OR REPLACE FUNCTION public.get_my_security_question_indices()
RETURNS TABLE(question_index integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.question_index
  FROM public.security_answers sa
  WHERE sa.user_id = auth.uid()
  ORDER BY sa.question_index ASC;
$$;
