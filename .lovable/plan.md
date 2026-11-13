# Gap-analys inför testare – endast diskussion, inga ändringar

Grundat på en snabb kodgenomgång. Påståenden som inte är verifierade är markerade **(osäkert)**.

## Hårda fakta som redan nu är varningssignaler
- `src/components/WorkoutView.tsx` är **9 590 rader** med **116 `useState`**. Det är appens viktigaste skärm och den största risken.
- Andra stora filer: `FriendsView` (1 591 rader), `SocialView` (1 413), `ExerciseGifManager` (1 411), `Index.tsx` (1 236), `ChatView` (1 202), `IntervalRunner` (1 097).
- Det finns **inga end-to-end-tester** (ingen Playwright-mapp eller e2e-svit). De 445 testerna är enhetstester av hjälpfunktioner och enskilda komponenter. Det finns 72 testfiler; Health Connect har ungefär 15 av dem, medan passloggning i `WorkoutView`, kostloggning i `NutritionView` och Social nästan saknar tester.
- Offlinekön (`useOfflineSync.ts`) sparar i `localStorage` under en global nyckel, `grim_offline_queue`, som inte är knuten till någon användare. Jag har inte kontrollerat om kön töms vid utloggning **(osäkert)**.
- Det finns bara cirka 218 `aria-label` i alla komponenter, vilket är tunt för 56 000 rader UI.
- Inloggade flöden har inte testats i en riktig webbläsare den här veckan: det gäller två konton i Social, ett nytt konto genom hela första starten och en kall start på Android.

## Förslag, sorterade efter effekt kontra insats

### 1. Testsvit för de fem verkliga flödena – P0, M
**Vad:** Playwright-tester mot förhandsvisningen med ett testkonto. Flödena: nytt konto → första passet, logga ett set → ladda om → setet finns kvar, logga en måltid → ladda om, avsluta pass offline → återanslut, och vänförfrågan → utmaning mellan två konton.
**Varför:** Gröna enhetstester bevisar inte att en testare kan spara ett pass. Hela ”redo för testare” vilar i dag på manuella stickprov.

### 2. Granskning av passloggning under träning – P0, M
**Vad:** Mät antalet tryck och sekunder per set i `StrengthSetRowV2` och `WorkoutView`: från tom rad till avbockat, plus vilotimer och nästa set. Testa dubbeltryck, att skärmen släcks mitt i ett set, att appen dödas och återöppnas, och flygplansläge. Visa sparstatus per set (”Sparat/I kö/Misslyckades”), inte bara den globala `ConnectionNotice`.
**Varför:** Om ett loggat set försvinner tappar vi användaren för gott. Med 116 state-variabler i en fil är kantfall troliga, men jag har inte reproducerat något **(osäkert)**.

### 3. Knyt offlinekön till användaren och töm den vid utloggning – P0, S
**Vad:** Lägg användar-id i nyckeln eller i varje rad, och spela inte upp rader som tillhör en annan inloggad användare.
**Varför:** Delade telefoner och kontobyten kan i värsta fall skriva data på fel konto. Det är ett integritets- och stabilitetsproblem. Risken är ännu inte verifierad i kod **(osäkert)**.

### 4. Bryt ut WorkoutView i delar – P1, L (stegvis)
**Vad:** Dela upp i: passhuvud/timer, övningslista, styrkerad, konditionsrad och avslut/delning. Varje del får sitt eget state eller en egen reducer, och sparningen går genom en enda hook.
**Varför:** Ändringar där i dag ger regressioner som inga tester fångar. Förslaget gör förslag 1 och 2 billigare och snabbar upp rendering på svaga Android-telefoner. Det ska göras först när förslag 1 finns, annars refaktorerar vi blint.

### 5. Kost: tid till första loggade måltid – P1, M
**Vad:** Mät stegen från Kost-fliken till en sparad måltid för ett nytt konto som saknar historik, och för ett vanligt konto. Visa ”Ofta/Senast” direkt när sökningen öppnas, gör ett tryck räcka för att återlogga, och sätt mängdförval på vanliga portioner. Visa ett tydligt tomt läge med ”Sök, skanna eller tala in” på samma plats.
**Varför:** Konkurrenterna (Lifesum/MFP) vinner på återloggning. Jag har inte mätt om det i dag är under 15 sekunder **(osäkert)**.

### 6. Onboarding: mät, gissa inte – P1, S
**Vad:** Gå igenom första starten med ett helt nytt konto (Träning/Kost/Båda), räkna skärmar och val före första värdet och logga när händelserna sker (första set och första måltid). Ta bort eller skjut upp val som inte behövs dag 1: teman, moduler, integritet, Health Connect.
**Varför:** Första starten har förenklats i kod men aldrig testats från början till slut på ett riktigt nytt konto.

### 7. Anledning att komma tillbaka dag 2 och dag 7 – P1, M
**Vad:** Dag 2: Hem visar ”Nästa pass i planen” och gårdagens resultat att slå. Dag 7: en veckosammanfattning (pass, regelbundenhet och jämförbara resultat) som valfri notis. Vännernas aktivitet ska bara visas om de har delat den aktivt.
**Varför:** Social förutsätter att man redan har vänner i appen. En ensam testare har i dag inget som drar tillbaka. Det finns ingen mätning av återkomst **(osäkert om analys finns)**.

### 8. Health Connect: förväntningar och felbild – P1, S–M
**Vad:** Visa ”Senast synkad”, antal importerade pass och en tydlig orsak när behörighet saknas eller när det blir timeout, i `HealthConnectCard`. Skydda mot dubbletter när samma pass kommer både manuellt och från Health Connect.
**Varför:** Synk som tyst misslyckas uppfattas som att appen är trasig. Logiken är vältestad, men upplevelsen på enheten är inte verifierad på en riktig telefon **(osäkert)**.

### 9. Prestanda och laddtider – P2, M
**Vad:** Mät hur stort startpaketet är och hur lång tid det tar tills appen går att använda på en medelklass-Android. Ladda tunga vyer (Social, ExerciseGifManager, adminvyer, kartor) först när de behövs.
**Varför:** Kallstarten avgör första intrycket. Jag har inga siffror ännu **(osäkert)**.

### 10. Tillgänglighet på huvudskärmarna – P2, S–M
**Vad:** Kör axe på Hem, Träning, Kost och Social. Ge ikonknappar etiketter, se till att tryckytor är minst 44 px och kontrollera fokusordningen i bottom sheets.
**Varför:** Kontrasttesterna täcker färger, men inte skärmläsare eller tangentbord.

## Rekommenderad ordning
1 → 3 → 2 → 6 → 5 → 8 → 7 → 4 → 9 → 10. Låt ingen testgrupp börja förrän 1–3 är gröna.

## Utanför denna runda
process_referral och hedersmedlemskap rörs inte. De 11 okontrollerade säkerhetsfynden finns kvar och bör beslutas separat före lansering.
