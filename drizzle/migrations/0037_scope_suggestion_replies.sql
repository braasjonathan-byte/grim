DROP POLICY "Authenticated users can read replies" ON public.suggestion_replies;
CREATE POLICY "Suggestion owner and admins can read replies" ON public.suggestion_replies
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.suggestions s WHERE s.id = suggestion_replies.suggestion_id AND s.user_id = (auth.uid())::text)
);