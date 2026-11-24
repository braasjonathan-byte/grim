# Architecture rules
- Never resolve promises with bare Capacitor plugin proxies; wrap them in plain objects so thenable assimilation cannot invoke a native `then` method.
- Health Connect permission deadlines track direct launcher dispatch per request as well as proxy visibility; both preserve saved callbacks during the bounded user-choice window.
- Health import controls revalidate saved existence on every import, including previously imported rows and bulk actions; foreground status refreshes are sequenced so stale UI cannot block restoring deleted sessions or create duplicates.
- Health workout distance reads source-scoped DistanceRecords for the session window; fetches fill only missing active-import distance through workoutHistory with a concurrent-edit guard, never daily totals or new social posts.
- Kept-mounted Home and Workout receive explicit tab activity; Home refreshes on entry and workout changes, and Workout consumes confirmed settings intents only after activation and hydration to preserve fast navigation without stale state.
- Restore scheduled accounts only through the admin-authenticated restore-account function and the Auth Admin API; cancel the purge before lifting the ban to preserve existing data without editing managed auth tables.
- Edge functions use their scoped Deno configuration with automatic npm dependency resolution; pinned server packages must resolve independently of the frontend's installed versions.
- Health workout discovery lives at the signed-in app level and refreshes on foreground entry using workout-specific permission; confirmed imports emit exact saved slots to a shared privacy-aware sharing queue so manual and startup imports behave alike.
- Photo meal scans resolve each ingredient server-side against owned foods or a non-ambiguous catalogue match; the review saves selected validated rows in one confirmed insert, so estimates cannot masquerade as verified data or partially log a plate.
- Health Connect exports prioritize stored cardio minutes/km for cardio-only duration and distance; revisioned client versions repair unchanged legacy exports while preserving the original end anchor and mixed-workout elapsed time.

- Social entry uses the shared initial-tab resolver rather than remembered tabs; explicit friend and notification destinations remain intact.

- Nutrition tools use a controlled bottom sheet that opens the existing editors after closing; keep menu presentation separate from logging and goal persistence.

- Hybrid analysis keeps measured strength and cardio units separate; 48-hour comparisons require real start timestamps and matched running distances, never imply causation or rested legs.
- Workout sparring copies only explicitly shared accepted-friend workouts through an invoker RPC; saved reference snapshots stay separate from the user's completion, with unchanged completion persistence and no automatic publication or notifications.

- Day-goal suggestions use real referenced food/history rows and the nutrition ring's unchanged calorie target; bounded portions, excluded foods and a single confirmed batch insert prevent invented nutrition, over-budget suggestions and partial meals.

- Home return summaries use unified workout history and seven UTC dates; upcoming workouts preserve exact plan identities and exclude completed/skipped slots so retention never invents activity or schedules.

- Direct and group conversations share cursor-paged newest-first history and confirmed writes; preserve user-scoped drafts on failure and deduplicate saved/realtime rows to prevent loss and duplicate messages.
- Social person navigation reuses FriendsView profile/training and existing message/challenge flows; destination-first sharing and settings intents avoid duplicate editors and publication paths.
- Social Radix dialogs use the shared social-sheet positioning override; keep bottom alignment consistent without changing unrelated app dialogs.
- Display public posts as public, not member-only; audience labels must describe deployed access without changing permissions during presentation work.

- Settings search uses a shared catalogue and opens existing category controls; never create a second settings editor.
- First-start focus is user-scoped and prioritizes existing registration paths without disabling modules or requiring body data; welcome completion must be confirmed before closing.
- Statistics answer three questions using UTC-bounded history: four seven-day activity periods and 90-day matched results/weigh-ins; missing evidence is never inferred progress.
- Training insights read unified workout history and compare identical counted exercise rosters and rep layouts; label volume as volume rather than inferred maximal strength.
- New friend challenges are created atomically via an authenticated RPC; only accepted friends receive pending invitations, and new standings expose aggregates only to accepted participants.
- Unsaved nutrition quick posts use user-scoped session drafts; a failed read must not be presented as an empty day or a successful save.

- Home nutrition shortcuts use a consumed session-scoped intent to open existing food or weight entry; this avoids duplicate logging flows and delayed navigation events.

- Shared button styles must pair background tokens with their corresponding foreground tokens, including hover states, so custom theme contrasts remain correct.

- Recipe ingredient unit switching in the recipe view is display-only: convert from the original amount using shared nutrition helpers and linked food measure overrides, never mutate saved quantities or macros. In the recipe editor the unit choice is an explicit edit: convert with `convertedIngredient` so total grams and macros stay constant while amount+unit are saved.

- Use the shared OFF product parser for barcode and server-side text searches, and persist products through `saveProductFood` only on explicit addition; identical acceptance rules and real food IDs keep scanned products searchable.

- Mark Android Capacitor documents with `native-android` and keep the Android navigation-bar clearance in the shared CSS token; Android 16 may report a zero CSS safe-area inset while drawing behind three-button navigation.
- Generate workout encouragement only from measured comparisons: compare session totals for identical exercise rosters and exclude mixed-cardio aggregates from sport-specific records, so messages cannot credit unrelated training data.- Validate every numeric input through `src/lib/inputValidation.ts` (rules + parse helpers) and mirror the limits in database triggers; one source keeps client and server limits identical, and aggregations skip out-of-range legacy rows via `isPlausibleSet`/`isPlausibleMealLog`.
- Publish workout posts only from an explicit share action (or the user's "Alltid" opt-in) via `src/lib/socialPrivacy.ts` settings; no database trigger may create feed posts, so declining sharing can never publish.
- Read, edit and delete finished workouts only through `src/lib/workoutHistory.ts` (covers active, single and archived plans) and broadcast `grim:workouts-changed` afterwards; one path keeps stats, achievements and feed posts in sync with the remaining data.
- Write exercise instructions and English-name links only through the `exercise-gif` function (`save_instructions`/`set_mapping`), which checks every write; `exercise_name_lower` is generated, so inserts must never set it, and cached AI text lives in `ai_instructions` below edited `custom_instructions`.
- Interpret free-text/voice food days only in the `nutrition-day` function, which resolves AI items server-side to own recipes/foods or Livsmedelsverket rows before returning; AI per-100 g values are only a fallback so logged numbers come from real data whenever possible.
- Never hand-edit the Android `versionCode`/`versionName`; `scripts/bump-android-version.cjs` derives them from the GitHub run number so every build is strictly higher than the last uploaded build.
- `supabase/functions/mcp/index.ts` is owned (generator banner removed): the mcp-js bundler erases TS annotations and breaks `deno check`, so edit the bundle directly instead of regenerating it; keep the MCP codegen plugin out of Vite because it refuses to overwrite owned files and blocks builds.
- Cast binary web-push payloads at the fetch site (`body: body as unknown as BodyInit`); Deno's fetch types reject `Uint8Array<ArrayBufferLike>` from the encryption helpers.
- Browser flow checks live in `e2e/core_flows.py` (Playwright, signed-in session, run with `python3 e2e/core_flows.py`); they use uniquely named test data and always restore it, because they run against real accounts.
- Workout completion persistence lives in `useWorkoutCompletionWriter`; keep optimistic merging, destructive-write protection and queue-first saves together so extracted rows cannot bypass data-loss guards.
- Workout queue status subscribes inside `WorkoutSyncStatus`, not the workout page; queue events must not rerender the entire exercise list.
