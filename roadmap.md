# Roadmap

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
- [ ] Kvar: H6 ordlista/intro, H7 restaurangsökning, H8 datum löppass, M2, M3, M5, M9–M16, M18, M19, L3, L6, L10, L11, L13–L15, L18–L20
