-- Fix: Restrict popular_events INSERT to admins only
DROP POLICY IF EXISTS "Authenticated can insert popular events" ON public.popular_events;

CREATE POLICY "Only admins can insert popular events"
ON public.popular_events
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));