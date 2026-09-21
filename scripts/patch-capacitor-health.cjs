#!/usr/bin/env node
/**
 * capacitor-health@8.2.0 saknar stöd för sömn (SleepSessionRecord) och pinnar
 * androidx.core:core-ktx till en äldre version än resten av projektet.
 *
 * Skriptet patchar det installerade pluginet så att:
 *  1. READ_SLEEP finns som behörighet (enum, @CapacitorPlugin, permissionMapping,
 *     plugin-manifestet)
 *  2. queryAggregated stödjer dataType "sleep" (minuter per dag)
 *  3. AGP och core-ktx följer rootProject
 *
 * Körs efter `npm ci`/`npm install` och före `npx cap sync android`.
 * Skriptet är idempotent.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = path.join(ROOT, "node_modules", "capacitor-health", "android");
const PLUGIN_KT = path.join(
  BASE,
  "src/main/java/com/fit_up/health/capacitor/HealthPlugin.kt"
);
const PLUGIN_MANIFEST = path.join(BASE, "src/main/AndroidManifest.xml");
const GRADLE = path.join(BASE, "build.gradle");
const AGP_VERSION = "8.13.0";

if (!fs.existsSync(PLUGIN_KT)) {
  console.log("[patch-capacitor-health] pluginet saknas — hoppar över.");
  process.exit(0);
}

let kt = fs.readFileSync(PLUGIN_KT, "utf8");
const ktBefore = kt;

// 1. Import av SleepSessionRecord
if (!kt.includes("records.SleepSessionRecord")) {
  kt = kt.replace(
    "import androidx.health.connect.client.records.Record\n",
    "import androidx.health.connect.client.records.Record\nimport androidx.health.connect.client.records.SleepSessionRecord\n"
  );
}

// 2. Enum-värde
if (!/READ_SLEEP/.test(kt)) {
  kt = kt.replace(
    "READ_WEIGHT, READ_HEIGHT, READ_BODY_FAT, READ_LEAN_BODY_MASS;",
    "READ_WEIGHT, READ_HEIGHT, READ_BODY_FAT, READ_LEAN_BODY_MASS, READ_SLEEP;"
  );
}

// 3. @CapacitorPlugin-behörighet
if (!kt.includes('alias = "READ_SLEEP"')) {
  kt = kt.replace(
    /(\s*)Permission\(\s*\n\s*alias = "READ_LEAN_BODY_MASS",/,
    `$1Permission(
            alias = "READ_SLEEP",
            strings = ["android.permission.health.READ_SLEEP"]
        ),$1Permission(
            alias = "READ_LEAN_BODY_MASS",`
  );
}

// 4. permissionMapping
if (!kt.includes('CapHealthPermission.READ_SLEEP, "android.permission.health.READ_SLEEP"')) {
  kt = kt.replace(
    /Pair\(CapHealthPermission\.READ_LEAN_BODY_MASS, "android\.permission\.health\.READ_LEAN_BODY_MASS"\)/,
    'Pair(CapHealthPermission.READ_LEAN_BODY_MASS, "android.permission.health.READ_LEAN_BODY_MASS"),\n        Pair(CapHealthPermission.READ_SLEEP, "android.permission.health.READ_SLEEP")'
  );
}

// 5. queryAggregated: dataType "sleep" i minuter
if (!kt.includes('"sleep" -> metricAndMapper')) {
  kt = kt.replace(
    /(\s*)"distance" -> metricAndMapper\("distance", CapHealthPermission\.READ_DISTANCE, DistanceRecord\.DISTANCE_TOTAL\) \{ it\?\.inMeters \}/,
    `$1"distance" -> metricAndMapper("distance", CapHealthPermission.READ_DISTANCE, DistanceRecord.DISTANCE_TOTAL) { it?.inMeters }$1"sleep" -> metricAndMapper(
                "sleep",
                CapHealthPermission.READ_SLEEP,
                SleepSessionRecord.SLEEP_DURATION_TOTAL
            ) { it?.toMinutes()?.toDouble() }`
  );
}

// 5b. Behörighetsdialogen måste startas från UI-tråden. Pluginet kör
// permissionsLauncher.launch() på Dispatchers.IO, vilket gör att Health
// Connect-dialogen aldrig öppnas på vissa enheter – anropet varken resolvas
// eller rejectas och appen fastnar i laddningsläge.
if (!kt.includes("activity.runOnUiThread {")) {
  kt = kt.replace(
    /CoroutineScope\(Dispatchers\.IO\)\.launch \{\s*\n\s*try \{\s*\n\s*requestPermissionContext\.set\(RequestPermissionContext\(permissions, call\)\)\s*\n\s*permissionsLauncher\.launch\(healthConnectPermissions\)\s*\n\s*\} catch \(e: Exception\) \{\s*\n\s*call\.reject\("Permission request failed: \$\{e\.message\}"\)\s*\n\s*requestPermissionContext\.set\(null\)\s*\n\s*\}\s*\n\s*\}/,
    `activity.runOnUiThread {
            try {
                Log.i(tag, "requesting health permissions: $healthConnectPermissions")
                requestPermissionContext.set(RequestPermissionContext(permissions, call))
                permissionsLauncher.launch(healthConnectPermissions)
            } catch (e: Exception) {
                Log.e(tag, "permission request failed", e)
                requestPermissionContext.set(null)
                call.reject("Permission request failed: \${e.message}")
            }
        }`
  );
}


// 5c. Om callbacken saknar context (t.ex. efter att aktiviteten återskapats)
// blev anropet hängande för alltid. Logga i stället för att tiga ihjäl det.
if (!kt.includes("no pending permission call")) {
  kt = kt.replace(
    /val context = requestPermissionContext\.get\(\)\s*\n\s*if \(context != null\) \{\s*\n\s*val result = grantedPermissionResult\(context\.requestedPermissions, grantedPermissions\)\s*\n\s*context\.pluginCal\.resolve\(result\)\s*\n\s*\}/,
    `val context = requestPermissionContext.get()
            if (context != null) {
                Log.i(tag, "permission result: $grantedPermissions")
                val result = grantedPermissionResult(context.requestedPermissions, grantedPermissions)
                requestPermissionContext.set(null)
                context.pluginCal.resolve(result)
            } else {
                Log.w(tag, "no pending permission call for result: $grantedPermissions")
            }`
  );
}

// 5d. checkHealthPermissions använder en lateinit-klient som bara initieras av
// isHealthAvailable(). Anropas den först kastas UninitializedPropertyAccess.
if (!kt.includes("fun ensureClient()")) {
  kt = kt.replace(
    /    @PluginMethod\n    fun checkHealthPermissions\(call: PluginCall\) \{/,
    `    private fun ensureClient(): Boolean {
        if (available) return true
        return try {
            healthConnectClient = HealthConnectClient.getOrCreate(context)
            available = true
            true
        } catch (e: Exception) {
            Log.e(tag, "health connect client unavailable", e)
            false
        }
    }

    @PluginMethod
    fun checkHealthPermissions(call: PluginCall) {
        if (!ensureClient()) {
            call.reject("Health Connect is not available")
            return
        }`
  );
}

// 5e. Kontexten låg bara i minnet. Återskapas aktiviteten medan Health Connect
// ligger överst (t.ex. vid rotation eller minnesbrist) tappas anropet och
// JS-löftet blir aldrig klart. Spara därför även anropet i bryggan och svara
// på det om kontexten är borta.
if (!kt.includes("GRIM_SAVED_PERMISSION_CALL")) {
  kt = kt.replace(
    /                requestPermissionContext\.set\(RequestPermissionContext\(permissions, call\)\)/,
    `                // GRIM_SAVED_PERMISSION_CALL
                call.setKeepAlive(true)
                bridge.saveCall(call)
                lastPermissionCallId = call.callbackId
                lastRequestedPermissions = permissions
                requestPermissionContext.set(RequestPermissionContext(permissions, call))`
  );
  kt = kt.replace(
    /                Log\.w\(tag, "no pending permission call for result: \$grantedPermissions"\)/,
    `                val saved = lastPermissionCallId?.let { bridge.getSavedCall(it) }
                if (saved != null) {
                    Log.w(tag, "resolving saved permission call after activity recreation")
                    saved.resolve(grantedPermissionResult(lastRequestedPermissions, grantedPermissions))
                    bridge.releaseCall(saved)
                } else {
                    Log.w(tag, "no pending permission call for result: $grantedPermissions")
                }`
  );
  kt = kt.replace(
    /    private val requestPermissionContext = AtomicReference<RequestPermissionContext>\(\)/,
    `    private val requestPermissionContext = AtomicReference<RequestPermissionContext>()
    private var lastPermissionCallId: String? = null
    private var lastRequestedPermissions: Set<CapHealthPermission> = emptySet()`
  );
}

// 5f. sourceName sattes ihop av appnamnet plus modellnamnet två gånger.
kt = kt.replace(
  /(\$\{[^}]*device\?\.model[^}]*\})\s*\1/g,
  "$1"
);



if (kt !== ktBefore) {
  fs.writeFileSync(PLUGIN_KT, kt, "utf8");
  console.log("[patch-capacitor-health] HealthPlugin.kt: sömnstöd tillagt.");
} else {
  console.log("[patch-capacitor-health] HealthPlugin.kt redan patchad.");
}

// 6. Plugin-manifestet ska deklarera READ_SLEEP
if (fs.existsSync(PLUGIN_MANIFEST)) {
  let xml = fs.readFileSync(PLUGIN_MANIFEST, "utf8");
  if (!xml.includes("android.permission.health.READ_SLEEP")) {
    xml = xml.replace(
      "</manifest>",
      '    <uses-permission android:name="android.permission.health.READ_SLEEP"/>\n</manifest>'
    );
    fs.writeFileSync(PLUGIN_MANIFEST, xml, "utf8");
    console.log("[patch-capacitor-health] Plugin-manifest: READ_SLEEP tillagd.");
  }
}

// 7. Gradle: samma AGP och core-ktx som rootProject
if (fs.existsSync(GRADLE)) {
  let gradle = fs.readFileSync(GRADLE, "utf8");
  const gradleBefore = gradle;
  gradle = gradle.replace(
    /classpath ['"]com\.android\.tools\.build:gradle:[^'"]+['"]/g,
    `classpath 'com.android.tools.build:gradle:${AGP_VERSION}'`
  );
  gradle = gradle.replace(
    /implementation ["']androidx\.core:core-ktx:[^"']+["']/g,
    'implementation "androidx.core:core-ktx:$androidxCoreKTXVersion"'
  );
  if (!gradle.includes("androidxCoreKTXVersion =")) {
    gradle = gradle.replace(
      /ext \{/,
      "ext {\n    androidxCoreKTXVersion = rootProject.ext.has('androidxCoreVersion') ? rootProject.ext.androidxCoreVersion : '1.13.1'"
    );
  }
  if (gradle !== gradleBefore) {
    fs.writeFileSync(GRADLE, gradle, "utf8");
    console.log("[patch-capacitor-health] build.gradle uppdaterad.");
  } else {
    console.log("[patch-capacitor-health] build.gradle redan patchad.");
  }
}
