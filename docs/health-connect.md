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

## Felkoder

`HealthError.code`: `not-supported`, `not-installed`, `denied`, `partial`,
`timeout`, `network`, `unknown`. Kortet översätter varje kod till ett konkret
besked och rätt knapp (installera / behörigheter / försök igen).

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

## Inte byggt: bakgrundssynk

Att läsa data när appen är stängd kräver behörigheten
`android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND`, en bakgrundsjobb-
implementation (t.ex. WorkManager via ett eget plugin) och ett särskilt
godkännande av datatypanvändningen i Play Console. Inget av detta är påbörjat.
Idag synkas data när användaren öppnar appen eller trycker på Synka.
