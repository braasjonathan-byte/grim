## Triathlon Training Plan — Feature Plan

A new training category "Triathlon" with its own wizard, dynamic calendar, and adaptive feedback loop. Separated from existing workout plans so it doesn't collide with the current strength plan system.

### 1. Database (new tables)

- `triathlon_plans` — one active plan per user
  - `user_id`, `goal_type` ('duration' | 'race_date'), `duration_weeks`, `race_date`, `start_date`
  - levels: `swim_level`, `bike_level`, `run_level` ('beginner'|'intermediate'|'advanced')
  - volumes: `swim_km_week`, `bike_km_week`, `run_km_week`
  - `sessions_per_week`, `long_session_days` (text[]), `include_strength` (bool)
  - `created_at`, `updated_at`

- `triathlon_sessions` — generated workouts
  - `plan_id`, `user_id`, `session_date`, `week`, `day_of_week`
  - `discipline` ('swim'|'bike'|'run'|'strength'|'rest')
  - `duration_min`, `distance_km`, `intensity` (RPE 1-10 or zone label), `description`
  - `is_long_session` (bool)
  - `completed` (bool), `completed_at`

- `triathlon_session_logs` — feedback
  - `session_id`, `user_id`, `felt` ('easy'|'good'|'hard'|'too_hard')
  - `had_pain` (bool), `pain_area` (text), `pain_level` (int 1-10)
  - `notes`

All tables: RLS owner-only + service_role, GRANTs to authenticated.

### 2. Plan generation logic (client-side, `src/lib/triathlonPlanner.ts`)

Inputs → weekly template based on `sessions_per_week` (3-7) and `include_strength`. Distributes swim/bike/run roughly equal, places long sessions on chosen weekend days, scales weekly volume by level (beginner = 60%, intermediate = 100%, advanced = 130% of input baseline). Builds a 4-week mesocycle (3 build + 1 recovery) repeating across the total weeks (computed from `duration_weeks` or `race_date - today`). Final week = taper.

Intensity per session: easy/long → RPE 4-5, tempo → RPE 6-7, intervals → RPE 8-9.

### 3. UI

- New tab/category "Triathlon" in the main nav/tools area
- `TriathlonView.tsx` — entry: shows wizard if no plan, else calendar
- `TriathlonWizard.tsx` — 4-step wizard:
  1. Goal (duration vs race date)
  2. Levels + current weekly volumes per discipline
  3. Availability (sessions/week, long-session days)
  4. Strength toggle + summary → generate
- `TriathlonCalendar.tsx` — week view with session cards (discipline icon, duration/distance, intensity, description). Tap a card → detail + "Logga pass" button.
- `TriathlonSessionLogDialog.tsx` — feedback: felt slider, pain Y/N, area + 1-10 if yes. On submit, if `too_hard` or pain → call adapter.

### 4. Adaptive algorithm (`src/lib/triathlonAdapter.ts`)

Triggered after a log marks `too_hard` or `had_pain`:
- Window: next 7 days
- If pain in lower body (knees/shins/feet/hip) → convert upcoming run sessions to swim or rest
- If general fatigue → reduce duration by 30% and drop intensity one notch
- If high pain (≥7) → insert 2 rest days
- Show toast: "Vi anpassar ditt schema för de kommande dagarna..."

### 5. Integration

- Add "Triathlon" entry into ToolsTab (existing pattern in app)
- Icons via lucide-react (Waves, Bike, Footprints, Dumbbell)
- Swedish UI throughout, follows existing design tokens (no custom colors)

### Files to create
- `supabase/migrations/...` — 3 tables + RLS + grants
- `src/lib/triathlonPlanner.ts`
- `src/lib/triathlonAdapter.ts`
- `src/components/TriathlonView.tsx`
- `src/components/TriathlonWizard.tsx`
- `src/components/TriathlonCalendar.tsx`
- `src/components/TriathlonSessionLogDialog.tsx`

### Files to edit
- `src/components/ToolsTab.tsx` — add Triathlon entry point
