# Health Connect: native grundorsak och diagnostik

## Mål
Göra behörighetsflödet stabilt på riktig Android-enhet, ge varje vanligt fel en specifik HC-kod och få knappen **Behörigheter** att öppna rätt vy.

## Genomförande
- Flytta och säkra registreringen av Health Connects behörighets-launcher i pluginets tidiga `load()`-livscykel, på UI-tråden, innan aktivitetens STARTED-läge. Native-koden ska avvisa direkt med en identifierbar setup-kod om registreringen misslyckas i stället för att lämna JS-anropet hängande.
- Lägga native tidsstämplad Logcat-spårning för launcher-registrering, dialogstart och dialogsvar samt returnera maskinläsbara steg/felkoder till webbskiktet.
- Göra patchningen reproducerbar efter varje installation och utöka Android-verifieringen så bygget stoppas om tidig registrering, felrapportering eller rätt inställnings-intent saknas.
- Ersätta felmappningen med HC-01–HC-08 och HC-99, där dialog-timeout, data-timeout och databasfel skiljs åt. Varje steg loggas med tidsstämpel i appen.
- Låta **Behörigheter** öppna Health Connects appspecifika behörighetssida för Grim. Om den inte kan öppnas visas relevant HC-kod i kortet och som meddelande.
- Säkerställa att lyckad datahämtning men misslyckad lagring rapporteras som HC-08, inte som ett tyst varningsmeddelande.
- Uppdatera enhetsdokumentationen och testerna för kodmappning, stegdiagnostik, launcher-livscykel och inställningsknappen.

## Verifiering
- Köra berörda tester och hela testsamlingen.
- Köra typkontroll och Android-pluginverifiering.
- Kontrollera senaste byggresultatet.

## Avgränsning
Den slutliga bekräftelsen att systemdialogen visas och återkommer korrekt kräver fortfarande en ny AAB/APK på den fysiska Android-enheten.
