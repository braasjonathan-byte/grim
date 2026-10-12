#!/usr/bin/env node
/**
 * Ersätter capacitor-healths openHealthConnectSettings med en fallback-kedja.
 * Körs efter scripts/patch-capacitor-health.cjs. Idempotent.
 *
 * Ordning:
 *  1. android.health.connect.action.MANAGE_HEALTH_PERMISSIONS (Android 14+)
 *  2. androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS (Health Connect-appen)
 *  3. HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS
 *  4. starta com.google.android.apps.healthdata
 */
const fs = require("fs");
const path = require("path");

const PLUGIN_KT = path.join(
  __dirname,
  "..",
  "node_modules",
  "capacitor-health",
  "android",
  "src/main/java/com/fit_up/health/capacitor/HealthPlugin.kt"
);

if (!fs.existsSync(PLUGIN_KT)) {
  console.error("[patch-open-health-settings] pluginet saknas — bygget får inte fortsätta opatchat.");
  process.exit(1);
}

let kt = fs.readFileSync(PLUGIN_KT, "utf8");
if (kt.includes("GRIM_SETTINGS_CANDIDATES")) {
  console.log("[patch-open-health-settings] redan patchad.");
  process.exit(0);
}

const settingsMethod = `    // Open Google Health Connect app settings
    // GRIM_APP_HEALTH_PERMISSIONS
    // GRIM_SETTINGS_CANDIDATES
    @PluginMethod
    fun openHealthConnectSettings(call: PluginCall) {
        val pkg = context.packageName
        val candidates = listOf(
            Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS").apply {
                putExtra(Intent.EXTRA_PACKAGE_NAME, pkg)
            },
            Intent("androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS").apply {
                putExtra(Intent.EXTRA_PACKAGE_NAME, pkg)
                setPackage("com.google.android.apps.healthdata")
            },
            Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS),
            context.packageManager.getLaunchIntentForPackage("com.google.android.apps.healthdata")
        )
        for (intent in candidates.filterNotNull()) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (intent.resolveActivity(context.packageManager) == null) continue
            try {
                activity.startActivity(intent)
                call.resolve()
                return
            } catch (_: Exception) {
            }
        }
        call.reject("HC_NATIVE_SETTINGS: could not open Health Connect")
    }

`;

const methodRe = /[ \t]*\/\/ Open Google Health Connect app settings\n[ \t]*@PluginMethod\n[ \t]*fun openHealthConnectSettings\(call: PluginCall\) \{[\s\S]*?\n    \}\n/;
if (!methodRe.test(kt)) {
  console.error("[patch-open-health-settings] kunde inte hitta openHealthConnectSettings.");
  process.exit(1);
}

kt = kt.replace(methodRe, settingsMethod);
fs.writeFileSync(PLUGIN_KT, kt, "utf8");
console.log("[patch-open-health-settings] openHealthConnectSettings ersatt med fallback-kedja.");
