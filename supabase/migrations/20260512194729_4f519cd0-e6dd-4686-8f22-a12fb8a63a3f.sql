-- Create table to remember reported AI-generated exercise descriptions
CREATE TABLE public.exercise_description_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_name text NOT NULL,
  exercise_name_lower text NOT NULL,
  reported_by uuid NOT NULL,
  reason text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_description_reports_name_lower ON public.exercise_description_reports(exercise_name_lower) WHERE resolved = false;

ALTER TABLE public.exercise_description_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access"
ON public.exercise_description_reports
AS PERMISSIVE FOR ALL
TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Authenticated users can read reports"
ON public.exercise_description_reports
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create reports"
ON public.exercise_description_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Admins can update reports"
ON public.exercise_description_reports
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reports"
ON public.exercise_description_reports
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));