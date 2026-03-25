
-- Popular events table
CREATE TABLE public.popular_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  event_type text NOT NULL DEFAULT 'annat',
  city text,
  country text NOT NULL DEFAULT 'Sverige'
);

ALTER TABLE public.popular_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read popular events" ON public.popular_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage popular events" ON public.popular_events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Deny anon access" ON public.popular_events FOR ALL TO anon USING (false) WITH CHECK (false);

-- Add end_date to user event countdowns
ALTER TABLE public.event_countdowns ADD COLUMN end_date date;
