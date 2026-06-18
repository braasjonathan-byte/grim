# Plan: 6 nya funktioner

Det här är en stor leverans (uppskattat 6–8 timmar arbete). Jag bygger i 3 faser så du kan testa varje del innan nästa. Säg till om du vill ändra ordning eller hoppa över något.

---

## Fas 1 — Frontend-only, snabb vinst (ingen DB)

### 1.1 Övningshistorik-popup
- Ny komponent `ExerciseHistoryDialog.tsx`
- Tap på övningsnamn i `WorkoutView` → öppnar dialog
- Visar de senaste 5 gångerna övningen loggats: datum, sets×reps@kg, PR-markör om det var rekord
- Hämtar från `workout_completions.logged_weights` + `archived_plans.completion_data` (samma källor som leaderboard)
- Mobile-first bottom sheet enligt mem-regler

### 1.2 Achievement-system 2.0
- Utöka `src/lib/achievements.ts` med nya badges:
  - **100 pass** / **250 pass** / **500 pass**
  - **10-tons-klubben** (totalvolym ≥ 10 000 kg ett enskilt pass)
  - **100-tons-klubben** (totalvolym ≥ 100 000 kg över tid)
  - **Bodyweight-bänk** (första bänk ≥ kroppsvikt)
  - **Bodyweight-marklyft** (2× kroppsvikt mark)
  - **Tidig fågel** (5 pass före kl 07)
  - **Nattuggla** (5 pass efter kl 22)
  - **Streak 7 / 30 / 100 dagar**
  - **Triathlon-debut** (första triathlon-pass loggat)
- Trigger-check körs i samma flöde som dagens achievements
- Visas i befintliga `AchievementsPanel`

---

## Fas 2 — Backend + frontend (kräver migration)

### 2.1 Måltidsmallar
**Migration:**
```sql
CREATE TABLE public.meal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{food_id, grams, name, kcal, protein, carbs, fat}]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_templates TO authenticated;
GRANT ALL ON public.meal_templates TO service_role;
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own templates" ON public.meal_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**UI i `NutritionView.tsx`:**
- Ny knapp "Spara som mall" på loggade måltider
- Ny sektion "Mina mallar" — tap → loggar hela måltiden idag direkt
- Edit/delete på mallar via long-press

### 2.2 Push:Pull:Ben-balansvarning
- Ny komponent `MuscleBalanceWarning.tsx` på Stats-tab
- Analyserar senaste 4 veckorna från `workout_completions.logged_weights`
- Klassar varje övning via befintliga muskelgrupp-mappningar (`exercise_muscle_overrides` + `exerciseLibrary`)
- Räknar set-volym per kategori (push/pull/ben)
- Om någon kategori är >30 % under snittet → visa rödflaggad varning med förslag

---

## Fas 3 — Realtid + scheduled (mest komplex)

### 3.1 Hejarop / realtidsreaktioner
**Migration:**
```sql
CREATE TABLE public.workout_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '💪',
  workout_session_id text,  -- valfri koppling till pågående pass
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT ON public.workout_cheers TO authenticated;
GRANT ALL ON public.workout_cheers TO service_role;
ALTER TABLE public.workout_cheers ENABLE ROW LEVEL SECURITY;
-- mottagare ser sina, avsändare ser sina, bara mellan vänner
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_cheers;
```

**Flöde:**
- När vän börjar pass (befintlig "active workout"-signal i social feed) → ny "💪 Hejaropp"-knapp
- Klick → insertar i `workout_cheers`
- Mottagaren prenumererar via Supabase Realtime → animerad emoji-overlay (`FireworksOverlay`-stil) + push-notis via befintlig FCM
- Edge function `notify-cheer` skickar push

### 3.2 Veckorapport på söndagar
- Ny edge function `weekly-report`
- Cron: `0 18 * * 0` (söndagar 18:00 svensk tid → 17:00 UTC)
- För varje aktiv användare: hämta veckans pass-antal, totalvolym, distans, PRs, längsta streak
- Skickar push via befintlig FCM-pipeline med Open Graph-vänlig text:
  > "Vecka X: 4 pass · 12.3 ton · 2 nya PRs 🔥 Tap för detaljer"
- Tap → ny route `/weekly-report/:week` med detaljvy

---

## Tekniska anmärkningar

- All datum-hantering i UTC (mem-regel)
- 800 ms auto-save via refs där input finns (mem-regel)
- Mobile-first bottom sheets (mem-regel)
- Inga rundade hörn, inga skuggor (mem-regel)
- Realtime-prenumerationer alltid i `useEffect` med cleanup
- Achievements re-evalueras endast på pass-completion, inte vid varje rendering

---

## Vad jag INTE bygger nu (säg till om du vill)

- Push-tokens för iOS web (bara FCM Android + Web Push i dag)
- Inställning för att slå av veckorapporten per användare — lägger som default på, kan adderas senare
- Historisk backfill av achievements för befintliga pass — bara nya pass triggar nya badges initialt

---

Säg **"kör fas 1"** så börjar jag direkt. Eller välj annan ordning / strykningar.