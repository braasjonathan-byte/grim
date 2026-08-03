# Mer nativ känsla på Träning-sidan

Fyra förbättringar i träningsvyn: swipebar veckocarousel, tydligare dagsväljare, swipebara set-rader med feedback-animation, och automatisk PR-badge.

## 1. Veckoväljare som swipebar carousel

Idag visas V6/V7/V8 som knappar med pilar och en enkel swipe-gest på hela raden (max 2 veckor synliga åt varje håll).

Ny lösning:
- Horisontellt scrollande rad med alla veckor, `scroll-snap` per vecka så att varje svep landar exakt på en vecka.
- Aktiv vecka centreras automatiskt vid byte (scroll-into-view, smooth).
- Aktiv vecka är större/fylld, grannveckor mindre och nedtonade — mjuk skalning istället för hårda klipp.
- "Lägg till vecka"-knappen ligger kvar sist i carousellen.
- Pilarna behålls som fallback på desktop men döljs på mobil.
- Progressbar och "X% avklarat" ligger kvar under.

## 2. Tydligare dagsväljare (Mån–Sön)

Varje dagschip byggs om till en liten vertikal pelare: dagbokstav överst, statusindikator under.

- **Idag**: fylld prick under bokstaven + tydlig ring runt chipet.
- **Genomförd dag**: liten grön bock istället för prick.
- **Kommande dag med pass**: tom/streckad prick.
- **Vilodag**: ingen prick, nedtonad (behåller nuvarande klick för att lägga till pass).
- **Före planstart**: fortsatt disabled/gråad.
- Valt dagschip markeras med fylld bakgrund som idag.

Statusen läses från befintlig `completions[week-day]?.done` och `sameWorkoutDay`-logiken.

## 3. Swipebara set-rader med feedback-animation

Set-raderna (S1, S2 …) finns på två ställen i vyn (dagens pass och veckoplan) och får båda samma beteende via en ny delad komponent.

- Svep raden åt höger → sättet bockas av som klart (anropar befintlig `toggleSetDone`).
- Svep åt vänster på ett avbockat set → ångrar markeringen.
- Under svepet visas en grön bakgrund med bock som "avslöjas" bakom raden.
- Vid markering: skala-puls (kort 1.0 → 1.03 → 1.0) och grön färgpuls över raden.
- Haptisk vibration via projektets befintliga `src/lib/haptics.ts`.
- Checkboxen finns kvar — svepet är ett komplement, inte en ersättning.
- Inmatningsfälten för reps/kg påverkas inte: svep-gesten aktiveras bara vid tydlig horisontell rörelse och ignoreras när gesten startar i ett inputfält.

## 4. Automatisk PR-badge

När ett set sparas eller bockas av jämförs det mot användarens tidigare bästa för övningen.

- Bästa tidigare värde per övning tas fram från loggad historik (samma källa som personliga rekord-vyn) plus eventuella manuella rekordöverstyrningar.
- Slår setet det tidigare rekordet visas en liten "PR"-badge på set-raden.
- Badgen animeras in med en kort puls när den dyker upp.
- Rekordjämförelsen görs på vikt, med reps som utslagsgivare vid samma vikt.
- Endast styrkeövningar med kg-värde får badge; tids-/distansbaserade rader hoppas över.

## Teknisk sammanfattning

- `src/components/WorkoutView.tsx` — bygg om veckocarousellen och dagschipsen; byt ut de två inlinade set-rads-blocken mot den nya komponenten.
- Ny `src/components/SetRow.tsx` — set-rad med swipe-gest, animation, checkbox, reps/kg-fält och PR-badge.
- Ny hjälpmodul för PR-uppslag per övning (bästa vikt/reps), återanvänder samma parsing som `PersonalRecords.tsx`.
- Animationer via Tailwind-keyframes (skala + grön färgpuls) i temats tokens — inga hårdkodade färger.
- Ingen databasändring krävs; all data finns redan i `workout_completions.logged_weights`.
