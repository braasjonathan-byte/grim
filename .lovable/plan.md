# 10 alternativa funktionsförslag

Eftersom föregående plan avvisades kommer här 10 andra konkreta förslag på funktioner och förbättringar som gör appen enklare att använda. De är sorterade efter impact och byggbarhet.

## Förslag 1 — Smart övningsbyte i passet
Låt användaren trycka på en övning i ett pågående pass och få förslag på liknande övningar baserat på utrustning, mål och muskelgrupp. Sparas direkt i planen.

- Ny komponent: `ExerciseSwapSheet`
- Använda befintligt övningsbibliotek + metadata om utrustning/muskelgrupp
- Uppdatera `plan.details` på plats

## Förslag 2 — Viktskivekalkylator
Visa visuellt vilka viktskivor som ska läggas på stången för att nå en målvikt, med hänsyn till tillgängliga skivor och stångvikt.

- Ny komponent: `PlateCalculator`
- Inställning för tillgängliga skivor och stångvikt
- Kan öppnas från viktfältet i `WorkoutView`

## Förslag 3 — 1RM-uppskattning per övning
Beräkna uppskattat ett-reps-max från loggade set och visa trend över tid. Använd t.ex. Epley-formeln.

- Ny vy eller kort: `OneRepMaxCard`
- Läsa från `logged_weights` per övning
- Sparas inte som ny data, beräknas on-the-fly

## Förslag 4 — Träningsstreak och kalender
Visa en månadskalender på startsidan med markerade träningsdagar och aktuell streak.

- Ny komponent: `WorkoutCalendar`
- Data från `completed_workouts` eller `workout_plans` med `completed_at`
- Uppdatera `Index.tsx` med kalenderkort

## Förslag 5 — Volym per muskelgrupp
Veckovis översikt över träningsvolym per muskelgrupp så användaren ser om vissa muskler tränas för mycket eller för lite.

- Ny vy: `MuscleVolumeOverview`
- Summera sets × reps × vikt från `logged_weights`
- Mappa övningar till muskelgrupper via övningsbiblioteket

## Förslag 6 — Övningsanteckningar och taggar
Möjlighet att lägga till snabbanteckningar per set eller övning, t.ex. "smärta i vänster axel", "bra form", "energi låg".

- Utöka `logged_weights` eller `plan.details` med `notes`
- Nytt fält i `WorkoutView`
- Sökbar historik över anteckningar

## Förslag 7 — Kroppsmått och framstegsbilder
Logga vikt, kroppsmått och bilder över tid med trendkurvor.

- Ny tabell: `body_measurements`
- Ny vy: `BodyProgressView`
- RLS: användare ser bara egna data

## Förslag 8 — Övningsdemo direkt i passet
Visa en kort teknikvideo, gif eller bild med rätt utförande bredvid övningen under passet.

- Länka övningar i biblioteket till demo-media
- Ny komponent: `ExerciseDemo`
- Kan visas i `WorkoutView` bredvid varje övning

## Förslag 9 — Snabb kostregistrering
Favoritmåltider och möjlighet att återanvända gårdagens måltider med ett klick.

- Ny tabell: `meals` och `meal_favorites`
- Enkel vy för att logga måltid
- Favoriter sparas per användare

## Förslag 10 — Vilotimer med ljudsignal
Starta en vilotimer mellan set med valbar tid och ett pip när det är dags att köra nästa set.

- Ny komponent: `RestTimer`
- Inställning för standardvilotid
- Ljud via Web Audio (befintlig beep-funktion kan återanvändas)

## Rekommendation
Börja med **förslag 4 (kalender/streak)** och **förslag 10 (vilotimer)** — båda är snabba att bygga, ger tydligt värde under passet, och kräver ingen ny backend-tabell. Därefter lägg till **förslag 2 (viktskivekalkylator)** för att underlätta styrkepassen.
