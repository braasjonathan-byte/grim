#!/usr/bin/env node
/**
 * GRIM_HC_WRITE: låter Grim skriva genomförda pass till Health Connect.
 * Körs sist i postinstall (efter övriga capacitor-health-patchar). Idempotent:
 * varje steg har en egen markör och hoppas över om den redan finns.
 *
 *  1. WRITE_*-behörigheter i pluginets manifest
 *  2. WRITE_*-värden i CapHealthPermission + permissionMapping
 *  3. GrimHealthWriter.kt (mall i scripts/android/) kopieras in
 *  4. writeWorkout / deleteWorkouts som plugin-metoder
 */
const fs = require("fs");
const path = require("path");

const PLUGIN_DIR = path.join(__dirname, "..", "node_modules", "capacitor-health", "android", "src", "main");
const PLUGIN_KT = path.join(PLUGIN_DIR, "java/com/fit_up/health/capacitor/HealthPlugin.kt");
const WRITER_DST = path.join(PLUGIN_DIR, "java/com/fit_up/health/capacitor/GrimHealthWriter.kt");
const WRITER_SRC = path.join(__dirname, "android", "GrimHealthWriter.kt");
const MANIFEST = path.join(PLUGIN_DIR, "AndroidManifest.xml");
const TAG = "[patch-health-write]";

const WRITE_PERMS = {
  WRITE_WORKOUTS: "android.permission.health.WRITE_EXERCISE",
  WRITE_ACTIVE_CALORIES: "android.permission.health.WRITE_ACTIVE_CALORIES_BURNED",
  WRITE_DISTANCE: "android.permission.health.WRITE_DISTANCE",
};

function fail(msg) {
  console.error(`${TAG} ${msg} — bygget får inte fortsätta opatchat.`);
  process.exit(1);
}

if (!fs.existsSync(PLUGIN_KT) || !fs.existsSync(MANIFEST)) fail("pluginet saknas");

// 1. Manifest
const writeIfChanged = (file, text) => {
  // Skriv bara vid ändring – andra steg/tester kan läsa filen samtidigt.
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text, "utf8");
};

let manifest = fs.readFileSync(MANIFEST, "utf8");
for (const perm of Object.values(WRITE_PERMS)) {
  if (!manifest.includes(`android:name="${perm}"`)) {
    manifest = manifest.replace("<application>", `<uses-permission android:name="${perm}"/>\n    <application>`);
  }
}
writeIfChanged(MANIFEST, manifest);

let kt = fs.readFileSync(PLUGIN_KT, "utf8");

// 2. Enum + mapping
if (!/\bWRITE_WORKOUTS\b/.test(kt.split("companion object")[0])) {
  const enumRe = /(READ_NUTRITION, READ_SLEEP)(;)/;
  if (!enumRe.test(kt)) fail("hittade inte CapHealthPermission-enumen");
  kt = kt.replace(enumRe, `$1,\n    // GRIM_HC_WRITE_ENUM\n    ${Object.keys(WRITE_PERMS).join(", ")}$2`);
}
if (!kt.includes("GRIM_HC_WRITE_MAPPING")) {
  const anchor = 'Pair(CapHealthPermission.READ_NUTRITION, "android.permission.health.READ_NUTRITION")';
  if (!kt.includes(anchor)) fail("hittade inte permissionMapping");
  const pairs = Object.entries(WRITE_PERMS)
    .map(([k, v]) => `        Pair(CapHealthPermission.${k}, "${v}")`)
    .join(",\n");
  kt = kt.replace(anchor, `${anchor},\n        // GRIM_HC_WRITE_MAPPING\n${pairs}`);
}

// 3. Writer-klassen (skrivs alltid över så mallen styr)
writeIfChanged(WRITER_DST, fs.readFileSync(WRITER_SRC, "utf8"));

// 4. Plugin-metoder
const methods = `    // GRIM_HC_WRITE_METHODS
    private fun grimNum(call: PluginCall, key: String): Double? =
        (call.data.opt(key) as? Number)?.toDouble()?.takeIf { !it.isNaN() && !it.isInfinite() }

    @PluginMethod
    fun writeWorkout(call: PluginCall) {
        if (!ensureClient()) {
            call.reject("HC_NATIVE_09: Health Connect client unavailable")
            return
        }
        val input = try {
            val id = call.getString("clientRecordId")
            val start = call.getString("startTime")
            val end = call.getString("endTime")
            require(!id.isNullOrBlank() && start != null && end != null) { "clientRecordId, startTime och endTime krävs" }
            GrimHealthWriter.WorkoutInput(
                clientRecordId = id!!,
                version = grimNum(call, "version")?.toLong() ?: System.currentTimeMillis(),
                start = Instant.parse(start),
                end = Instant.parse(end),
                exerciseType = call.getString("exerciseType") ?: "other",
                title = call.getString("title"),
                notes = call.getString("notes"),
                calories = grimNum(call, "calories"),
                distanceMeters = grimNum(call, "distanceMeters"),
            )
        } catch (e: Exception) {
            call.reject("HC_WRITE_01: \${e.message}")
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = kotlinx.coroutines.withTimeout(10000) {
                    healthConnectClient.permissionController.getGrantedPermissions()
                }
                if (!granted.contains("${WRITE_PERMS.WRITE_WORKOUTS}")) {
                    call.reject("HC_WRITE_DENIED: WRITE_EXERCISE not granted")
                    return@launch
                }
                val allowCalories = granted.contains("${WRITE_PERMS.WRITE_ACTIVE_CALORIES}")
                val allowDistance = granted.contains("${WRITE_PERMS.WRITE_DISTANCE}")
                val ids = kotlinx.coroutines.withTimeout(15000) {
                    GrimHealthWriter.write(healthConnectClient, input, allowCalories, allowDistance)
                }
                Log.i("GRIM_HC", "GRIM_HC: WRITE_OK id=\${input.clientRecordId} v=\${input.version} records=\${ids.size} kcal=\$allowCalories dist=\$allowDistance")
                val result = JSObject()
                result.put("recordIds", JSArray(ids))
                result.put("wroteCalories", allowCalories)
                result.put("wroteDistance", allowDistance)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e("GRIM_HC", "GRIM_HC: WRITE_FAILED id=\${input.clientRecordId}", e)
                call.reject("HC_WRITE_02: \${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @PluginMethod
    fun deleteWorkouts(call: PluginCall) {
        if (!ensureClient()) {
            call.reject("HC_NATIVE_09: Health Connect client unavailable")
            return
        }
        val ids = try {
            call.getArray("clientRecordIds")?.toList<String>().orEmpty().filter { it.isNotBlank() }
        } catch (e: Exception) {
            call.reject("HC_WRITE_01: \${e.message}")
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = kotlinx.coroutines.withTimeout(10000) {
                    healthConnectClient.permissionController.getGrantedPermissions()
                }
                if (!granted.contains("${WRITE_PERMS.WRITE_WORKOUTS}")) {
                    call.reject("HC_WRITE_DENIED: WRITE_EXERCISE not granted")
                    return@launch
                }
                kotlinx.coroutines.withTimeout(15000) {
                    GrimHealthWriter.delete(
                        healthConnectClient, ids,
                        granted.contains("${WRITE_PERMS.WRITE_ACTIVE_CALORIES}"),
                        granted.contains("${WRITE_PERMS.WRITE_DISTANCE}"),
                    )
                }
                Log.i("GRIM_HC", "GRIM_HC: DELETE_OK count=\${ids.size}")
                val result = JSObject()
                result.put("deleted", ids.size)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e("GRIM_HC", "GRIM_HC: DELETE_FAILED", e)
                call.reject("HC_WRITE_03: \${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

`;
if (!kt.includes("GRIM_HC_WRITE_METHODS")) {
  const anchor = "    @PluginMethod\n    fun queryWorkouts(call: PluginCall) {";
  if (!kt.includes(anchor)) fail("hittade inte queryWorkouts");
  kt = kt.replace(anchor, methods + anchor);
}

writeIfChanged(PLUGIN_KT, kt);
console.log(`${TAG} skrivstöd för Health Connect installerat.`);
