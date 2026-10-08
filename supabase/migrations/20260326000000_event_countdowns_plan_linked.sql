-- Marks event_countdowns rows that were auto-created when a plan template with
-- isEventPrep was started, so switching/archiving the plan can clean them up
-- instead of leaving stale countdowns (e.g. an old competition) behind.
ALTER TABLE public.event_countdowns ADD COLUMN IF NOT EXISTS linked_plan boolean NOT NULL DEFAULT false;
