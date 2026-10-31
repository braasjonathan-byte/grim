# Roadmap

## Kostförbättringar 31 oktober 2026
- [x] 7. Anpassa dryck, pommesstorlek och tillbehör i restaurangmenyer; Big Mac med Zero verifierad och tillagd (838 kcal), testpost borttagen.
- [x] 8. Visa källan i öppnat livsmedel och sparad kostpost; äldre poster utan ursprung märks ärligt som okända.
- [x] 11. Saknade mikronäringsvärden visas som Saknas, kända nollor bevaras; ofullständigt underlag verifierat i kostfliken.
- [x] 12. Färdigregistrering sparas per dag och konto, verifierad efter omladdning; snitt/prognoser använder kompletta dagar.
- [x] 15. Kalorier och protein fördelas separat via reglage; 100 % krävs för vardera, testat sparlås och sparning.
- [x] 1. Enkel/detaljerad kostvy; måltider öppnas vid tryck och fler detaljer finns kvar. Verifierad inloggad, 20 tester godkända.

## Testrapport 17 okt 2026 (punkt 1–4)
- [x] 1. Offlinesynk: omspelning körs nu var 15:e sekund, vid "online" och när appen blir synlig; vyn laddar om när kön spelats upp (grim:offline-queue-flushed) och cachen sparar server+köade rader så inget försvinner vid omladdning.
- [x] 2. Livsmedels-RLS verifierad: alla inloggade läser, bara skaparen ändrar/raderar (avsiktligt).
- [x] 3. Validering: negativa/orimliga konditionsvärden nekas (tid, distans, puls 30–220), set-fält nekar ogiltiga värden med felmeddelande i stället för tyst 0, DB-trigger speglar gränserna (distans 0–300 km, puls 30–220), 6 tester godkända.
- [x] 4. Utmärkelser räknas om vid passändring/borttagning och låses om för alla prestationsmått (tonnage, reps, distans, pass, streak, utmaningar) – inte bara volym.

- [x] Enhetsval för ingredienser i receptvyn, med oförändrade näringsvärden; 30 tester godkända och 140 g havregryn → 4 dl → 140 g verifierat inloggad.

- [x] Rätta skillnaden mellan streckkod och textsökning: gemensam produktdata, spara skannade produkter i livsmedelsbanken; sökning verifierad inloggad och sparandet täckt av tester. Extern märkessökning kan tillfälligt fallera och visar då fel i stället för noll träffar.

- [x] Gemensam inmatningsvalidering: decimalkomma, gränser, felmeddelanden, bekräftelser, databasskydd och uteslutning av orimliga gamla värden.
- [x] Lägg till 100 passanpassade peppformuleringar och verifiera att jämförelserna gäller rätt övning och träningsform (13 tester godkända).

- [x] Ta bort kategorierna "Träningsinnehåll" och "Community" från Verktyg-fliken.
- [x] Flytta "Radera konto"-knappen in i Inställningar längst ner.
- [x] Flytta passknapparna längst ned i träningskortet och gör passnamnet tryckbart för namnbyte.
- [x] Flytta snabbvalen Mål/Recept/Mallar/Igår i Kost upp till att ligga direkt under veckodagen.

## Health Connect / Samsung Health (godkänd plan)
- [x] Android-resurs `privacy_policy_url` för Health Connects samtyckesvy.
- [x] Sömnstöd i hälsopluginet, patchat reproducerbart i alla byggen.
- [x] Granulär behörighetsstatus per datatyp (aktivitet, pass, puls, sömn) med åtgärdsknapp.
- [x] Datahämtning och lagring inklusive sömn (kolumnen `sleep_minutes`).
- [x] Uppdaterad integritetspolicytext om hälsodata.
- [x] Verifiering: tester, Android-pluginverifiering, typkontroll.
- [x] Fixa native launcher-livscykel, appspecifik Behörigheter-vy och HC-01–HC-08-diagnostik.
- [x] Eliminera evig hälsosynk: hård JS-timeout, rätt produktionsväg och verifierad native-patch i varje Android-bygge.
- [x] Isolera Health Connect-dialogens launcher/callback i en egen Android-aktivitet och återställ patchen automatiskt efter npm-installation.
- [x] Deklarera proxy-aktiviteten även när pluginmanifestet saknar application-nod och låt native-felet hinna före UI-timeouten.
- [x] Uppgradera Health Connect-klienten från 1.2.0-alpha01 till 1.2.0-alpha06 för Android 16 och verifiera versionen i varje bygge.

## Passloggning (okt 2026)
- [x] Vilotimer på som standard vid avbockning, Hoppa över/+30 s
- [x] Passlängd från första avbockade set
- [x] Set/volym/ton från samma avbockade set
- [x] Synkbanner flyttar inte layout
- [x] Knapp "Nytt enskilt pass" med aktiv plan
- [x] Varning vid tom vikt
- [x] Avslutade pass publiceras korrekt igen

## Kondition & statistik (okt 2026)
- [x] Intervallpass sparar total tid (arbete+vila), varje intervall och vila
- [x] Validera konditionsinmatning (tomt pass, orimlig fart/tempo)
- [x] Planens löppass: förifyllt tempo räknas inte som resultat; kräver loggning; fråga innan arkivering vid planstart
- [x] Sökning "Löpning" ger träffar
- [x] Hem "Veckan x/y" och Statistik räknar samma
- [ ] Topplista med fler mått än antal pass

## Kost-testrapport 2026-10-13 (50 fynd)
- [x] K1 träning höjer dagsmål/kolhydrater, löppass räknas via distans
- [x] K2/H4 Mål och kostvy väntar på data innan värden visas/sparas
- [x] K3 Mål skriver bara vikt när den faktiskt ändrats (utgår från senaste vägning)
- [x] H1 dubbelklick-skydd: Lägg till, Igår, Mallar
- [x] H3 sökning: mjolk, kycklingfilé, engelska ord, energigel/whey
- [x] H5 kön ej angivet → medelvärde; H6 (delvis) förklaringar i Mål
- [ ] H2 omtest långa namn, H6 ordlista/intro, H7 restaurangsökning, H8 datumförskjutning löppass
- [x] H2 egna livsmedel: namngräns 120 tecken, dubbelklicksskydd
- [x] M1 kcal/makro-kontroll i Snabbpost och Eget livsmedel
- [x] M6 recept: radera, portioner 1–50; M7 radera egna livsmedel; M8 ångra vid borttag i Redigera, bekräfta mallradering
- [x] L2 standardmakron = 2000 kcal; L4 förhandsvisning vid ogiltig mängd; L5 versaler/kamerafel/förkortningar; L7 streckkodsvalidering; L8 varning framtida dag; L17 förklaring Igår
- [x] M4 prognos räknar ologgade dagar med snittet, L1 avrundning, L9 fiber "rek.", L12 namngräns, L16 fliken stannar, M17 recepttext
- [x] M2 cykelkcal från watt, M3 watt-enhet på Hem och i delning, M19 måltidsnamn på knappen
- [x] H6 ordlista: kcal, makros P/F/K och TDEE förklaras i Hjälp & tips
- [x] M9 "Söker…" visas i stället för "Inga träffar" medan sökningen pågår
- [x] M10 gamla märkesprodukter rensas direkt vid ny sökning
- [x] M13 målet räknas automatiskt om när vikt/profil ändras i Mål (verifierat i koden)
- [x] M15 viktprognos kräver minst 5 vägningar över 7 dagar, annars förklaring
- [x] L6 svensk sortering (Å/Ä/Ö sist) i livsmedelslistan
- [x] L12 egna måltider får 15 % av dagsmålet i stället för 0 kcal
- [x] L13 viktgrafens högeraxel döljs utan vägningar; "kg på N dagar" visar faktiskt spann
- [x] L15 varning vid stängning av Mål med osparade ändringar
- [x] L18 Förbränt ⓘ har tryckbar förklaring (fanns redan)
- [x] L19 sportdryck/gel/sportbar räknas inte in i matkvaliteten
- [x] L20 topplistan visar bara "Du syns inte" när du faktiskt är dold
- [x] Mål: protein/fett/kolhydrater som reglage som bara sparar när de summerar till kalorierna, med knapp som återställer till ursprungliga värden (verifierad i appen)
- [ ] Kvar: H2 omtest långa namn, H6 nybörjarintro, H7 restaurangsökning, H8 datum löppass (behöver återskapas), M5 tomma grafer, M11 sökordning/portioner, M12 mikrovärden, M14 målhistorik, M16 bakåtknapp/omladdning, M18 fiber vid byte, L3 gränser, L10 enheter, L11 Esc/tillgänglighet, L14 vatten över 8 glas
- [x] Vikt sparas alltid som vägning: profil, mål och kost loggar till body_weight_logs via src/lib/bodyWeight.ts och graferna laddar om direkt (grim:weight-changed)
