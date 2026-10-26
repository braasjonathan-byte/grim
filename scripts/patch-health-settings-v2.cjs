#!/usr/bin/env node
/**
 * GRIM_SETTINGS_V2: öppnar Grims behörigheter i Health Connect på ett sätt som
 * går att lita på, och rapporterar exakt vad som hände.
 *
 * V1 (GRIM_SETTINGS_CANDIDATES) räknade ett lyckat startActivity() som "öppnat".
 * Health Connect stänger dock sin vy direkt i vissa lägen (t.ex. om appen inte
 * känns igen eller på vissa Samsung-versioner) – då såg användaren ingenting och
 * fick ändå "lyckat". V2:
 *  - väljer kandidater efter Android-version (14+ = systemets Health Connect,
 *    13 och äldre = Health Connect-appen) och hoppar över intents som inte resolvar
 *  - kontrollerar efter 1,5 s att Grim faktiskt tappade fokus; annars nästa kandidat
 *  - svarar { opened, sdkInt, tried } eller HC_NATIVE_SETTINGS med alla försök
 *  - grimSettingsDiagnostics(): rationale-vy, alias och resolvers per kandidat
 * Uppgraderar även en redan V1-patchad node_modules på plats. Idempotent.
 */
const fs = require("fs");
const path = require("path");

const PLUGIN_KT = process.env.GRIM_HEALTH_PLUGIN_KT || path.join(__dirname, "..", "node_modules", "capacitor-health", "android", "src/main/java/com/fit_up/health/capacitor/HealthPlugin.kt");
const TAG = "[patch-health-settings-v2]";
if (!fs.existsSync(PLUGIN_KT)) {
  console.error(`${TAG} pluginet saknas — bygget får inte fortsätta opatchat.`);
  process.exit(1);
}
let kt = fs.readFileSync(PLUGIN_KT, "utf8");
if (kt.includes("GRIM_SETTINGS_V2")) {
  console.log(`${TAG} redan patchad.`);
  process.exit(0);
}

const start = kt.indexOf("    // GRIM_SETTINGS_CANDIDATES");
const end = kt.indexOf("    // Open the Google Play Store to install Health Connect");
if (start < 0 || end < 0 || end < start) {
  console.error(`${TAG} hittade inte openHealthConnectSettings (V1) — kör patch-open-health-settings.cjs först.`);
  process.exit(1);
}

const method = `    // GRIM_SETTINGS_CANDIDATES
    // GRIM_SETTINGS_V2
    private fun grimSettingsCandidates(): List<Pair<String, Intent>> {
        val pkg = context.packageName
        val list = mutableListOf<Pair<String, Intent>>()
        if (android.os.Build.VERSION.SDK_INT >= 34) {
            // Android 14+: Health Connect är en del av systemet.
            list.add("MANAGE_HEALTH_PERMISSIONS" to Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS").putExtra(Intent.EXTRA_PACKAGE_NAME, pkg))
            list.add("HEALTH_HOME_SETTINGS" to Intent("android.health.connect.action.HEALTH_HOME_SETTINGS"))
        } else {
            // Android 13 och äldre: Health Connect-appen.
            list.add("ACTION_MANAGE_HEALTH_PERMISSIONS" to Intent("androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS")
                .putExtra(Intent.EXTRA_PACKAGE_NAME, pkg)
                .setPackage("com.google.android.apps.healthdata"))
        }
        list.add("ACTION_HEALTH_CONNECT_SETTINGS" to Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS))
        try {
            list.add("MANAGE_DATA" to HealthConnectClient.getHealthConnectManageDataIntent(context))
        } catch (_: Throwable) {
        }
        context.packageManager.getLaunchIntentForPackage("com.google.android.apps.healthdata")?.let { list.add("HC_APP" to it) }
        return list
    }

    private fun grimResolvers(intent: Intent): List<String> = try {
        val matches = if (android.os.Build.VERSION.SDK_INT >= 33) {
            context.packageManager.queryIntentActivities(intent, android.content.pm.PackageManager.ResolveInfoFlags.of(0L))
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.queryIntentActivities(intent, 0)
        }
        matches.map { "\${it.activityInfo.packageName}/\${it.activityInfo.name}" }
    } catch (e: Exception) {
        listOf("error: \${e.javaClass.simpleName}")
    }

    @PluginMethod
    fun openHealthConnectSettings(call: PluginCall) {
        val all = grimSettingsCandidates()
        // Saknas paketsynlighet kan query ge tomt trots att intenten fungerar –
        // prova då alla i stället för att ge upp.
        val candidates = all.filter { grimResolvers(it.second).isNotEmpty() }.ifEmpty { all }
        val tried = JSArray()
        val handler = Handler(Looper.getMainLooper())
        fun attempt(index: Int) {
            if (index >= candidates.size) {
                Log.w("GRIM_HC", "GRIM_HC: SETTINGS_FAILED sdk=\${android.os.Build.VERSION.SDK_INT} tried=$tried")
                call.reject("HC_NATIVE_SETTINGS: could not open Health Connect (tried \${tried.length()}: $tried)")
                return
            }
            val (name, intent) = candidates[index]
            try {
                healthTrace("settings-try", name)
                activity.startActivity(intent)
            } catch (e: Exception) {
                tried.put("$name:\${e.javaClass.simpleName}")
                attempt(index + 1)
                return
            }
            // Health Connect kan stänga sin vy direkt. Har Grim fortfarande fokus
            // efter 1,5 s visades ingenting – prova nästa väg.
            handler.postDelayed({
                if (activity.hasWindowFocus() && !activity.isFinishing) {
                    Log.w("GRIM_HC", "GRIM_HC: SETTINGS_BOUNCED $name")
                    tried.put("$name:bounced")
                    attempt(index + 1)
                } else {
                    tried.put("$name:opened")
                    Log.i("GRIM_HC", "GRIM_HC: SETTINGS_OPEN $name sdk=\${android.os.Build.VERSION.SDK_INT}")
                    healthTrace("settings-open", name)
                    call.resolve(JSObject().put("opened", name).put("sdkInt", android.os.Build.VERSION.SDK_INT).put("tried", tried))
                }
            }, 1500)
        }
        activity.runOnUiThread {
            if (candidates.isEmpty()) {
                call.reject("HC_NATIVE_SETTINGS: no Health Connect settings activity resolves on this device")
            } else {
                attempt(0)
            }
        }
    }

    /** Allt som avgör om Health Connect accepterar Grim som hälsoapp. */
    @PluginMethod
    fun grimSettingsDiagnostics(call: PluginCall) {
        val pkg = context.packageName
        val result = JSObject()
        result.put("sdkInt", android.os.Build.VERSION.SDK_INT)
        result.put("manufacturer", android.os.Build.MANUFACTURER)
        result.put("sdkStatus", HealthConnectClient.getSdkStatus(context))
        // Android 14+: kräver VIEW_PERMISSION_USAGE + HEALTH_PERMISSIONS (activity-alias).
        result.put("rationaleAlias14", JSArray(grimResolvers(
            Intent("android.intent.action.VIEW_PERMISSION_USAGE").addCategory("android.intent.category.HEALTH_PERMISSIONS").setPackage(pkg))))
        // Android 13 och äldre: ACTION_SHOW_PERMISSIONS_RATIONALE.
        result.put("rationale13", JSArray(grimResolvers(Intent("androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE").setPackage(pkg))))
        val settings = JSObject()
        for ((name, intent) in grimSettingsCandidates()) settings.put(name, JSArray(grimResolvers(intent)))
        result.put("settingsResolvers", settings)
        Log.i("GRIM_HC", "GRIM_HC: SETTINGS_DIAG $result")
        call.resolve(result)
    }

`;
kt = kt.slice(0, start) + method + kt.slice(end);
fs.writeFileSync(PLUGIN_KT, kt, "utf8");
console.log(`${TAG} openHealthConnectSettings V2 installerad.`);
