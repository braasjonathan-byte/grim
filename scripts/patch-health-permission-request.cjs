#!/usr/bin/env node
/**
 * Sista ordet för requestHealthPermissions.
 * Körs efter scripts/patch-capacitor-health.cjs.
 *
 * Dialogen startas på UI-tråden via den launcher som registrerades i load()
 * med PermissionController.createRequestPermissionResultContract().
 * Detta är den dokumenterade vägen och den som diagnostiken förväntar sig.
 * Proxy används bara som reserv om launchern inte är redo.
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
if (kt.includes("GRIM_LAUNCHER_FIRST_REQUEST") && kt.includes("GRIM_REQUEST_DEADLINE_V2")) {
  console.log("[patch-health-permission-request] redan patchad (launcher-first).");
  process.exit(0);
}

const requestMethod = `    // GRIM_LAUNCHER_FIRST_REQUEST
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
        lastPermissionCallId = call.callbackId
        lastRequestedPermissions = permissions
        requestPermissionContext.set(RequestPermissionContext(permissions, call))

        CoroutineScope(Dispatchers.IO).launch {
            val grantedNow = try {
                if (ensureClient()) healthConnectClient.permissionController.getGrantedPermissions() else emptySet()
            } catch (_: Exception) {
                emptySet()
            }
            activity.runOnUiThread {
                val pending = requestPermissionContext.getAndSet(null) ?: return@runOnUiThread
                try {
                    if (healthConnectPermissions.isNotEmpty() && healthConnectPermissions.all { grantedNow.contains(it) }) {
                        healthTrace("dialog-start", "permissions=\${healthConnectPermissions.size}")
                        healthTrace("dialog-launch-attempt", "route=already-granted")
                        pending.pluginCal.resolve(grantedPermissionResult(permissions, grantedNow))
                        bridge.releaseCall(pending.pluginCal)
                        return@runOnUiThread
                    }
                    if (healthConnectPermissions.isEmpty()) {
                        pending.pluginCal.reject("HC_NATIVE_05: no Health Connect permission strings matched the request")
                        bridge.releaseCall(pending.pluginCal)
                        return@runOnUiThread
                    }

                    // Prefer the early-registered launcher (correct contract).
                    val launcher = permissionsLauncher
                    if (launcher != null) {
                        requestPermissionContext.set(pending)
                        healthTrace("dialog-start", "permissions=\${healthConnectPermissions.size}")
                        healthTrace("dialog-launch-attempt", "route=launcher")
                        launcher.launch(healthConnectPermissions)
                        healthTrace("dialog-launch-returned", "route=launcher")
                        return@runOnUiThread
                    }

                    // Fallback: proxy (should rarely be needed after early registration).
                    requestPermissionContext.set(pending)
                    val proxyIntent = Intent(activity, HealthPermissionProxyActivity::class.java).apply {
                        putStringArrayListExtra(
                            HealthPermissionProxyActivity.EXTRA_PERMISSIONS,
                            ArrayList(healthConnectPermissions)
                        )
                    }
                    healthTrace("dialog-start", "permissions=\${healthConnectPermissions.size}")
                    healthTrace("dialog-launch-attempt", "route=proxy-fallback")
                    startActivityForResult(pending.pluginCal, proxyIntent, "handleHealthPermissionResult")
                    healthTrace("dialog-launch-returned", "route=proxy-fallback")
                } catch (e: Exception) {
                    requestPermissionContext.set(null)
                    Log.e(tag, "health permission launch failed", e)
                    pending.pluginCal.reject("HC_NATIVE_05: \${e.message}")
                    bridge.releaseCall(pending.pluginCal)
                }
            }
        }

        // GRIM_REQUEST_DEADLINE_V2
        val deadlineHandler = android.os.Handler(android.os.Looper.getMainLooper())
        val requestStartedAt = System.currentTimeMillis()
        val deadline = object : Runnable {
            override fun run() {
                val current = requestPermissionContext.get() ?: return
                if (current.pluginCal.callbackId != call.callbackId) return
                val elapsed = System.currentTimeMillis() - requestStartedAt
                val sheetShown = try { GrimHcDiag.sheetVisibleAt >= requestStartedAt } catch (_: Throwable) { false }
                if (sheetShown && elapsed < 125_000) {
                    deadlineHandler.postDelayed(this, 125_000 - elapsed)
                    return
                }
                val pending = requestPermissionContext.getAndSet(null) ?: return
                pending.pluginCal.reject(
                    if (sheetShown) "HC_NATIVE_04: no permission result in 125s"
                    else "HC_NATIVE_04: no permission result in 8s"
                )
                bridge.releaseCall(pending.pluginCal)
            }
        }
        deadlineHandler.postDelayed(deadline, 8000)
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

let next = replacePluginMethod(kt, "requestHealthPermissions", requestMethod);
if (next) {
  next = next.replace(/(    \/\/ GRIM_SIMPLE_PERMISSION_REQUEST\n)+/g, "");
  next = next.replace(/(    \/\/ GRIM_LAUNCHER_FIRST_REQUEST\n)+/g, "    // GRIM_LAUNCHER_FIRST_REQUEST\n");
}
if (!next || !next.includes("GRIM_LAUNCHER_FIRST_REQUEST") || !next.includes("route=launcher")) {
  console.error("[patch-health-permission-request] kunde inte ersätta requestHealthPermissions med launcher-first.");
  process.exit(1);
}
fs.writeFileSync(PLUGIN_KT, next, "utf8");
console.log("[patch-health-permission-request] requestHealthPermissions använder nu early launcher först (PermissionController-kontrakt).");
