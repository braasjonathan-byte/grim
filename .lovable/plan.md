Plan:

1. Samla dagens datumlogik i en enda helper
   - Skapa en konsekvent beräkning för “idag” baserad på lokal datum/veckodag.
   - Använd samma helper för både planläge och enskilda pass.

2. Planläge: ignorera klarmarkerade pass vid automatisk navigering
   - Vid öppning/refresh av träningsvyn ska appen välja aktiv vecka utifrån planens startdatum och dagens datum.
   - Därefter ska dagens veckodag väljas även om passet redan är klarmarkerat.
   - Completion-status (`done`, `skipped`) ska bara påverka utseendet, inte vilken dag som väljs.

3. Enskilda pass: välj dagens faktiska datum först
   - Om det finns ett enskilt pass med dagens datum ska appen automatiskt välja den veckan och den dagen.
   - Om dagens datum inte har något pass ännu, ska appen ändå ställa vyn på aktuell vecka/dag där det är möjligt, istället för att hoppa till senaste eller första historiska pass.

4. Footer-klick på “Träning” ska alltid återställa till idag
   - När användaren klickar på Träning i footern ska träningsvyn remonteras/återställas och köra samma “gå till dagens datum”-logik.
   - Detta ska gälla oavsett om användaren nyss tittade på en annan vecka eller ett annat pass.

5. Verifiering
   - Kör TypeScript-kontroll.
   - Kontrollera särskilt dessa scenarier:
     - Planläge, dagens pass ej klart.
     - Planläge, dagens pass klarmarkerat.
     - Enskilda pass, dagens datum finns.
     - Enskilda pass, dagens datum saknas men användaren står på Träning.

Tekniska detaljer:
- Ändringen görs i `src/components/WorkoutView.tsx` och vid behov i `src/pages/Index.tsx` där footer-tabben hanteras.
- Befintlig completion-data ändras inte i databasen.
- Inga backend- eller databasmigrationer behövs.