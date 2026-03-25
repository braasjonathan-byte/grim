
CREATE TABLE public.event_countdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  event_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'halvmaraton',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.event_countdowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events" ON public.event_countdowns FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.event_countdowns FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.event_countdowns FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.event_countdowns FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Deny anon access" ON public.event_countdowns FOR ALL TO anon USING (false) WITH CHECK (false);
