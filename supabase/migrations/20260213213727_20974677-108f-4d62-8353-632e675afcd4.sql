
-- Allow admins to update any user's workout plans
CREATE POLICY "Admins can update all plans"
ON public.workout_plans
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert plans for any user
CREATE POLICY "Admins can insert all plans"
ON public.workout_plans
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any user's plans
CREATE POLICY "Admins can delete all plans"
ON public.workout_plans
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read all plans
CREATE POLICY "Admins can read all plans"
ON public.workout_plans
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any user's completions
CREATE POLICY "Admins can update all completions"
ON public.workout_completions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert completions for any user
CREATE POLICY "Admins can insert all completions"
ON public.workout_completions
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any user's completions
CREATE POLICY "Admins can delete all completions"
ON public.workout_completions
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read all completions
CREATE POLICY "Admins can read all completions"
ON public.workout_completions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));
