
-- Table for workout reminder preferences
CREATE TABLE public.workout_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  reminder_time time NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'Europe/Stockholm',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workout_reminders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own reminders"
  ON public.workout_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON public.workout_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON public.workout_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON public.workout_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Service role access for the cron edge function
CREATE POLICY "Service role full access reminders"
  ON public.workout_reminders FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_workout_reminders_updated_at
  BEFORE UPDATE ON public.workout_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
