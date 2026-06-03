DROP POLICY IF EXISTS "Authenticated users can read reports" ON public.exercise_description_reports;
CREATE POLICY "Admins and reporters can read reports"
ON public.exercise_description_reports
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR reported_by = auth.uid());