## Mål
Utöka intervall-funktionen från enbart "Löpning – Intervaller" till alla konditionsformer i biblioteket, med sport-anpassade enheter (och fri enhet-väljare). När "Starta GPS-inspelning" trycks för en intervall-variant öppnas konfig-dialogen först.

## 1. Nya övningar i biblioteket
I `src/data/exerciseLibrary.ts` läggs en "– Intervaller"-variant till för varje kondition-övning som inte redan har en:

- Cykling – Intervaller
- Simning – Intervaller
- Roddmaskin – Intervaller
- Crosstrainer – Intervaller
- Trappmaskin – Intervaller
- Promenad – Intervaller
- Tröskellöpning – Intervaller (redan finns Löpning – Intervaller)
- Långpass – Intervaller
- Skidåkning – Intervaller (ny grundövning + variant)
- Skridsko – Intervaller (ny)
- Paddling/Kajak – Intervaller (ny)
- Hopprep – Intervaller (ny)
- Airbike – Intervaller (ny)
- SkiErg – Intervaller (ny)
- Vandring – Intervaller (ny)
- Spinning – Intervaller (ny)

Alla får `category: "kondition"`, `muscleGroup: "Helkropp"`. Aliasar i `cardioVisibility.ts` och `workoutDistance.ts` utökas så statistik fortsätter mappa rätt (t.ex. "cykling – intervaller" → cykling-kategorin).

## 2. Sport-profil för intervall-enheter
Ny modul `src/lib/intervalSportProfiles.ts` med en tabell:

```
{ matcher: regex, defaultUnit, availableUnits, paceLabel, paceUnit, distanceUnit }
```

Exempel:
- Löpning/Promenad/Vandring → distans i meter ELLER tid, tempo i min/km
- Cykling/Spinning → distans i km ELLER tid, fart i km/h, valbart watt-mål
- Simning → distans i meter (25/50 m), tempo i min/100 m
- Roddmaskin/SkiErg → distans i meter, tempo i /500 m
- Airbike → kalorier ELLER tid
- Crosstrainer/Trappmaskin → tid (+ valfri distans)
- Hopprep → tid ELLER antal hopp
- Skidåkning/Skridsko/Paddling → distans i km ELLER tid

En `getIntervalProfile(exerciseName)` returnerar profilen via första matchande regex; fallback = löpning. Användaren kan i konfig-dialogen även byta enhet manuellt via en dropdown ("Mät i: tid / distans / kalorier / hopp").

## 3. IntervalRunner generaliseras
`src/components/IntervalRunner.tsx` är idag löpnings-centrerad. Ändringar:
- Tar emot `exerciseName` (finns redan) och hämtar `profile` via `getIntervalProfile`.
- Röstguidning, etiketter ("Tempo", "Distans") och enhet i HUD kommer från profilen.
- Mål-typen per intervall blir `{ type: "time" | "distance" | "calories" | "reps", value, target? }` istället för dagens tid/tempo-par. Befintliga löpnings-preset mappas in via en migrations-funktion så inget existerande pass bryts.

## 4. Konfig-dialog (`IntervalRowsEditor` + ny wrapper)
`IntervalRowsEditor.tsx` byggs ut med:
- Toppmeny för enhet (defaultar från profilen).
- Kolumnrubriker/placeholders följer enheten.
- Kalkylator-fält fyller i härledda värden där det går (samma logik som löpning idag, men generisk).

Ny komponent `IntervalConfigDialog.tsx` som wrappar editorn i en bottom-sheet och returnerar konfigen via `onConfirm`. Återanvänds från:
- Plan-editorn när en "– Intervaller"-övning läggs till.
- GPS-knappen (se nästa punkt).

## 5. GPS-knappen i `WorkoutView.tsx`
I `DayGpsRecorder` (rad ~436) och i pass-kortets "Starta GPS-inspelning" (~254):
- När den valda övningen matchar `/intervall/i` öppnas `IntervalConfigDialog` istället för att starta GPS direkt.
- När användaren bekräftar konfigen startas både GPS-inspelning OCH `IntervalRunner` (lap-markering vid varje intervall/vila-byte enligt befintliga lap-stöd i `useGpsTracker`).
- Vid stopp sparas distans/tempo/laps som idag.
- Vanliga (icke-intervall) övningar fortsätter starta GPS direkt – ingen ändring.

## 6. Statistik & filter
- `cardioVisibility.ts`: regex för varje kategori utökas med "– intervaller"-suffix där det behövs (löpning-regexen täcker redan "intervaller?löpning"; cykling/simning/rodd/trapp/promenad får motsvarande). Inga nya kategorier – intervall-pass räknas in i sin grundsport.
- `workoutDistance.ts`: detektering uppdateras så cykling/rodd/etc. – intervaller summeras rätt.

## Tekniska detaljer
- Filer som ändras: `src/data/exerciseLibrary.ts`, `src/components/IntervalRunner.tsx`, `src/components/IntervalRowsEditor.tsx`, `src/components/WorkoutView.tsx`, `src/lib/cardioVisibility.ts`, `src/lib/workoutDistance.ts`.
- Nya filer: `src/lib/intervalSportProfiles.ts`, `src/components/IntervalConfigDialog.tsx`.
- Inga DB-ändringar – konfig ligger fortsatt i `workout_plans.details` som text, loggar i `workout_completions.logged_distance_km/logged_tempo`.
- Röstguidning på svenska behålls; texten anpassas per sport ("Intervall 3 av 6, mål 500 meter på roddmaskinen").

## Att bekräfta
1. OK med listan ovan av 16 sporter, eller ska någon läggas till/tas bort?
2. För simning – ska "längd" (bana) väljas som enhet (25 m / 50 m) eller bara meter generellt?
3. Ska GPS-knappen på en intervall-variant där GPS inte ger värde (t.ex. Roddmaskin – Intervaller, Airbike – Intervaller) gömmas helt, eller visas men bara starta intervall-timern utan GPS?
