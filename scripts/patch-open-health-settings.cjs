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

if (!kt.includes("GRIM_CHECK_DEADLINE") && kt.includes("fun checkHealthPermissions(call: PluginCall)")) {
  const before = kt;
  kt = kt.replace(
    `        CoroutineScope(Dispatchers.Main).launch {
            try {

                val grantedPermissions = healthConnectClient.permissionController.getGrantedPermissions()
                val result = grantedPermissionResult(permissions, grantedPermissions)

                call.resolve(result)
            } catch (e: Exception) {
                call.reject("Checking permissions failed: \${e.message}")
            }
        }`,
    `        // GRIM_CHECK_DEADLINE
        val checkDone = java.util.concurrent.atomic.AtomicBoolean(false)
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            if (checkDone.compareAndSet(false, true)) {
                call.reject("HC_NATIVE_04: permission check did not return in 8s")
            }
        }, 8000)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val grantedPermissions = healthConnectClient.permissionController.getGrantedPermissions()
                val result = grantedPermissionResult(permissions, grantedPermissions)
                if (checkDone.compareAndSet(false, true)) call.resolve(result)
            } catch (e: Exception) {
                if (checkDone.compareAndSet(false, true)) call.reject("Checking permissions failed: \${e.message}")
            }
        }`
  );
  if (kt === before) {
    console.error("[patch-open-health-settings] kunde inte sätta tidsgräns på behörighetskontrollen.");
    process.exit(1);
  }
}

if (!kt.includes("GRIM_READ_DEADLINE")) {
  const before = kt;
  kt = kt.replace(
    "val r = queryAggregatedMetric(metricAndMapper, TimeRangeFilter.between(startDateTime, endDateTime), period, dataOrigins)",
    "val r = kotlinx.coroutines.withTimeout(15000) {\n                        queryAggregatedMetric(metricAndMapper, TimeRangeFilter.between(startDateTime, endDateTime), period, dataOrigins)\n                    }"
  );
  kt = kt.replace(
    "val response = healthConnectClient.readRecords(request)",
    "val response = kotlinx.coroutines.withTimeout(15000) {\n                    healthConnectClient.readRecords(request)\n                }"
  );
  if (kt === before || !kt.includes("kotlinx.coroutines.withTimeout(15000)")) {
    console.error("[patch-open-health-settings] kunde inte sätta tidsgräns på läsning.");
    process.exit(1);
  }
  kt = kt.replace(
    "val response = kotlinx.coroutines.withTimeout(15000) {\n                    healthConnectClient.readRecords(request)\n                }",
    "// GRIM_READ_DEADLINE\n                val response = kotlinx.coroutines.withTimeout(15000) {\n                    healthConnectClient.readRecords(request)\n                }"
  );
}

if (kt.includes("GRIM_SETTINGS_CANDIDATES")) {
  fs.writeFileSync(PLUGIN_KT, kt, "utf8");
  console.log("[patch-open-health-settings] redan patchad.");
  process.exit(0);
}

const settingsMethod = `    // Open Google Health Connect app settings
    // GRIM_APP_HEALTH_PERMISSIONS
    // GRIM_SETTINGS_CANDIDATES
    @PluginMethod
    fun openHealthConnectSettings(call: PluginCall) {
        val pkg = context.packageName
        activity.runOnUiThread {
            val candidates = listOf(
                Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS").apply {
                    putExtra(Intent.EXTRA_PACKAGE_NAME, pkg)
                },
                Intent("androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS").apply {
                    putExtra(Intent.EXTRA_PACKAGE_NAME, pkg)
                },
                Intent("android.health.connect.action.HEALTH_HOME_SETTINGS"),
                Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS),
                context.packageManager.getLaunchIntentForPackage("com.google.android.apps.healthdata"),
                Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = android.net.Uri.fromParts("package", pkg, null)
                }
            )
            for (intent in candidates.filterNotNull()) {
                try {
                    healthTrace("settings-try", intent.action ?: "launch")
                    activity.startActivity(intent)
                    healthTrace("settings-open", intent.action ?: "launch")
                    call.resolve()
                    return@runOnUiThread
                } catch (_: Exception) {
                }
            }
            call.reject("HC_NATIVE_SETTINGS: could not open Health Connect")
        }
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
