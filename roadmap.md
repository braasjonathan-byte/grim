# Roadmap

- [x] Ta bort kategorierna "Träningsinnehåll" och "Community" från Verktyg-fliken.
- [x] Flytta "Radera konto"-knappen in i Inställningar längst ner.
- [x] Flytta passknapparna längst ned i träningskortet och gör passnamnet tryckbart för namnbyte.

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
