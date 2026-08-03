# Achievements: progressbar + egen badge-vy

## Sammanfattningskortet (Statistik-fliken)

Dagens rad "Achievements 0/154" byggs om till ett klickbart kort:

```text
+---------------------------------------------+
|  Achievements                        12/154 |
|  [========------------------------]     8%  |
|  Tryck för att se alla badges             > |
+---------------------------------------------+
```

- Horisontell progressbar med fylld andel i temats primärfärg, guldton för milstolpar.
- Räknaren och procenten ligger kvar som siffror.
- Hela kortet är en knapp (tangentbords- och skärmläsartillgängligt) som öppnar badge-vyn.
- Förhandsvisningen av de senaste upplåsta achievementsen ligger kvar under baren i komprimerad form.

## Achievements-vyn

Öppnas som en helskärmsvy ovanpå appen (samma mönster som övriga helskärmsflöden), med tillbakaknapp i toppen. Ingen ny URL behövs.

Innehåll:
- Topp: stor progressbar, "12 av 154 upplåsta", samt fördelning per svårighetsgrad (Brons / Silver / Guld / Legend).
- Filterchips: Alla, Upplåsta, Låsta, samt per svårighetsgrad.
- Badge-grid, 3–4 kolumner beroende på skärmbredd:
  - Upplåst: emoji i full färg, titel, svårighetsgrad, datum för upplåsning.
  - Låst: samma badge men gråskalad och nedtonad som silhuett, med titel och vad som krävs.
  - Nyligen upplåst (senaste 7 dagarna): liten "NY!"-markör i hörnet med diskret puls.
- Tryck på en badge visar beskrivning och tröskelvärde.

## Data

`user_achievements` innehåller redan `unlocked_at`. Idag hämtas bara `achievement_id` – hämtningen utökas till att även ta med tidsstämpeln, så att vyn kan sortera efter senast upplåst och avgöra vad som är "nytt".

## Teknisk detalj

- `src/components/AchievementsPanel.tsx`: byggs om till det klickbara sammanfattningskortet med progressbar; tar emot `unlocked` med id + tidsstämpel och en `onOpen`-callback.
- Ny `src/components/AchievementsView.tsx`: helskärmsvyn med filter, grid och detaljvisning.
- `src/components/WorkoutStats.tsx`: hämtar `achievement_id, unlocked_at`, håller state för om vyn är öppen och renderar den.
- `src/components/FriendProfileView.tsx`: samma kort i kompakt läge så en väns badges kan öppnas på samma sätt (skrivskyddat, ingen "NY!"-markör).
- Stil följer appens nuvarande uttryck: flata ytor, kvadratiska hörn, semantiska färgtokens – inga hårdkodade färger.
