# Arkitekturgranskning: Health Connect / Samsung Health

## Vad som redan är korrekt
- Behörigheterna i appens installationsfil täcker steg, kalorier, distans, pass, puls och sömn, och läggs in automatiskt i varje bygge.
- Appen får installeras från Android 8 och uppåt, vilket Health Connect kräver.
- Samtyckesvyn och integritetslänken finns och kontrolleras i bygget.
- Dagsvärden summeras korrekt över alla poster (inte första/sista), och meter räknas om till kilometer.
- Passlängd räknas från start- och sluttid.

## Strukturella brister som åtgärdas

### 1. Saknad Health Connect-app hanteras otydligt
Idag blir det bara ett generiskt fel med texten "svarar inte eller saknas". Åtgärd: appen skiljer på "saknas/behöver uppdateras" och "fel uppstod", och visar då direkt en knapp som öppnar Health Connect i Play Store — både i kortet och i felmeddelandet.

### 2. Ingen minnesbild av vad som redan hämtats
Varje synk hämtar alltid exakt sju dagar bakåt. Har användaren inte öppnat appen på två veckor tappas mellandagarna. Åtgärd: appen sparar tidpunkten för senaste lyckade synk och hämtar från den punkten (alltid minst 2 dagar, max 30) så inget hål uppstår. Dagsvärden skrivs över per dag, så upprepad synk kan inte dubblera.

### 3. Dubbletter mellan källor
Skriver både Samsung Health och en klocka samma pass till Health Connect importeras båda som två pass. Åtgärd: pass som överlappar i tid med samma typ slås ihop till ett, och det med mest data (distans/puls) behålls.

### 4. Svag nyckel mot dubbelimport
Passnyckeln kortas till sex tecken, vilket kan ge krockar, och om skapandet av passet misslyckas fortsätter importen tyst. Åtgärd: längre och stabilare nyckel, och tydligt besked om hur många pass som misslyckades.

### 5. Generiska felmeddelanden
Åtgärd: varje feltillstånd får en egen text — Health Connect saknas, nekad behörighet, delvis behörighet, inget svar i tid, och ingen kontakt med servern.

### 6. Status uppdateras inte när åtkomst dras tillbaka
Återkallar användaren åtkomsten i Health Connect fortsätter kortet visa "kopplad" tills appen startas om. Åtgärd: statusen läses om varje gång appen kommer i förgrunden.

### 7. Bakgrundssynk (dokumenteras, byggs inte)
Kräver behörigheten för läsning i bakgrunden plus godkännande i Play Console. Noteras i dokumentationen som nästa steg.

## Teknisk sammanfattning
- `src/lib/healthSync.ts`: ny `healthAvailability()` med tre lägen; felkoder via `HealthError`; `readHealthDays` tar start/slut-intervall; `lastHealthSyncAt` i localStorage; överlappsdedup i `readHealthWorkouts`.
- `src/components/HealthConnectCard.tsx`: install-CTA vid saknad app, statusomläsning vid `resume`/`visibilitychange`, specifika feltexter, rapport om misslyckade importer.
- `src/lib/healthWorkoutImport.ts`: full hash-nyckel, felräkning i `ImportResult`.
- `docs/health-connect.md`: arkitektur, dataflöde, krav för bakgrundssynk.
- Nya tester i `src/test/` för intervallberäkning, dedup, felkoder och nyckelstabilitet; sedan tester, typkontroll och Android-pluginverifiering.
