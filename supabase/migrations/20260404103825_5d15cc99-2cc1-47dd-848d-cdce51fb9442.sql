DROP POLICY IF EXISTS "Users can update own exercises" ON public.custom_exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON public.custom_exercises;

CREATE POLICY "Users can update own exercises"
ON public.custom_exercises
FOR UPDATE
TO public
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own exercises"
ON public.custom_exercises
FOR DELETE
TO public
USING (auth.uid() = created_by);

CREATE POLICY "Admins can update any custom exercise"
ON public.custom_exercises
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any custom exercise"
ON public.custom_exercises
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));