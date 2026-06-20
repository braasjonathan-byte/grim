## Funktion: Löpning – intervaller

Ny övning som registreras som intervallpass, summeras in i löpningsstatistik, kan spelas in via GPS och spelar upp röstguidning under passet.

### 1. Övningen i biblioteket
- Lägg till "Löpning – intervaller" i exercise-listan (kategori: kondition, typ: löpning) i samma fil där "Cykling" / "Löpning" definieras.
- Aliasar matchar regex för löpning så att statistiken (km, tempo) räknas in i totalen för "Löpning".

### 2. Registrering av passet
När övningen läggs till i ett pass öppnas en konfigurationsdialog där användaren väljer:
- Antal intervaller (1–30)
- Längd per intervall (sekunder eller meter)
- Vila per intervall (sekunder)
- Mål-tempo per intervall (min/km) – ett värde eller per-intervall lista
- Ev. uppvärmning / nedvarvning (min)

Konfigen sparas i `workout_plans.details` som en strukturerad rad, t.ex.:
`Löpning – intervaller: 6×400m @ 4:30/km, vila 90s`

### 3. Statistik
- Distansen (antal intervaller × distans + ev. uppvärmning/nedvarvning) summeras in i veckans/månadens "Löpning" i statistikvyn.
- Loggas i `workout_completions.logged_distance_km` + `logged_tempo` som vanlig löpning.

### 4. GPS-inspelning
- I `useGpsTracker` läggs stöd för intervall-läge: tracker tar emot intervall-konfig och markerar lap vid varje intervall/vila-byte.
- Knapp "Spela in med GPS" visas på intervall-kortet precis som för vanlig löpning.

### 5. Röstguidning (Web Speech API – `speechSynthesis`)
- Inställning per pass i en ny "Röstguidning"-meny som öppnas vid Start:
  - På/av
  - Läs upp: kommande tempo, intervallnummer, vila-start, vila kvar, nedräkning 3-2-1
  - Språk: sv-SE
- Flöde under passet:
  1. "Intervall 1 av 6, mål-tempo 4:30 per kilometer" (tempo läses upp **före** startsignalen)
  2. Kort paus → "3, 2, 1, kör"
  3. När intervallen är klar: "Vila 90 sekunder"
  4. Innan nästa: upprepa från 1 med nästa tempo
- All TTS-kod i ny modul `src/lib/intervalVoice.ts`.

### 6. UI-komponenter
- `IntervalConfigDialog.tsx` – konfig vid tillägg/redigering.
- `IntervalRunner.tsx` – run-time vy med timer, lap-räknare, GPS-status och röstkontroll.
- Start-knappen på passet öppnar en liten "Röstinställningar"-popover innan timern startar.

### Tekniska detaljer
- Filer som ändras: `src/components/WorkoutView.tsx` (exercise-detektering, render), `src/hooks/useGpsTracker.ts` (lap-stöd), `src/lib/gpsSettings.ts` (voice-prefs).
- Nya filer: `src/lib/intervalVoice.ts`, `src/components/IntervalConfigDialog.tsx`, `src/components/IntervalRunner.tsx`.
- Inga schema-ändringar krävs – konfig sparas i text i `workout_plans.details`, loggar i befintliga `logged_distance_km/logged_tempo`.

### Att bekräfta innan jag bygger
1. Ska distansen anges i **meter per intervall** (t.ex. 400 m) eller **tid per intervall** (t.ex. 60 s)? Eller båda som val?
2. Ska röstguidningen alltid använda webbläsarens röst (gratis, fungerar offline) eller vill du ha en mer naturlig AI-röst via Lovable AI (kostar tokens)?
3. Ska intervallpasset kunna sparas som mall i veckoplanen, eller bara läggas till i dagens pass?