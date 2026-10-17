# Architecture rules

- Recipe ingredient unit switching is display-only: convert from the original amount using shared nutrition helpers and linked food measure overrides, never mutate saved quantities or macros.

- Use the shared OFF product parser for barcode and server-side text searches, and persist products through `saveProductFood` only on explicit addition; identical acceptance rules and real food IDs keep scanned products searchable.

- Mark Android Capacitor documents with `native-android` and keep the Android navigation-bar clearance in the shared CSS token; Android 16 may report a zero CSS safe-area inset while drawing behind three-button navigation.
- Generate workout encouragement only from measured comparisons: compare session totals for identical exercise rosters and exclude mixed-cardio aggregates from sport-specific records, so messages cannot credit unrelated training data.- Validate every numeric input through `src/lib/inputValidation.ts` (rules + parse helpers) and mirror the limits in database triggers; one source keeps client and server limits identical, and aggregations skip out-of-range legacy rows via `isPlausibleSet`/`isPlausibleMealLog`.
- Publish workout posts only from an explicit share action (or the user's "Alltid" opt-in) via `src/lib/socialPrivacy.ts` settings; no database trigger may create feed posts, so declining sharing can never publish.
- Read, edit and delete finished workouts only through `src/lib/workoutHistory.ts` (covers active, single and archived plans) and broadcast `grim:workouts-changed` afterwards; one path keeps stats, achievements and feed posts in sync with the remaining data.
- Write exercise instructions and English-name links only through the `exercise-gif` function (`save_instructions`/`set_mapping`), which checks every write; `exercise_name_lower` is generated, so inserts must never set it, and cached AI text lives in `ai_instructions` below edited `custom_instructions`.
- Interpret free-text/voice food days only in the `nutrition-day` function, which resolves AI items server-side to own recipes/foods or Livsmedelsverket rows before returning; AI per-100 g values are only a fallback so logged numbers come from real data whenever possible.
- Never hand-edit the Android `versionCode`/`versionName`; `scripts/bump-android-version.cjs` derives them from the GitHub run number so every build is strictly higher than the last uploaded build.
