#!/usr/bin/env node
/**
 * Sista ordet för requestHealthPermissions.
 * Körs efter scripts/patch-capacitor-health.cjs.
 *
 * Dialogen startas på UI-tråden via den launcher som registrerades i load().
 * Kommer inget Activity Result inom 8 sekunder släpps anropet med HC_NATIVE_04,
 * så JavaScript-löftet aldrig kan hänga.
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
  console.error("[patch-health-permission-request] pluginet saknas — bygget får inte fortsätta opatchat.");
  process.exit(1);
}

let kt = fs.readFileSync(PLUGIN_KT, "utf8");
if (kt.includes("GRIM_SIMPLE_PERMISSION_REQUEST")) {
  console.log("[patch-health-permission-request] redan patchad.");
  process.exit(0);
}

const requestMethod = `    // GRIM_SIMPLE_PERMISSION_REQUEST
    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        val permissionsToRequest = call.getArray("permissions")
        if (permissionsToRequest == null) {
            call.reject("Must provide permissions to request")
            return
        }
        val permissions = permissionsToRequest.toList<String>()
            .mapNotNull { CapHealthPermission.from(it) }.toSet()
        val healthConnectPermissions = permissions.mapNotNull { permissionMapping[it] }.toSet()

        call.setKeepAlive(true)
        bridge.saveCall(call)
        activity.runOnUiThread {
            try {
                requestPermissionContext.set(RequestPermissionContext(permissions, call))
                val launcher = permissionsLauncher
                if (launcher == null) {
                    requestPermissionContext.set(null)
                    call.reject("HC_NATIVE_03: launcher not registered")
                    bridge.releaseCall(call)
                    return@runOnUiThread
                }
                launcher.launch(healthConnectPermissions)
            } catch (e: Exception) {
                requestPermissionContext.set(null)
                call.reject("HC_NATIVE_05: \${e.message}")
                bridge.releaseCall(call)
            }
        }
        // Om dialogen aldrig kommer tillbaka: släpp anropet.
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            val pending = requestPermissionContext.getAndSet(null) ?: return@postDelayed
            pending.pluginCal.reject("HC_NATIVE_04: no permission result in 8s")
            bridge.releaseCall(pending.pluginCal)
        }, 8000)
    }

`;

function replacePluginMethod(source, name, replacement) {
  const sig = "fun " + name + "(call: PluginCall) {";
  const start = source.indexOf(sig);
  if (start < 0) return null;
  const anno = source.lastIndexOf("@PluginMethod", start);
  if (anno < 0 || start - anno > 200) return null;
  const from = source.lastIndexOf("\n", anno) + 1;
  let depth = 0;
  let seen = false;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") {
      depth++;
      seen = true;
    } else if (ch === "}") {
      depth--;
      if (seen && depth === 0) {
        let end = i + 1;
        if (source[end] === "\r") end++;
        if (source[end] === "\n") end++;
        return source.slice(0, from) + replacement + source.slice(end);
      }
    }
  }
  return null;
}

const next = replacePluginMethod(kt, "requestHealthPermissions", requestMethod);
if (!next || !next.includes("GRIM_SIMPLE_PERMISSION_REQUEST")) {
  console.error("[patch-health-permission-request] kunde inte ersätta requestHealthPermissions.");
  process.exit(1);
}
fs.writeFileSync(PLUGIN_KT, next, "utf8");
console.log("[patch-health-permission-request] requestHealthPermissions startar på UI-tråden med 8s-gräns.");
