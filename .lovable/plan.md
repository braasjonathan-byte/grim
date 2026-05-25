# Admin: Slå ihop dubblettövningar

Ny adminflik där admin kan välja två eller flera övningsnamn som ska slås ihop till ett valt kanoniskt namn, och all loggad data flyttas/summeras automatiskt.

## UI

Ny komponent `src/components/ExerciseMergeManager.tsx` i `ToolsTab` (admin-only, vid sidan av "Övningsbibliotek"):

1. Lista alla unika övningsnamn (union av `custom_exercises.name`, `pr_overrides.exercise`, `exercise_muscle_overrides.exercise_name`, `exercise_gif_mappings.exercise_name`, plus distinkta nycklar från `workout_completions.logged_weights`) med antalet förekomster per namn.
2. Sökfält + lista med kryssrutor — admin kryssar i 2+ namn som är dubbletter.
3. Radio/select: välj vilket av de markerade namnen som blir det slutgiltiga (eller skriv in ett helt nytt namn).
4. Förhandsvisning: "X loggade set och Y pass-rader kommer att slås ihop till «namn»".
5. Bekräfta → anropar RPC `admin_merge_exercises(from_names text[], to_name text)`.

## Backend (migration)

Skapa SECURITY DEFINER-funktionen `public.admin_merge_exercises(p_from text[], p_to text)`:

- Kräver `has_role(auth.uid(),'admin')` annars `raise exception`.
- Normaliserar: behandlar alla namn case-insensitivt; `from`-listan får inkludera `to`.
- **custom_exercises**: behåll en rad med namn = `p_to` (välj den med flest fält ifyllda), radera övriga dubbletter.
- **pr_overrides**: vid konflikt per `user_id` behåll den med högst `weight`.
- **pr_stars**, **pr_goals**: byt namn, hantera unika konflikter med `ON CONFLICT DO NOTHING`.
- **exercise_muscle_overrides** / **exercise_gif_mappings** / **exercise_description_reports**: byt namn, vid konflikt behåll senaste `updated_at`.
- **workout_completions.logged_weights** (JSONB-objekt): per rad, slå ihop arrayer för matchande nycklar till en sammanslagen array under `p_to`; bevarar ordning (gamla namn först).
- **workout_plans.details** + **saved_workouts.details** + **archived_plans.plan_data** (textfält / JSONB-fält `details`): regex-byt på radnivå — matchar början av rad case-insensitivt följt av valfri `set×rep`-notation, byter bara övningsnamnet och lämnar resten orört.
- Returnerar JSON-summa med antal påverkade rader per tabell.

Pekar admin-actionen från klienten via `supabase.rpc('admin_merge_exercises', { p_from, p_to })`.

## Filer som ändras

- ny migration `admin_merge_exercises` (RPC + GRANT EXECUTE TO authenticated, inre kontroll via `has_role`).
- ny komponent `src/components/ExerciseMergeManager.tsx`.
- `src/components/ToolsTab.tsx` — lägg till sektion `admin-merge-exercises`.

## Säkerhet

- RPC är SECURITY DEFINER med inre `has_role`-kontroll.
- Klienten visar endast knappen för admins (UI), men säkerheten ligger på funktionen.
- Operationen körs i en transaktion; en helt felaktig sammanslagning kan inte ångras automatiskt — UI varnar tydligt med "Detta går inte att ångra".

Vill du att jag bygger detta?
