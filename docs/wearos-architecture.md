# Grim Wear OS — Arkitektur & Implementationsguide

Status: Förslag. Wear OS-appen är ett **separat Android Studio-projekt** (Kotlin + Jetpack Compose for Wear OS). Den kan inte byggas inom detta Lovable/Capacitor-repo eftersom Wear OS kräver native Kotlin/Java och inte kör en webview för UI-lagret.

Mål: companion-first med standalone-fallback. Klockan pratar i första hand med telefonen via Wear Data Layer (Bluetooth). Om telefonen saknas synkar klockan själv direkt mot Lovable Cloud (Supabase) över WiFi/LTE.

---

## 1. Teknisk stack

| Lager | Val | Motivering |
|------|-----|-----------|
| Språk | Kotlin 2.0 | Standard för Wear OS 4/5 |
| UI | Jetpack Compose for Wear OS 1.4+ | Officiellt, matchar Material för Wear |
| Arkitektur | MVVM + Repository | Standard Android, testbart |
| DI | Hilt | Lättviktigt, fungerar med Compose |
| Lokal DB | Room (SQLite) | Offline-cache av övningar och pass-kö |
| Nätverk | Ktor Client + kotlinx.serialization | Lättare än Retrofit, multiplatform-redo |
| Auth/Backend | Supabase Kotlin SDK (`supabase-kt`) | Samma backend som mobilen |
| Telefon-länk | Wear Data Layer API (`MessageClient`, `DataClient`, `CapabilityClient`) | Officiell Bluetooth-kanal mellan watch ↔ phone |
| GPS | `FusedLocationProviderClient` + `LocationServices` (Health Services för pulse/kadens) | Strömoptimerat |
| Bakgrund | `ForegroundService` med `LocationCallback` + WorkManager för sync | Krav för Android 12+ background location |
| Karta | Statisk polyline (ingen full kartrendering på klockan) | Spar batteri och RAM |
| Build | Android Gradle Plugin 8.5+, minSdk 30 (Wear OS 3+) | Täcker alla moderna Wear-klockor |

Wear OS 3+ täcker Pixel Watch, Galaxy Watch 4/5/6/7, TicWatch Pro 5, Fossil Gen 6. Wear OS 2 (gamla Fossil/Mobvoi) skippas — bara 4% marknad och saknar Compose.

---

## 2. Modulstruktur (separat repo: `grim-wear`)

```text
grim-wear/
├── wear/                         # Wear OS APK
│   ├── src/main/kotlin/se/grim/wear/
│   │   ├── GrimApp.kt            # @HiltAndroidApp
│   │   ├── MainActivity.kt
│   │   ├── ui/
│   │   │   ├── theme/            # Grim-färger, Permanent Marker, Space Grotesk
│   │   │   ├── home/             # HomeScreen — pass-typ-väljare
│   │   │   ├── workout/          # Aktivt pass (GPS + pulse)
│   │   │   ├── exercises/        # Förinlagda övningar (offline-cache)
│   │   │   └── settings/
│   │   ├── service/
│   │   │   └── GpsTrackingService.kt   # ForegroundService
│   │   ├── sync/
│   │   │   ├── WearDataLayer.kt        # Companion-länk
│   │   │   ├── CloudSync.kt            # Standalone-fallback
│   │   │   └── SyncWorker.kt           # WorkManager, periodisk push
│   │   ├── data/
│   │   │   ├── db/                     # Room
│   │   │   ├── repo/                   # Repository pattern
│   │   │   └── model/                  # Delade DTOs
│   │   └── di/                         # Hilt-moduler
│   └── build.gradle.kts
├── shared/                       # KMP-modul (delad logik mellan wear & ev. companion)
│   └── src/commonMain/kotlin/se/grim/shared/
│       ├── dto/                  # WorkoutSession, RoutePoint, Exercise
│       ├── sync/                 # SyncEnvelope, ConflictResolver
│       └── util/                 # HaversineKm, PaceFormatter
└── companion-handheld/           # (valfritt) liten Android-stub som proxyar Wear Data Layer
                                  # till mobil-appens existerande Supabase-klient
```

Mobil-appen (Grim Capacitor) behöver bara en liten Android-plugin som lyssnar på Wear Data Layer-events och vidarebefordrar till existerande Supabase-anrop. Detta görs som en Capacitor-plugin i `android/app/src/main/java/se/grim/app/wear/WearBridgePlugin.kt`. Se §7.

---

## 3. Datamodell — delad sync-modell

All sync sker via samma JSON-envelope oavsett kanal (Bluetooth eller HTTPS).

### 3.1 `workout_sessions` (ny tabell i Lovable Cloud)

| Fält | Typ | Not |
|------|-----|-----|
| `id` | uuid PK | Genereras på klockan (`UUID.randomUUID()`) — idempotent insert |
| `user_id` | uuid | RLS-scope |
| `device_id` | text | `"watch:<wearId>"` eller `"phone"` |
| `type` | text | `running` \| `walking` \| `cycling` \| `strength` |
| `started_at` | timestamptz | UTC |
| `ended_at` | timestamptz | UTC |
| `duration_sec` | int | |
| `distance_km` | numeric(7,3) | |
| `avg_pace_sec_per_km` | int | nullable |
| `avg_hr` | int | nullable |
| `max_hr` | int | nullable |
| `route` | jsonb | `[[lat, lng, t_offset_sec, hr?], ...]` — komprimerad |
| `splits` | jsonb | per-km splits |
| `linked_plan_week` | int | nullable, koppling till `workout_plans` |
| `linked_plan_day` | text | nullable |
| `synced_from` | text | `watch` \| `phone` |
| `client_created_at` | timestamptz | För konfliktlösning |

**Konfliktstrategi:** last-writer-wins på `id`. Eftersom `id` skapas på klockan finns ingen risk för dubletter. Om mobilen råkar logga samma pass manuellt så är det två olika `id` och visas som två pass (användaren får merga manuellt).

### 3.2 `exercise_cache_manifest` (klock-sida, Room)

```kotlin
@Entity(tableName = "exercise_cache")
data class CachedExercise(
    @PrimaryKey val id: String,
    val name: String,
    val muscleGroup: String,
    val isBodyweight: Boolean,
    val defaultSets: Int,
    val defaultReps: Int,
    val updatedAt: Long  // ms epoch — för delta-sync
)
```

Klockan hämtar bara övningar med `updated_at > last_pull` via edge function `wear-exercise-sync`.

### 3.3 Sync-envelope

```kotlin
@Serializable
data class SyncEnvelope(
    val schemaVersion: Int = 1,
    val deviceId: String,
    val sessions: List<WorkoutSessionDto> = emptyList(),
    val ackedSessionIds: List<String> = emptyList(),
    val requestExerciseDelta: Long? = null  // senaste kända updated_at
)
```

Samma envelope används både över Wear Data Layer (`putDataItem`) och HTTPS (`POST /functions/v1/wear-sync`).

---

## 4. Sync-flöden

### 4.1 Companion-läge (default — telefon i närheten)

```text
[Watch]                          [Phone Grim]                    [Lovable Cloud]
   |                                 |                                  |
   | start workout                   |                                  |
   |  GPS samples → Room (kö)        |                                  |
   |                                 |                                  |
   | stop → SyncEnvelope             |                                  |
   |-- MessageClient.sendMessage --> | WearBridgePlugin onMessage       |
   |                                 |-- supabase.from('workout_        |
   |                                 |     sessions').upsert() -------> |
   |                                 | <----------- ok ---------------- |
   | <-- ack(sessionIds) ----------- |                                  |
   |  mark synced=true in Room       |                                  |
```

### 4.2 Standalone-fallback (ingen telefon — WiFi/LTE)

```text
[Watch] -- HTTPS POST /functions/v1/wear-sync --> [Lovable Cloud]
   (samma SyncEnvelope, Bearer access_token i header)
```

Beslutslogik på klockan:

```kotlin
suspend fun sync(envelope: SyncEnvelope): SyncResult {
    val phoneNode = capabilityClient.getNodes("grim_phone_app")
    return if (phoneNode != null && phoneNode.isNearby) {
        wearDataLayer.send(envelope)         // gratis, ingen LTE
    } else if (connectivity.isInternetAvailable()) {
        cloudSync.post(envelope)             // fallback
    } else {
        SyncResult.QueuedOffline             // försök igen via WorkManager
    }
}
```

WorkManager schemalägger retry med exponential backoff (15s → 30s → 1m → 5m → 15m, max 24h).

### 4.3 Pull av övningar (mobil → klocka)

- Vid mobil-uppdatering av `workout_plans` eller `custom_exercises`: edge function `notify-wear-cache-dirty` skickar Wear Data Layer-event `EXERCISE_CACHE_DIRTY`.
- Klockan svarar med `SyncEnvelope(requestExerciseDelta = lastPull)` och får tillbaka delta-payload.
- I standalone: klockan pollar var 6:e timme via `PeriodicWorkRequest`.

---

## 5. Auth

Pairing-flöde första gången klockan installeras:

1. Mobilen visar QR-kod (eller en 6-siffrig kod) som innehåller en one-time pairing-token.
2. Klockan scannar (Wear OS 4 har kamera-pairing via telefon-app) eller användaren matar in koden.
3. Mobilen byter token mot ett `wear_refresh_token` via edge function `wear-pair`.
4. Token sparas i klockans **EncryptedSharedPreferences** (AES-256, hårdvarubackad keystore).
5. Access tokens roterar var 60:e minut via `wear-refresh` (kort TTL = mindre skada om klockan tappas bort).

Säkerhet:
- Alla HTTPS-anrop kräver `Authorization: Bearer <jwt>`.
- Wear Data Layer-meddelanden valideras via HMAC med en delad nyckel som etablerades under pairing — annars kan en illvillig app på telefonen skicka falska pass.
- Vid logga-ut på mobilen: edge function `wear-revoke` invaliderar `wear_refresh_token`. Klockan upptäcker detta vid nästa anrop och rensar lokal cache.

---

## 6. UI-flöden (screen-by-screen, 192–454px runda skärmar)

Design följer mobilens regler i `mem://style/visual-theme`: helt fyrkantiga hörn (anpassat till runda Wear-skärmar = inga avrundningar utöver skärmens form), inga skuggor, Permanent Marker för rubriker, Space Grotesk för data. Primärfärg från `index.css` `--primary`.

### Skärm 1 — Home (entry)
```text
┌─────────────────┐
│   GRIM          │  ← Permanent Marker, ~20sp
│                 │
│  ▶ Löpning      │  ← stora touch-targets (≥48dp)
│    Promenad     │
│    Cykling      │
│    Styrketräning│
│    Övningar     │
└─────────────────┘
```
Vertikal `ScalingLazyColumn` (Wear OS standard, items skalas mot centrum).

### Skärm 2 — Pre-workout (vald aktivitet, t.ex. Löpning)
```text
┌─────────────────┐
│ Löpning         │
│                 │
│  GPS: ●●●●○     │  ← signal-styrka, väntar på fix
│  Puls: 72 bpm   │
│                 │
│   [  START  ]   │  ← stor primary-knapp
└─────────────────┘
```

### Skärm 3 — Aktivt pass (swipe mellan 3 vyer)
- Vy A — primär: stor distans + tid (default)
- Vy B — tempo + senaste km
- Vy C — puls + karta-polyline (mini, statisk)

```text
   Vy A              Vy B              Vy C
┌────────┐       ┌────────┐       ┌────────┐
│ 3.24   │ swipe │ 5:42   │ swipe │ ♥ 158  │
│  km    │  ←→   │ /km    │  ←→   │        │
│        │       │        │       │  ╭─╮   │
│ 18:32  │       │ 5:38   │       │  │ │   │
│        │       │ förra  │       │  ╰─╯   │
└────────┘       └────────┘       └────────┘
```
Long-press → paus/stop-meny. Bezel/rotational input scrollar genom vyer på Galaxy Watch.

### Skärm 4 — Stop confirm
```text
┌─────────────────┐
│ Avsluta pass?   │
│ 3.24 km · 18:32 │
│                 │
│  [Avsluta]      │
│  [Fortsätt]     │
└─────────────────┘
```

### Skärm 5 — Post-workout summary
```text
┌─────────────────┐
│ Bra jobbat!     │
│                 │
│ 3.24 km         │
│ 18:32           │
│ 5:42 /km        │
│ ♥ 152 snitt     │
│                 │
│ ✓ Synkar...     │  → ✓ Synkat
└─────────────────┘
```
Auto-stäng efter 5s eller tap.

### Skärm 6 — Övningsbibliotek (för styrketräning)
`ScalingLazyColumn` med övningar från Room-cachen. Tap → enkel set/reps-logger (+/− knappar).

### Komplikationer (watch face)
- "Senaste pass": distans + datum
- "Veckans pass": räkning (matchar leaderboard-logiken)

---

## 7. Capacitor-bridge i mobilen (det enda som ändras i detta repo)

Skapa en Capacitor-plugin i mobil-appen som proxyar Wear Data Layer-events till befintlig Supabase-klient. Detta är den **enda** koden som behöver läggas till i detta Lovable-repo.

```kotlin
// android/app/src/main/java/se/grim/app/wear/WearBridgePlugin.kt
@CapacitorPlugin(name = "WearBridge")
class WearBridgePlugin : Plugin(), MessageClient.OnMessageReceivedListener {
    override fun load() {
        Wearable.getMessageClient(context).addListener(this)
    }
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == "/grim/sync/v1") {
            val envelope = Json.decodeFromString<SyncEnvelope>(event.data.decodeToString())
            // Forwarda till JS-lagret som anropar supabase.from(...).upsert()
            notifyListeners("syncFromWatch", JSObject().put("envelope", envelope.toJson()))
        }
    }
}
```

JS-sidan (i mobilappen):
```ts
import { WearBridge } from '@/lib/wearBridge';
WearBridge.addListener('syncFromWatch', async ({ envelope }) => {
  await supabase.from('workout_sessions').upsert(envelope.sessions);
  WearBridge.ack(envelope.sessions.map(s => s.id));
});
```

Detta gör att klockan kan vara helt utvecklad separat — kontraktet är JSON-envelopen.

---

## 8. Backend-tillägg (Lovable Cloud)

Edge functions som behöver byggas i detta repo när du är redo:
- `wear-pair` — byter QR-token mot `wear_refresh_token`
- `wear-refresh` — roterar access token
- `wear-revoke` — invaliderar (kallas vid logout på mobil)
- `wear-sync` — tar emot SyncEnvelope (standalone-fallback)
- `wear-exercise-delta` — returnerar övningar `where updated_at > ?`
- `notify-wear-cache-dirty` — trigger vid mobil-uppdatering (skickas via FCM data-message till klockan)

Tabeller som behöver migration:
- `workout_sessions` (se §3.1)
- `wear_devices` (`user_id`, `device_id`, `pairing_secret_hash`, `last_seen_at`, `revoked_at`)

Säg till när du vill att jag bygger backend-delen — då skapar jag migration + edge functions i nästa steg.

---

## 9. Prestanda & batteri

| Område | Strategi |
|--------|----------|
| GPS | `LocationRequest` med `PRIORITY_HIGH_ACCURACY` ENDAST under aktivt pass. Sample-intervall 3s (inte 1s) — räcker för running. Pause-on-still via `ActivityRecognitionClient`. |
| Pulse | Health Services `ExerciseClient` istället för rå sensor — Google-optimerat, batchar samples. |
| Skärm | Always-on Display med dimmad layout (Compose `ambientMode`). Stäng av kart-vy i AOD. |
| Sync | Batcha route-punkter i Room, skicka per km eller var 60:e sekund — inte per sample. |
| Network | Föredra Bluetooth (Wear Data Layer) över LTE — ~10x mindre ström. |
| Background | En enda `ForegroundService` med `FOREGROUND_SERVICE_TYPE_LOCATION`. Ingen extra WorkManager-job under aktivt pass. |
| Polyline-komprimering | Skicka delta-encodade `[dLat*1e5, dLng*1e5, dt]` int-arrays istället för fulla floats — 4x mindre payload. |

Mål: 1h löpning med GPS + pulse + AOD ska kosta ~15% batteri på Pixel Watch 2.

---

## 10. Roadmap — implementationsordning

1. **Detta repo**: Migration för `workout_sessions` + `wear_devices`, edge functions `wear-pair`/`wear-sync`/`wear-exercise-delta`, Capacitor-plugin `WearBridge`.
2. **Nytt repo `grim-wear`**: Skaffold med Android Studio (Wear OS template), implementera Home + GPS-pass + Room.
3. Pairing-flöde (QR i mobilen, scanner på klockan).
4. Companion-sync via Wear Data Layer.
5. Standalone-fallback via HTTPS.
6. Övningsbibliotek + styrketräningslogger.
7. Komplikationer + Tiles.
8. Play Console: separat listing för Wear-appen (`se.grim.wear`), länkas till handheld-listingen.

---

## 11. Vad detta INTE löser

- watchOS / Apple Watch — kräver Mac + Xcode + separat SwiftUI-projekt. Kan göras senare med samma backend-kontrakt (§3, §8).
- Realtidsstreaming av pass till mobilen *under* träningen (typ live-tracking för vänner) — möjligt men kostar batteri. Inte i v1.
- Musikkontroll på klockan — Wear OS hanterar detta nativt via media-session, behöver inte byggas av oss.
