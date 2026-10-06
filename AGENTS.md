# Architecture rules

- Mark Android Capacitor documents with `native-android` and keep the Android navigation-bar clearance in the shared CSS token; Android 16 may report a zero CSS safe-area inset while drawing behind three-button navigation.
- Generate workout encouragement only from measured comparisons: compare session totals for identical exercise rosters and exclude mixed-cardio aggregates from sport-specific records, so messages cannot credit unrelated training data.- Validate every numeric input through `src/lib/inputValidation.ts` (rules + parse helpers) and mirror the limits in database triggers; one source keeps client and server limits identical, and aggregations skip out-of-range legacy rows via `isPlausibleSet`/`isPlausibleMealLog`.
- Publish workout posts only from an explicit share action (or the user's "Alltid" opt-in) via `src/lib/socialPrivacy.ts` settings; no database trigger may create feed posts, so declining sharing can never publish.
