#!/usr/bin/env node
/**
 * GRIM_HC_NUTRITION: kost + vatten → Health Connect. Körs efter patch-health-background.cjs.
 * Idempotent (markörer). Kräver ny AAB för att nå användarna.
 *  1. WRITE_NUTRITION / WRITE_HYDRATION i pluginets manifest
 *  2. Enum + permissionMapping
 *  3. GrimNutritionWriter.kt kopieras in
 *  4. writeNutrition / writeHydration / deleteNutrition som plugin-metoder
 */
const fs = require("fs");
const path = require("path");
const PLUGIN_DIR = path.join(__dirname, "..", "node_modules", "capacitor-health", "android", "src", "main");
const PLUGIN_KT = path.join(PLUGIN_DIR, "java/com/fit_up/health/capacitor/HealthPlugin.kt");
const WRITER_DST = path.join(PLUGIN_DIR, "java/com/fit_up/health/capacitor/GrimNutritionWriter.kt");
const WRITER_SRC = path.join(__dirname, "android", "GrimNutritionWriter.kt");
const MANIFEST = path.join(PLUGIN_DIR, "AndroidManifest.xml");
const TAG = "[patch-health-nutrition-write]";
const PERMS = {
  WRITE_NUTRITION: "android.permission.health.WRITE_NUTRITION",
  WRITE_HYDRATION: "android.permission.health.WRITE_HYDRATION",
};
function fail(m) { console.error(`${TAG} ${m} — bygget får inte fortsätta opatchat.`); process.exit(1); }
const writeIfChanged = (f, t) => { if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== t) fs.writeFileSync(f, t, "utf8"); };
if (!fs.existsSync(PLUGIN_KT) || !fs.existsSync(MANIFEST)) fail("pluginet saknas");

let manifest = fs.readFileSync(MANIFEST, "utf8");
for (const p of Object.values(PERMS)) {
  if (!manifest.includes(`android:name="${p}"`)) manifest = manifest.replace("<application>", `<uses-permission android:name="${p}"/>\n    <application>`);
}
writeIfChanged(MANIFEST, manifest);

let kt = fs.readFileSync(PLUGIN_KT, "utf8");
if (!kt.includes("GRIM_HC_NUTRITION_ENUM")) {
  const a = "    READ_RESTING_HEART_RATE, READ_BACKGROUND;";
  if (!kt.includes(a)) fail("hittade inte BACKGROUND-enumen");
  kt = kt.replace(a, "    READ_RESTING_HEART_RATE, READ_BACKGROUND,\n    // GRIM_HC_NUTRITION_ENUM\n    WRITE_NUTRITION, WRITE_HYDRATION;");
}
if (!kt.includes("GRIM_HC_NUTRITION_MAPPING")) {
  const a = '        Pair(CapHealthPermission.READ_BACKGROUND, "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND")';
  if (!kt.includes(a)) fail("hittade inte BACKGROUND-mappingen");
  kt = kt.replace(a, `${a},\n        // GRIM_HC_NUTRITION_MAPPING\n        Pair(CapHealthPermission.WRITE_NUTRITION, "${PERMS.WRITE_NUTRITION}"),\n        Pair(CapHealthPermission.WRITE_HYDRATION, "${PERMS.WRITE_HYDRATION}")`);
}
writeIfChanged(WRITER_DST, fs.readFileSync(WRITER_SRC, "utf8"));

const methods = `    // GRIM_HC_NUTRITION_METHODS
    private fun grimNutNum(o: org.json.JSONObject, k: String): Double? =
        (o.opt(k) as? Number)?.toDouble()?.takeIf { !it.isNaN() && !it.isInfinite() }

    private fun grimNutGranted(call: PluginCall, perm: String, block: suspend () -> JSObject) {
        if (!ensureClient()) { call.reject("HC_NATIVE_09: Health Connect client unavailable"); return }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = kotlinx.coroutines.withTimeout(10000) { healthConnectClient.permissionController.getGrantedPermissions() }
                if (!granted.contains(perm)) { call.reject("HC_WRITE_DENIED: \${perm.substringAfterLast('.')} not granted"); return@launch }
                call.resolve(kotlinx.coroutines.withTimeout(20000) { block() })
            } catch (e: Exception) {
                Log.e("GRIM_HC", "GRIM_HC: NUTRITION_FAILED", e)
                call.reject("HC_WRITE_04: \${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @PluginMethod
    fun writeNutrition(call: PluginCall) {
        val meals = try {
            val arr = call.getArray("meals") ?: JSArray()
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                GrimNutritionWriter.MealInput(
                    clientRecordId = o.getString("clientRecordId"),
                    version = (o.opt("version") as? Number)?.toLong() ?: System.currentTimeMillis(),
                    start = Instant.parse(o.getString("startTime")), end = Instant.parse(o.getString("endTime")),
                    mealType = o.optString("mealType", ""), name = o.optString("name", "").ifBlank { null },
                    kcal = grimNutNum(o, "kcal") ?: 0.0,
                    protein = grimNutNum(o, "protein"), fat = grimNutNum(o, "fat"), carbs = grimNutNum(o, "carbs"),
                    fiber = grimNutNum(o, "fiber"), sugar = grimNutNum(o, "sugar"),
                )
            }
        } catch (e: Exception) { call.reject("HC_WRITE_01: \${e.message}"); return }
        grimNutGranted(call, "${PERMS.WRITE_NUTRITION}") {
            val n = GrimNutritionWriter.writeMeals(healthConnectClient, meals)
            JSObject().apply { put("written", n) }
        }
    }

    @PluginMethod
    fun writeHydration(call: PluginCall) {
        val items = try {
            val arr = call.getArray("items") ?: JSArray()
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                GrimNutritionWriter.WaterInput(
                    clientRecordId = o.getString("clientRecordId"),
                    version = (o.opt("version") as? Number)?.toLong() ?: System.currentTimeMillis(),
                    start = Instant.parse(o.getString("startTime")), end = Instant.parse(o.getString("endTime")),
                    ml = grimNutNum(o, "ml") ?: 0.0,
                )
            }
        } catch (e: Exception) { call.reject("HC_WRITE_01: \${e.message}"); return }
        grimNutGranted(call, "${PERMS.WRITE_HYDRATION}") {
            val n = GrimNutritionWriter.writeWater(healthConnectClient, items)
            JSObject().apply { put("written", n) }
        }
    }

    @PluginMethod
    fun deleteNutrition(call: PluginCall) {
        val nut = call.getArray("nutritionIds")?.toList<String>().orEmpty()
        val water = call.getArray("hydrationIds")?.toList<String>().orEmpty()
        grimNutGranted(call, "${PERMS.WRITE_NUTRITION}") {
            GrimNutritionWriter.deleteNutrition(healthConnectClient, nut)
            try { GrimNutritionWriter.deleteWater(healthConnectClient, water) } catch (_: Exception) { }
            JSObject().apply { put("deleted", nut.size + water.size) }
        }
    }

`;
if (!kt.includes("GRIM_HC_NUTRITION_METHODS")) {
  // Före GRIM_HC_WRITE_METHODS så skrivpatchens metodblock (och dess tester) förblir orört.
  const a = "    // GRIM_HC_WRITE_METHODS";
  if (!kt.includes(a)) fail("hittade inte GRIM_HC_WRITE_METHODS");
  kt = kt.replace(a, methods + a);
}
writeIfChanged(PLUGIN_KT, kt);
console.log(`${TAG} kost/vatten-skrivning för Health Connect installerad.`);
