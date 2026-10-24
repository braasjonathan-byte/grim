#!/usr/bin/env node
/**
 * GRIM_HC_BACKGROUND: dygnssammanfattning (steg, kalorier, distans, sömn, puls,
 * vilopuls, vikt) och bakgrundssynk via WorkManager för capacitor-health.
 * Körs efter patch-health-write.cjs. Idempotent: varje steg har en egen markör.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "node_modules", "capacitor-health", "android");
const MAIN = path.join(ROOT, "src", "main");
const PKG_DIR = path.join(MAIN, "java/com/fit_up/health/capacitor");
const PLUGIN_KT = path.join(PKG_DIR, "HealthPlugin.kt");
const GRADLE = path.join(ROOT, "build.gradle");
const MANIFEST = path.join(MAIN, "AndroidManifest.xml");
const TAG = "[patch-health-background]";

const fail = (msg) => {
  console.error(`${TAG} ${msg} — bygget får inte fortsätta opatchat.`);
  process.exit(1);
};
const writeIfChanged = (file, text) => {
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text, "utf8");
};
for (const f of [PLUGIN_KT, GRADLE, MANIFEST]) if (!fs.existsSync(f)) fail(`saknar ${path.basename(f)}`);
if (!fs.readFileSync(PLUGIN_KT, "utf8").includes("GRIM_HC_WRITE_METHODS")) fail("kör patch-health-write.cjs först");

// 1. WorkManager-beroende
let gradle = fs.readFileSync(GRADLE, "utf8");
if (!gradle.includes("GRIM_HC_WORKMANAGER")) {
  const anchor = "    implementation 'androidx.health.connect:connect-client:1.1.0'";
  if (!gradle.includes(anchor)) fail("hittade inte connect-client i build.gradle");
  gradle = gradle.replace(anchor, `${anchor}\n    // GRIM_HC_WORKMANAGER: bakgrundssynk\n    implementation 'androidx.work:work-runtime-ktx:2.9.1'`);
}
writeIfChanged(GRADLE, gradle);

// 2. Behörigheter i pluginets manifest
let manifest = fs.readFileSync(MANIFEST, "utf8");
for (const perm of ["READ_RESTING_HEART_RATE", "READ_HEALTH_DATA_IN_BACKGROUND", "READ_WEIGHT"]) {
  const full = `android.permission.health.${perm}`;
  if (!manifest.includes(`android:name="${full}"`)) {
    manifest = manifest.replace("<application>", `<uses-permission android:name="${full}"/>\n    <application>`);
  }
}
writeIfChanged(MANIFEST, manifest);

// 3. Kotlin-klassen
writeIfChanged(path.join(PKG_DIR, "GrimHealthBackground.kt"), fs.readFileSync(path.join(__dirname, "android", "GrimHealthBackground.kt"), "utf8"));

let kt = fs.readFileSync(PLUGIN_KT, "utf8");

// 4. Enum + mapping
if (!kt.includes("GRIM_HC_BACKGROUND_ENUM")) {
  const a = "    WRITE_WORKOUTS, WRITE_ACTIVE_CALORIES, WRITE_DISTANCE;";
  if (!kt.includes(a)) fail("hittade inte WRITE-enumen");
  kt = kt.replace(a, "    WRITE_WORKOUTS, WRITE_ACTIVE_CALORIES, WRITE_DISTANCE,\n    // GRIM_HC_BACKGROUND_ENUM\n    READ_RESTING_HEART_RATE, READ_BACKGROUND;");
}
if (!kt.includes("GRIM_HC_BACKGROUND_MAPPING")) {
  const a = '        Pair(CapHealthPermission.WRITE_DISTANCE, "android.permission.health.WRITE_DISTANCE")';
  if (!kt.includes(a)) fail("hittade inte WRITE-mappingen");
  kt = kt.replace(
    a,
    `${a},\n        // GRIM_HC_BACKGROUND_MAPPING\n        Pair(CapHealthPermission.READ_RESTING_HEART_RATE, "android.permission.health.READ_RESTING_HEART_RATE"),\n        Pair(CapHealthPermission.READ_BACKGROUND, "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND")`,
  );
}

// 5. Plugin-metoder
const methods = `    // GRIM_HC_BACKGROUND_METHODS
    @PluginMethod
    fun readDailySummary(call: PluginCall) {
        if (!ensureClient()) {
            call.reject("HC_NATIVE_09: Health Connect client unavailable")
            return
        }
        val days = (call.data.opt("days") as? Number)?.toInt() ?: 7
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val summary = kotlinx.coroutines.withTimeout(20000) {
                    val granted = healthConnectClient.permissionController.getGrantedPermissions()
                    GrimHealthBackground.readDailySummary(healthConnectClient, granted, days)
                }
                call.resolve(JSObject.fromJSONObject(summary))
            } catch (e: Exception) {
                Log.e("GRIM_HC", "GRIM_HC: SUMMARY_FAILED", e)
                call.reject("HC_READ_01: \${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @PluginMethod
    fun scheduleBackgroundSync(call: PluginCall) {
        val minutes = (call.data.opt("intervalMinutes") as? Number)?.toLong() ?: 120L
        try {
            GrimHealthBackground.schedule(context, minutes)
            call.resolve(JSObject().put("scheduled", true).put("intervalMinutes", minutes))
        } catch (e: Exception) {
            call.reject("HC_BG_01: \${e.message ?: e.javaClass.simpleName}")
        }
    }

    @PluginMethod
    fun cancelBackgroundSync(call: PluginCall) {
        try {
            GrimHealthBackground.cancel(context)
            call.resolve()
        } catch (e: Exception) {
            call.reject("HC_BG_01: \${e.message ?: e.javaClass.simpleName}")
        }
    }

    @PluginMethod
    fun getBackgroundSyncState(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            val result = JSObject()
            try {
                val ok = ensureClient()
                result.put("featureAvailable", ok && GrimHealthBackground.isBackgroundReadAvailable(healthConnectClient))
                val granted = if (ok) kotlinx.coroutines.withTimeout(8000) {
                    healthConnectClient.permissionController.getGrantedPermissions()
                } else emptySet()
                result.put("permissionGranted", granted.contains(GrimHealthBackground.PERM_BACKGROUND))
                result.put("intervalMinutes", GrimHealthBackground.scheduledInterval(context))
                result.put("pendingWrites", GrimHealthBackground.pending(context).length())
                result.put("cache", JSObject.fromJSONObject(GrimHealthBackground.readCache(context)))
                result.put("sdkInt", android.os.Build.VERSION.SDK_INT)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("HC_BG_02: \${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @PluginMethod
    fun enqueuePendingWrites(call: PluginCall) {
        try {
            val list = call.data.optJSONArray("workouts") ?: org.json.JSONArray()
            GrimHealthBackground.enqueuePending(context, list)
            call.resolve(JSObject().put("pending", GrimHealthBackground.pending(context).length()))
        } catch (e: Exception) {
            call.reject("HC_BG_03: \${e.message ?: e.javaClass.simpleName}")
        }
    }

    @PluginMethod
    fun runBackgroundSyncNow(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val status = kotlinx.coroutines.withTimeout(60000) { GrimHealthBackground.runOnce(context) }
                call.resolve(JSObject.fromJSONObject(status))
            } catch (e: Exception) {
                call.reject("HC_BG_04: \${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

`;
if (!kt.includes("GRIM_HC_BACKGROUND_METHODS")) {
  const anchor = "    // GRIM_HC_WRITE_METHODS";
  kt = kt.replace(anchor, methods + anchor);
}
writeIfChanged(PLUGIN_KT, kt);
console.log(`${TAG} dygnssammanfattning och bakgrundssynk installerade.`);
