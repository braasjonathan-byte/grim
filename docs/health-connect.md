# Health Connect / Samsung Health i Grim

Samsung Health har ingen öppen konsument-API. På Android skriver Samsung Health sin
data till systemets Health Connect-lager, och Grim läser därifrån via
`capacitor-health`. Apple Health används på iOS via samma plugin.

## Kedjan

1. `isHealthSupported()` – körs appen nativt? Annars visas inget hälsokort.
2. `healthAvailability()` – `available` | `not-installed` | `not-supported`.
   På Android tolkas "inte tillgänglig" som att Health Connect saknas eller
   behöver uppdateras, och kortet visar en knapp till Play Store.
3. `requestHealthPermissions()` – begär alla behörigheter i en dialog, med
   reservbegäran för enbart grunddatan (steg, aktiva kalorier, distans) om
   enheten avvisar hela uppsättningen. Fel kastas som `HealthError` med kod.
   Dialoganropet har en hård 20-sekundersgräns som inte kan pausas av Androids
   fokus-/synlighetsstatus. Hela den manuella synken har dessutom ett fristående
   45-sekunders säkerhetsnät, så knappen kan aldrig lämnas i laddningsläge.
4. `readHealthDays(days)` – aggregerade dygnsvärden (steg, aktiva kalorier,
   sömn). Health Connect aggregerar själv över källor, så samma steg räknas
   inte dubbelt även om både telefon och klocka skriver dem.
5. `readHealthWorkouts(days)` – pass med tid, distans (m → km), kalorier och
   puls. `dedupeWorkouts` slår ihop pass av samma typ som överlappar minst 50 %
   i tid (Samsung Health + klocka), och behåller det med mest data.
6. `importHealthWorkouts` – skapar pass och klarmarkering i Grim med
   `week = 0` och dagnyckeln `YYYY-MM-DD_hc<key>`, vilket gör importen
   idempotent.

## Synkfönster

`syncWindowDays(lastSync)` räknar ut hur långt bakåt som ska hämtas utifrån
senaste lyckade synk: minst 2 dagar (dagens värden ändras hela tiden), högst 30.
Tidpunkten sparas i localStorage (`grim_health_last_sync`) först när sparandet
mot databasen lyckats, så ett nätverksfel aldrig skapar ett hål i datan.
Dygnsrader skrivs med `upsert` på `user_id,day` – upprepad synk kan inte dubblera.

## Dagnycklar och tidszon

Dygn grupperas i telefonens lokala tidszon. En UTC-nyckel skulle flytta svensk
data ett dygn bakåt (lokal midnatt = 22:00 UTC föregående dag).

## Felkoder och spårning

- `HC-01`: Health Connect är inte installerat.
- `HC-02`: Health Connect-providern behöver uppdateras.
- `HC-03`: Android kunde inte registrera eller starta behörighets-launchern.
- `HC-03b`: själva starten av behörighetsrutan misslyckades direkt (native `HC_NATIVE_05`), ingen ruta hann visas.
- `HC-04`: inget svar kom inom tidsgränsen och det går inte att bekräfta att rutan visades.
- `HC-05`: användaren nekade grundbehörighet.
- `HC-06`: bara en del av datatyperna tilläts.
- `HC-07`: behörighet finns men datahämtningen timeoutade.
- `HC-08`: data hämtades men kunde inte sparas i Grim.
- `HC-99`: verkligt okategoriserat fel.

Varje steg loggas med tidsstämpel i webbappen (`[health] ... step=...`) och i
Android Logcat med taggen `CapHealth`: launcher-registrering, dialogstart,
dialogsvar, data-request, data-svar, databasstart och databassvar.

Pluginets `ActivityResultLauncher` registreras synkront i `Plugin.load()`, som
Capacitor kör från `BridgeActivity.onCreate`. Den verkliga avvikelsen i
originalpluginet var att den redan registrerade launchern startades från
`Dispatchers.IO`; Grims reproducerbara patch flyttar starten till UI-tråden och
avvisar direkt med `HC_NATIVE_03` om setupen ändå misslyckas.
Native-watchdoggen avvisar bryggan innan det sparade anropet släpps; om ordningen
vänds kan Capacitor tappa felet och lämna JavaScript-löftet permanent väntande.

Knappen **Behörigheter** öppnar den appspecifika Health Connect-vyn för Grims
paket, inte bara Health Connects allmänna startsida.

## Livscykel

Statusen läses om varje gång appen kommer i förgrunden, så en åtkomst som
återkallats i Health Connect syns direkt i kortet.

## Android-krav (kontrolleras av `scripts/verify-android-plugins.cjs`)

- `minSdkVersion 26`.
- `android.permission.health.*` för steg, aktiva och totala kalorier, distans,
  pass (`READ_EXERCISE`), puls och sömn.
- `<queries>` för `com.google.android.apps.healthdata` och
  `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`.
- Rationale-aktiviteten `se.grim.app.HealthPrivacyActivity` med kategorierna
  `DEFAULT` och `HEALTH_PERMISSIONS`, som öppnar `privacy_policy_url`
  (https://grim.lovable.app/privacy) i telefonens webbläsare.
- `scripts/patch-capacitor-health.cjs` lägger till sömnstöd i pluginet.
- Alla Android-flöden patchar före `cap sync`, verifierar den installerade
  Kotlin-källan och rensar bara pluginets kompilerade utdata för att förhindra
  att en gammal native-klass återanvänds från cache.

## Inte byggt: bakgrundssynk

Att läsa data när appen är stängd kräver behörigheten
`android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND`, en bakgrundsjobb-
implementation (t.ex. WorkManager via ett eget plugin) och ett särskilt
godkännande av datatypanvändningen i Play Console. Inget av detta är påbörjat.
Idag synkas data när användaren öppnar appen eller trycker på Synka.
