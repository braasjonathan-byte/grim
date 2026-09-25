#!/usr/bin/env node
/**
 * capacitor-health@8.2.0 saknar stöd för sömn (SleepSessionRecord), pinnar
 * androidx.core:core-ktx till en äldre version än resten av projektet och bygger
 * mot Health Connect-klienten 1.2.0-alpha01. Den klienten föregår Googles
 * Android 16-relaterade signatur- och intentfixar i alpha05/alpha06.
 *
 * Skriptet patchar det installerade pluginet så att:
 *  1. READ_SLEEP finns som behörighet (enum, @CapacitorPlugin, permissionMapping,
 *     plugin-manifestet)
 *  2. queryAggregated stödjer dataType "sleep" (minuter per dag)
 *  3. AGP och core-ktx följer rootProject
 *  4. Health Connect-klienten uppgraderas till den senaste Android 16-versionen
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
const PERMISSION_PROXY = path.join(
  BASE,
  "src/main/java/com/fit_up/health/capacitor/HealthPermissionProxyActivity.kt"
);
const GRADLE = path.join(BASE, "build.gradle");
const AGP_VERSION = "8.13.0";
const HEALTH_CONNECT_CLIENT_VERSION = "1.2.0-alpha06";

if (!fs.existsSync(PLUGIN_KT)) {
  console.error("[patch-capacitor-health] pluginet saknas — bygget får inte fortsätta opatchat.");
  process.exit(1);
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

// 5f. Registrera ActivityResultLauncher under pluginets load(), innan aktiviteten
// når STARTED. Om Android ändå avvisar registreringen ska JS få ett omedelbart,
// maskinläsbart fel i stället för att vänta på sin watchdog.
if (!kt.includes("GRIM_EARLY_PERMISSION_LAUNCHER")) {
  kt = kt.replace(
    /    private lateinit var permissionsLauncher: ActivityResultLauncher<Set<String>>\s*\n    override fun load\(\) \{[\s\S]*?        permissionsLauncher = activity\.registerForActivityResult\(contract, callback\)\s*\n    \}/,
    `    // GRIM_EARLY_PERMISSION_LAUNCHER: Plugin.load() körs från BridgeActivity.onCreate.
    private var permissionsLauncher: ActivityResultLauncher<Set<String>>? = null
    private var launcherSetupError: String? = null

    private fun healthTrace(step: String, detail: String = "") {
        Log.i(tag, "health-ts=4{System.currentTimeMillis()} step=4step 4detail")
    }

    override fun load() {
        super.load()
        healthTrace("launcher-registration-start")
        try {
            val contract: ActivityResultContract<Set<String>, Set<String>> =
                PermissionController.createRequestPermissionResultContract()
            val callback = ActivityResultCallback<Set<String>> { grantedPermissions ->
                healthTrace("dialog-response", "granted=4{grantedPermissions.size}")
                val context = requestPermissionContext.getAndSet(null)
                if (context != null) {
                    context.pluginCal.resolve(grantedPermissionResult(context.requestedPermissions, grantedPermissions))
                    bridge.releaseCall(context.pluginCal)
                } else {
                    val saved = lastPermissionCallId?.let { bridge.getSavedCall(it) }
                    if (saved != null) {
                        healthTrace("dialog-response-restored")
                        saved.resolve(grantedPermissionResult(lastRequestedPermissions, grantedPermissions))
                        bridge.releaseCall(saved)
                    } else {
                        Log.w(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-response-orphan")
                    }
                }
                lastPermissionCallId = null
                lastRequestedPermissions = emptySet()
            }
            permissionsLauncher = activity.registerForActivityResult(contract, callback)
            healthTrace("launcher-registration-ok")
        } catch (e: Exception) {
            launcherSetupError = e.message ?: e.javaClass.simpleName
            Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=launcher-registration-failed code=HC_NATIVE_03", e)
        }
    }`.replace(/\u00024/g, "$"),
  );
}

// 5g. Begäran får bara starta med en launcher som registrerats i load(). Logga
// dialogstarten separat så HC-03 och HC-04 går att skilja i en Logcat-rapport.
if (!kt.includes("HC_NATIVE_03")) {
  console.error("[patch-capacitor-health] kunde inte installera tidig launcher-registrering.");
  process.exit(1);
}
if (!kt.includes("step=dialog-start")) {
  kt = kt.replace(
    /                Log\.i\(tag, "requesting health permissions: \$healthConnectPermissions"\)/,
    `                val launcher = permissionsLauncher
                if (launcher == null) {
                    val reason = launcherSetupError ?: "launcher was not initialized during plugin load"
                    Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-start-blocked code=HC_NATIVE_03 reason=4reason")
                    call.reject("HC_NATIVE_03: 4reason")
                    return@runOnUiThread
                }
                healthTrace("dialog-start", "permissions=4{healthConnectPermissions.size}")`.replace(/\u00024/g, "$"),
  );
  kt = kt.replace(
    /                permissionsLauncher\.launch\(healthConnectPermissions\)/,
    `                launcher.launch(healthConnectPermissions)
                healthTrace("dialog-launch-returned")`,
  );
  kt = kt.replace(
    /                Log\.e\(tag, "permission request failed", e\)/,
    `                Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-start-failed code=HC_NATIVE_03", e)`.replace(/\u00024/g, "$"),
  );
  kt = kt.replace(
    /                call\.reject\("Permission request failed: \$\{e\.message\}"\)/,
    `                call.reject("HC_NATIVE_03: Permission request failed: 4{e.message}")`.replace(/\u00024/g, "$"),
  );
}

// 5h. Öppna den appspecifika behörighetssidan. Android 14 har Health Connect i
// systemet; Android 13 och äldre använder den separata Health Connect-appen.
if (!kt.includes("GRIM_APP_HEALTH_PERMISSIONS")) {
  kt = kt.replace(
    /            val intent = Intent\(\)\.apply \{\s*\n                action = HealthConnectClient\.ACTION_HEALTH_CONNECT_SETTINGS\s*\n            \}\s*\n            context\.startActivity\(intent\)/,
    `            // GRIM_APP_HEALTH_PERMISSIONS
            val packageName = context.packageName
            val action = if (android.os.Build.VERSION.SDK_INT >= 34)
                "android.health.connect.action.MANAGE_HEALTH_PERMISSIONS"
            else
                "androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS"
            val intent = Intent(action).apply {
                putExtra(Intent.EXTRA_PACKAGE_NAME, packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (android.os.Build.VERSION.SDK_INT < 34) setPackage("com.google.android.apps.healthdata")
            }
            val resolved = intent.resolveActivity(context.packageManager)
            if (resolved == null) {
                Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=settings-open-failed code=HC_NATIVE_SETTINGS")
                throw IllegalStateException("HC_NATIVE_SETTINGS: app permission screen unavailable")
            }
            healthTrace("settings-open", "component=4resolved")
            context.startActivity(intent)`.replace(/\u00024/g, "$"),
  );
}

// 5i. Skilj saknad installation från för gammal provider så JS kan visa HC-01
// respektive HC-02 utan att gissa från ett gemensamt available=false.
if (!kt.includes("SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED")) {
  kt = kt.replace(
    /        val result = JSObject\(\)\s*\n        result\.put\("available", available\)\s*\n        call\.resolve\(result\)/,
    `        val sdkStatus = HealthConnectClient.getSdkStatus(context)
        val result = JSObject()
        result.put("available", available && sdkStatus == HealthConnectClient.SDK_AVAILABLE)
        result.put("status", when (sdkStatus) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update-required"
            else -> "not-installed"
        })
        healthTrace("availability-response", "status=4sdkStatus")
        call.resolve(result)`.replace(/\u00024/g, "$"),
  );
}

// 5j. Native watchdog: om launch() återvänder men ActivityResult-callbacken aldrig
// kommer får JS HC_NATIVE_04 före den yttre 20-sekundersgränsen.
if (!kt.includes("GRIM_PERMISSION_CALLBACK_WATCHDOG")) {
  if (!kt.includes("import android.os.Handler")) {
    kt = kt.replace("import android.net.Uri\n", "import android.net.Uri\nimport android.os.Handler\nimport android.os.Looper\n");
  }
  kt = kt.replace(
    /    private var launcherSetupError: String\? = null/,
    `    private var launcherSetupError: String? = null
    // GRIM_PERMISSION_CALLBACK_WATCHDOG: hard deadline independent of activity focus.
    private val mainHandler = Handler(Looper.getMainLooper())
    private var permissionWatchdog: Runnable? = null`,
  );
  kt = kt.replace(
    /                healthTrace\("dialog-response", "granted=\$\{grantedPermissions\.size\}"\)/,
    `                healthTrace("dialog-response", "granted=4{grantedPermissions.size}")
                permissionWatchdog?.let { mainHandler.removeCallbacks(it) }
                permissionWatchdog = null`.replace(/\u00024/g, "$"),
  );
  kt = kt.replace(
    /                healthTrace\("dialog-launch-returned"\)/,
    `                healthTrace("dialog-launch-returned")
                permissionWatchdog?.let { mainHandler.removeCallbacks(it) }
                permissionWatchdog = object : Runnable {
                    override fun run() {
                    val pending = requestPermissionContext.getAndSet(null)
                    if (pending?.pluginCal?.callbackId == call.callbackId) {
                        Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-callback-timeout code=HC_NATIVE_04")
                        bridge.releaseCall(call)
                        call.reject("HC_NATIVE_04: permission dialog returned no callback")
                    }
                    }
                }
                mainHandler.postDelayed(permissionWatchdog!!, 18_000)`.replace(/\u00024/g, "$"),
  );
}

// Uppgradera installationer som redan fick den äldre watchdog-patchen. Den
// pausade på hasWindowFocus=false och kunde därför vänta för evigt på vissa
// tillverkare. Markören ensam får inte göra patchen falskt idempotent.
if (kt.includes("GRIM_PERMISSION_CALLBACK_WATCHDOG") && !kt.includes("hard deadline independent of activity focus")) {
  kt = kt.replace(
    "// GRIM_PERMISSION_CALLBACK_WATCHDOG",
    "// GRIM_PERMISSION_CALLBACK_WATCHDOG: hard deadline independent of activity focus.",
  );
  kt = kt.replace(
    /\s*\/\/ Ligger systemdialogen overst[\s\S]*?mainHandler\.postDelayed\(this, 5_000\)\s*\n\s*return\s*\n\s*\}/,
    "",
  );
}

// Reject måste skickas över Capacitor-bryggan innan det sparade anropet
// släpps. Om releaseCall körs först kan JS-löftet bli permanent pending.
kt = kt.replace(
  /bridge\.releaseCall\(call\)\s*\n\s*call\.reject\("HC_NATIVE_04: permission dialog returned no callback"\)/,
  `call.reject("HC_NATIVE_04: permission dialog returned no callback")
                        bridge.releaseCall(call)`,
);

// 5k. GRUNDORSAK HC-04: ActivityResultLaunchern registreras på pluginets egen
// instans. Återskapar Android aktiviteten medan Health Connect ligger överst
// försvinner både instansfältet och bryggans sparade anrop, och svaret når
// aldrig JS. Capacitors egen startActivityForResult + @ActivityCallback sparar
// anropet i bryggan och återställer det efter en återskapning — det är det
// dokumenterade livscykelsäkra mönstret. Launchern behålls som reserv.
if (!kt.includes("GRIM_BRIDGE_ACTIVITY_RESULT")) {
  if (!kt.includes("import androidx.activity.result.ActivityResult\n")) {
    kt = kt.replace(
      "import androidx.activity.result.ActivityResultCallback\n",
      "import androidx.activity.result.ActivityResult\nimport androidx.activity.result.ActivityResultCallback\n",
    );
  }
  if (!kt.includes("import com.getcapacitor.annotation.ActivityCallback")) {
    kt = kt.replace(
      "import com.getcapacitor.annotation.CapacitorPlugin\n",
      "import com.getcapacitor.annotation.ActivityCallback\nimport com.getcapacitor.annotation.CapacitorPlugin\n",
    );
  }
  kt = kt.replace(
    /    override fun load\(\) \{\n        super\.load\(\)\n        healthTrace\("launcher-registration-start"\)/,
    `    // GRIM_BRIDGE_ACTIVITY_RESULT
    private val permissionContract: ActivityResultContract<Set<String>, Set<String>> =
        PermissionController.createRequestPermissionResultContract()

    @ActivityCallback
    fun handleHealthPermissionResult(call: PluginCall?, result: ActivityResult) {
        permissionWatchdog?.let { mainHandler.removeCallbacks(it) }
        permissionWatchdog = null
        val granted = try {
            permissionContract.parseResult(result.resultCode, result.data)
        } catch (e: Exception) {
            Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-result-parse-failed", e)
            emptySet<String>()
        }
        val pending = requestPermissionContext.getAndSet(null)
        val target = call ?: pending?.pluginCal ?: lastPermissionCallId?.let { bridge.getSavedCall(it) }
        val requested = if (pending != null) pending.requestedPermissions else lastRequestedPermissions
        healthTrace("bridge-dialog-response", "granted=4{granted.size} call=4{target?.callbackId}")
        lastPermissionCallId = null
        lastRequestedPermissions = emptySet()
        if (target == null) {
            Log.w(tag, "health-ts=4{System.currentTimeMillis()} step=bridge-dialog-response-orphan")
            return
        }
        target.resolve(grantedPermissionResult(requested, granted))
        bridge.releaseCall(target)
    }

    override fun load() {
        super.load()
        healthTrace("launcher-registration-start")`.replace(/\u00024/g, "$"),
  );
  kt = kt.replace(
    /                launcher\.launch\(healthConnectPermissions\)\n                healthTrace\("dialog-launch-returned"\)/,
    `                // GRIM_LAUNCH_GUARD: ett launch-anrop kan misslyckas synkront
                // (ActivityNotFoundException, IllegalStateException) utan att någon
                // dialog ritas upp. Det får aldrig maskeras som uteblivet svar.
                if (healthConnectPermissions.isEmpty()) {
                    val emptyReason = "no Health Connect permission strings matched the request"
                    Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-launch-failed code=HC_NATIVE_05 reason=4emptyReason")
                    requestPermissionContext.set(null)
                    lastPermissionCallId = null
                    lastRequestedPermissions = emptySet()
                    call.reject("HC_NATIVE_05: 4emptyReason")
                    bridge.releaseCall(call)
                    return@runOnUiThread
                }
                if (activity.isFinishing || activity.isDestroyed) {
                    val staleReason = "activity is not in a valid state to show the dialog"
                    Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-launch-failed code=HC_NATIVE_05 reason=4staleReason")
                    requestPermissionContext.set(null)
                    lastPermissionCallId = null
                    lastRequestedPermissions = emptySet()
                    call.reject("HC_NATIVE_05: 4staleReason")
                    bridge.releaseCall(call)
                    return@runOnUiThread
                }
                val handedToBridge = try {
                    val permissionIntent = permissionContract.createIntent(activity, healthConnectPermissions)
                    val resolvedDialog = permissionIntent.resolveActivity(context.packageManager)
                    healthTrace(
                        "dialog-intent",
                        "action=4{permissionIntent.action} resolved=4resolvedDialog permissions=4healthConnectPermissions"
                    )
                    // GRIM_RESOLVE_NONFATAL: resolveActivity kan ge null enbart pga
                    // paketfiltrering (Android 11+) även när Health Connect finns.
                    if (resolvedDialog == null) {
                        Log.w(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-intent-unresolved action=4{permissionIntent.action}")
                    }
                    healthTrace("dialog-launch-attempt", "route=bridge")
                    startActivityForResult(call, permissionIntent, "handleHealthPermissionResult")
                    healthTrace("dialog-launch-ok", "route=bridge")
                    true
                } catch (e: Exception) {
                    Log.e(tag, "health-ts=4{System.currentTimeMillis()} step=dialog-launch-failed route=bridge", e)
                    false
                }
                if (!handedToBridge) {
                    try {
                        healthTrace("dialog-launch-attempt", "route=launcher")
                        launcher.launch(healthConnectPermissions)
                        healthTrace("dialog-launch-ok", "route=launcher")
                    } catch (e: Exception) {
                        val launchReason = "4{e.javaClass.simpleName}: 4{e.message ?: "no message"}"
                        Log.e(
                            tag,
                            "health-ts=4{System.currentTimeMillis()} step=dialog-launch-failed route=launcher code=HC_NATIVE_05 reason=4launchReason",
                            e
                        )
                        requestPermissionContext.set(null)
                        lastPermissionCallId = null
                        lastRequestedPermissions = emptySet()
                        call.reject("HC_NATIVE_05: 4launchReason")
                        bridge.releaseCall(call)
                        return@runOnUiThread
                    }
                }
                healthTrace("dialog-launch-returned")`.replace(/\u00024/g, "$"),
  );
}

// GRIM_RESOLVE_NONFATAL-migrering: äldre patchar avbröt launch när resolveActivity
// gav null, vilket bara speglar Android 11+ paketfiltrering.
if (kt.includes('throw ActivityNotFoundException("no activity handles')) {
  kt = kt.replace(
    /[ ]+if \(resolvedDialog == null\) \{\n[ ]+throw ActivityNotFoundException\("no activity handles [^\n]*\n[ ]+\}\n/,
    `                    // GRIM_RESOLVE_NONFATAL: resolveActivity kan ge null enbart pga
                    // paketfiltrering (Android 11+) även när Health Connect finns.
                    if (resolvedDialog == null) {
                        Log.w(tag, "health-ts=\u00024{System.currentTimeMillis()} step=dialog-intent-unresolved action=\u00024{permissionIntent.action}")
                    }\n`.replace(/\u00024/g, "$"),
  );
  changed = true;
  console.log("[patch-capacitor-health] resolveActivity-null avbryter inte längre dialogstarten (GRIM_RESOLVE_NONFATAL)");
}

if (!kt.includes("import android.content.ActivityNotFoundException")) {
  kt = kt.replace("import android.content.Intent\n", "import android.content.ActivityNotFoundException\nimport android.content.Intent\n");
}


// 5l. Watchdogen fick inte avbryta medan användaren fortfarande läser dialogen.
kt = kt.replace(/mainHandler\.postDelayed\(permissionWatchdog!!, 18_000\)/, "mainHandler.postDelayed(permissionWatchdog!!, 150_000)");

// 5m. GRIM_OFFICIAL_LAUNCHER_FIRST: Googles dokumenterade väg är
// PermissionController.createRequestPermissionResultContract() + launchern som
// registrerades i load(). Den handbyggda intenten via bryggan behålls bara som
// reserv och tvättas från FLAG_ACTIVITY_NEW_TASK (en ny task levererar aldrig
// något resultat tillbaka). Dessutom skiljs "callback kom aldrig" (HC_NATIVE_04)
// från "callback kom med oanvändbar data" (HC_NATIVE_06), och en obekräftad
// intent rapporteras som HC_NATIVE_05 i stället för en falsk HC_NATIVE_04.
if (!kt.includes("GRIM_OFFICIAL_LAUNCHER_FIRST")) {
  kt = kt.replace(
    /    private var lastRequestedPermissions: Set<CapHealthPermission> = emptySet\(\)/,
    `    private var lastRequestedPermissions: Set<CapHealthPermission> = emptySet()
    // GRIM_OFFICIAL_LAUNCHER_FIRST
    private var pendingPermissionCall: PluginCall? = null
    private var permissionCallbackSeen: Boolean = false
    private var lastIntentUnresolved: Boolean = false`,
  );

  const oldRegion =
    /                val handedToBridge = try \{[\s\S]*?\n                \}\n                healthTrace\("dialog-launch-returned"\)/;
  kt = kt.replace(
    oldRegion,
    `                pendingPermissionCall = call
                permissionCallbackSeen = false
                var intentResolved: String? = null
                try {
                    val permissionIntent = permissionContract.createIntent(activity, healthConnectPermissions)
                    intentResolved = permissionIntent.resolveActivity(context.packageManager)?.flattenToShortString()
                    healthTrace(
                        "dialog-intent",
                        "action=\${permissionIntent.action} resolved=\$intentResolved permissions=\$healthConnectPermissions"
                    )
                    // GRIM_RESOLVE_NONFATAL: resolveActivity kan ge null enbart pga
                    // paketfiltrering (Android 11+) även när Health Connect finns.
                    if (intentResolved == null) {
                        Log.w(tag, "health-ts=\${System.currentTimeMillis()} step=dialog-intent-unresolved action=\${permissionIntent.action}")
                    }
                } catch (e: Exception) {
                    Log.w(tag, "health-ts=\${System.currentTimeMillis()} step=dialog-intent-inspect-failed", e)
                }
                lastIntentUnresolved = intentResolved == null
                var launchedVia = "none"
                try {
                    healthTrace("dialog-launch-attempt", "route=launcher")
                    launcher.launch(healthConnectPermissions)
                    launchedVia = "launcher"
                    healthTrace("dialog-launch-ok", "route=launcher")
                } catch (primary: Exception) {
                    Log.e(tag, "health-ts=\${System.currentTimeMillis()} step=dialog-launch-failed route=launcher", primary)
                    try {
                        val fallbackIntent = permissionContract.createIntent(activity, healthConnectPermissions)
                        fallbackIntent.flags = fallbackIntent.flags and Intent.FLAG_ACTIVITY_NEW_TASK.inv()
                        healthTrace("dialog-launch-attempt", "route=bridge")
                        startActivityForResult(call, fallbackIntent, "handleHealthPermissionResult")
                        launchedVia = "bridge"
                        healthTrace("dialog-launch-ok", "route=bridge")
                    } catch (fallback: Exception) {
                        val launchReason = "\${fallback.javaClass.simpleName}: \${fallback.message ?: primary.message ?: "no message"}"
                        Log.e(
                            tag,
                            "health-ts=\${System.currentTimeMillis()} step=dialog-launch-failed route=bridge code=HC_NATIVE_05 reason=\$launchReason",
                            fallback
                        )
                        requestPermissionContext.set(null)
                        pendingPermissionCall = null
                        lastPermissionCallId = null
                        lastRequestedPermissions = emptySet()
                        call.reject("HC_NATIVE_05: \$launchReason")
                        bridge.releaseCall(call)
                        return@runOnUiThread
                    }
                }
                healthTrace("dialog-launch-returned", "route=\$launchedVia")`.replace(/\u00024/g, "$"),
  );

  // Watchdogen ska skilja på uteblivet svar, oanvändbart svar och obekräftad start.
  kt = kt.replace(
    /                        Log\.e\(tag, "health-ts=\$\{System\.currentTimeMillis\(\)\} step=dialog-callback-timeout code=HC_NATIVE_04"\)\n                        call\.reject\("HC_NATIVE_04: permission dialog returned no callback"\)/,
    `                        val timeoutCode = when {
                            permissionCallbackSeen -> "HC_NATIVE_06: permission dialog returned an unusable result"
                            lastIntentUnresolved -> "HC_NATIVE_05: permission dialog start could not be confirmed (intent unresolved)"
                            else -> "HC_NATIVE_04: permission dialog returned no callback"
                        }
                        Log.e(tag, "health-ts=\${System.currentTimeMillis()} step=dialog-callback-timeout code=\${timeoutCode.substringBefore(":")} callbackSeen=\$permissionCallbackSeen unresolved=\$lastIntentUnresolved")
                        pendingPermissionCall = null
                        call.reject(timeoutCode)`.replace(/\u00024/g, "$"),
  );

  // Rå resultatloggning + fallback-referens i bryggans callback.
  kt = kt.replace(
    /        val granted = try \{\n            permissionContract\.parseResult\(result\.resultCode, result\.data\)\n        \} catch \(e: Exception\) \{\n            Log\.e\(tag, "health-ts=\$\{System\.currentTimeMillis\(\)\} step=dialog-result-parse-failed", e\)\n            emptySet<String>\(\)\n        \}/,
    `        permissionCallbackSeen = true
        healthTrace(
            "dialog-result-raw",
            "resultCode=\${result.resultCode} hasData=\${result.data != null} extras=\${result.data?.extras?.keySet()?.joinToString(",") ?: "none"}"
        )
        var parseFailed = false
        val granted = try {
            permissionContract.parseResult(result.resultCode, result.data)
        } catch (e: Exception) {
            parseFailed = true
            Log.e(tag, "health-ts=\${System.currentTimeMillis()} step=dialog-result-parse-failed code=HC_NATIVE_06", e)
            emptySet<String>()
        }`.replace(/\u00024/g, "$"),
  );
  kt = kt.replace(
    /        val target = call \?: pending\?\.pluginCal \?: lastPermissionCallId\?\.let \{ bridge\.getSavedCall\(it\) \}\n        val requested/,
    `        val target = call ?: pending?.pluginCal ?: pendingPermissionCall ?: lastPermissionCallId?.let { bridge.getSavedCall(it) }
        val requested`,
  );
  kt = kt.replace(
    /        if \(target == null\) \{\n            Log\.w\(tag, "health-ts=\$\{System\.currentTimeMillis\(\)\} step=bridge-dialog-response-orphan"\)\n            return\n        \}\n        target\.resolve\(grantedPermissionResult\(requested, granted\)\)\n        bridge\.releaseCall\(target\)/,
    `        pendingPermissionCall = null
        if (target == null) {
            Log.w(tag, "health-ts=\${System.currentTimeMillis()} step=bridge-dialog-response-orphan code=HC_NATIVE_06")
            return
        }
        if (parseFailed) {
            target.reject("HC_NATIVE_06: permission dialog returned an unusable result")
            bridge.releaseCall(target)
            return
        }
        target.resolve(grantedPermissionResult(requested, granted))
        bridge.releaseCall(target)`.replace(/\u00024/g, "$"),
  );

  // Launcher-callbacken (officiella vägen) ska också rensa state och logga rått svar.
  kt = kt.replace(
    /                healthTrace\("dialog-response", "granted=\$\{grantedPermissions\.size\}"\)/,
    `                permissionCallbackSeen = true
                healthTrace("dialog-response", "granted=\${grantedPermissions.size} granted-set=\$grantedPermissions")`.replace(/\u00024/g, "$"),
  );
  kt = kt.replace(
    /                    val saved = lastPermissionCallId\?\.let \{ bridge\.getSavedCall\(it\) \}/,
    `                    val saved = pendingPermissionCall ?: lastPermissionCallId?.let { bridge.getSavedCall(it) }`,
  );
  kt = kt.replace(
    /                lastPermissionCallId = null\n                lastRequestedPermissions = emptySet\(\)\n            \}\n            permissionsLauncher = activity\.registerForActivityResult\(contract, callback\)/,
    `                pendingPermissionCall = null
                lastPermissionCallId = null
                lastRequestedPermissions = emptySet()
            }
            permissionsLauncher = activity.registerForActivityResult(contract, callback)`,
  );
}

// Äldre/partiellt applicerade versioner av patchen kunde lämna en trasig
// Kotlin-interpolering i launch-fallbacken. Rätta den även när huvudmarkören
// redan finns, så varje Android-bygge blir reproducerbart.
kt = kt.replace('call.reject("HC_NATIVE_05: 4launchReason")', 'call.reject("HC_NATIVE_05: $launchReason")');

// 5n. GRIM_FOREGROUND_LAUNCH: dialogen kan hamna bakom appen om den startas
// medan aktiviteten inte har fönsterfokus (t.ex. direkt efter en kall start
// eller när en annan intent just levererats). Skjut då upp starten tills
// aktiviteten verkligen ligger överst. Dessutom exponeras ett "in flight"-läge
// så MainActivity (launchMode=singleTask) inte kan dra sig själv över dialogen.
if (!kt.includes("GRIM_FOREGROUND_LAUNCH")) {
  kt = kt.replace(
    /    private var lastIntentUnresolved: Boolean = false/,
    `    private var lastIntentUnresolved: Boolean = false
    // GRIM_FOREGROUND_LAUNCH
    private var foregroundWaitCount: Int = 0`,
  );
  kt = kt.replace(
    /        activity\.runOnUiThread \{\n            try \{\n                val launcher = permissionsLauncher/,
    `        activity.runOnUiThread {
            try {
                // GRIM_FOREGROUND_LAUNCH: starta aldrig dialogen utan fönsterfokus.
                if (!activity.hasWindowFocus() && foregroundWaitCount < 20) {
                    foregroundWaitCount++
                    healthTrace("dialog-defer-no-focus", "attempt=\$foregroundWaitCount")
                    mainHandler.postDelayed({ requestHealthPermissions(call) }, 250)
                    return@runOnUiThread
                }
                foregroundWaitCount = 0
                val launcher = permissionsLauncher`,
  );
  kt = kt.replace(
    /                pendingPermissionCall = call\n                permissionCallbackSeen = false/,
    `                pendingPermissionCall = call
                GrimHealthRequestState.inFlight = true
                permissionCallbackSeen = false`,
  );
  kt = kt.replace(
    /        permissionCallbackSeen = true\n        healthTrace\(\n            "dialog-result-raw"/,
    `        GrimHealthRequestState.inFlight = false
        permissionCallbackSeen = true
        healthTrace(
            "dialog-result-raw"`,
  );
  kt = kt.replace(
    /                permissionCallbackSeen = true\n                healthTrace\("dialog-response"/,
    `                GrimHealthRequestState.inFlight = false
                permissionCallbackSeen = true
                healthTrace("dialog-response"`,
  );
  kt = kt.replace(
    /                    val pending = requestPermissionContext\.getAndSet\(null\)\n                    if \(pending\?\.pluginCal\?\.callbackId == call\.callbackId\) \{/,
    `                    val pending = requestPermissionContext.getAndSet(null)
                    GrimHealthRequestState.inFlight = false
                    if (pending?.pluginCal?.callbackId == call.callbackId) {`,
  );
  kt = kt.replace(
    /                        call\.reject\("HC_NATIVE_05: \$launchReason"\)/,
    `                        GrimHealthRequestState.inFlight = false
                        call.reject("HC_NATIVE_05: \$launchReason")`,
  );
  kt = `${kt.trimEnd()}

// GRIM_HEALTH_REQUEST_STATE: läses av MainActivity för att undvika att appen
// dras fram över Health Connects behörighetsdialog (launchMode=singleTask).
object GrimHealthRequestState {
    @Volatile
    @JvmStatic
    var inFlight: Boolean = false
}
`;
}

// 5o. Behörighetskontrollen körs i samma trådmönster som dialogstarten. Health
// Connect-anropen är suspend-funktioner och blockerar inte UI-tråden.
kt = kt.replace(
  /(fun checkHealthPermissions\(call: PluginCall\) \{[\s\S]*?)CoroutineScope\(Dispatchers\.IO\)\.launch \{/,
  "$1CoroutineScope(Dispatchers.Main).launch {",
);

// 5p. Lägg Health Connect-kontraktet i en egen, överliggande Activity. Då är
// dialogens launcher och callback bundna till samma Activity även om Grims
// singleTask-MainActivity får fokus eller återskapas. Capacitor väntar bara på
// proxy-aktivitetens vanliga ActivityResult, vilket även isolerar request codes.
const proxySource = `package com.fit_up.health.capacitor

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController

// GRIM_HC_DIAGNOSTICS: senaste permission-försöket, läses av grimHealthDiagnostics().
object GrimHcDiag {
    @Volatile @JvmStatic var launcherRegistered: Boolean = false
    @Volatile @JvmStatic var launchAttempted: Boolean = false
    @Volatile @JvmStatic var launchReturned: Boolean = false
    @Volatile @JvmStatic var resultReceived: Boolean = false
    @Volatile @JvmStatic var lastRequested: List<String> = emptyList()
    @Volatile @JvmStatic var lastGranted: List<String> = emptyList()
    @Volatile @JvmStatic var lastResolvers: List<String> = emptyList()
    @Volatile @JvmStatic var lastError: String? = null
    @Volatile @JvmStatic var lastEvent: String = "none"
}

class HealthPermissionProxyActivity : ComponentActivity() {
    companion object {
        const val EXTRA_PERMISSIONS = "grim.health.permissions"
        const val EXTRA_GRANTED = "grim.health.granted"
        const val EXTRA_ERROR = "grim.health.error"
        const val TAG = "GRIM_HC"
    }

    private val contract: ActivityResultContract<Set<String>, Set<String>> =
        PermissionController.createRequestPermissionResultContract()

    private val launcher = registerForActivityResult(contract) { granted ->
        GrimHcDiag.resultReceived = true
        GrimHcDiag.lastGranted = granted.toList()
        GrimHcDiag.lastEvent = "result"
        Log.i(TAG, "GRIM_HC: PERMISSION_RESULT ts=\${System.currentTimeMillis()} granted=\$granted")
        setResult(
            Activity.RESULT_OK,
            Intent().putStringArrayListExtra(EXTRA_GRANTED, ArrayList(granted))
        )
        finish()
    }.also { GrimHcDiag.launcherRegistered = true }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) return

        val requested = intent.getStringArrayListExtra(EXTRA_PERMISSIONS)?.toSet().orEmpty()
        if (requested.isEmpty()) {
            finishWithError("HC_NATIVE_05: No Health Connect permissions were supplied")
            return
        }

        launchPermissionDialog(requested)
    }

    private var launched = false
    private var resumeCount = 0

    override fun onResume() {
        super.onResume()
        resumeCount += 1
        // Kommer vi tillbaka hit efter att dialogen startats utan att callbacken
        // triggats har Health Connect stängts utan svar - rapportera direkt i
        // stället för att låta appen vänta ut hela tidsgränsen.
        if (launched && resumeCount > 1 && !isFinishing) {
            Log.w(TAG, "GRIM_HC: DIALOG_CLOSED_WITHOUT_RESULT ts=\${System.currentTimeMillis()}")
            finishWithError("HC_NATIVE_08: Health Connect closed without returning a permission result")
        }
    }

    /** Kan Android resolva exakt den intent som Googles kontrakt skapar? */
    private fun resolversFor(requested: Set<String>): List<String> {
        return try {
            val intent = contract.createIntent(this, requested)
            val matches = if (Build.VERSION.SDK_INT >= 33) {
                packageManager.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()))
            } else {
                @Suppress("DEPRECATION")
                packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
            }
            Log.i(TAG, "GRIM_HC: permission intent action=\${intent.action} package=\${intent.\`package\`}")
            matches.map { "\${it.activityInfo.packageName}/\${it.activityInfo.name}" }
        } catch (error: Exception) {
            Log.e(TAG, "GRIM_HC: permission intent resolution threw", error)
            emptyList()
        }
    }

    private fun launchPermissionDialog(requested: Set<String>) {
        GrimHcDiag.launchAttempted = false
        GrimHcDiag.launchReturned = false
        GrimHcDiag.resultReceived = false
        GrimHcDiag.lastError = null
        GrimHcDiag.lastGranted = emptyList()
        GrimHcDiag.lastRequested = requested.toList()
        val resolvers = resolversFor(requested)
        GrimHcDiag.lastResolvers = resolvers
        Log.i(TAG, "GRIM_HC: permission intent resolvers = \$resolvers")
        val sdkStatus = try { HealthConnectClient.getSdkStatus(this) } catch (e: Exception) { -1 }
        Log.i(
            TAG,
            "GRIM_HC: BEFORE_PERMISSION_LAUNCH ts=\${System.currentTimeMillis()} activity=\$this class=\${javaClass.name} " +
                "lifecycle=\${lifecycle.currentState} sdkStatus=\$sdkStatus api=\${Build.VERSION.SDK_INT} " +
                "manufacturer=\${Build.MANUFACTURER} package=\$packageName"
        )
        Log.i(TAG, "GRIM_HC: requestedPermissions=\$requested")
        if (resolvers.isEmpty()) {
            finishWithError("HC_NATIVE_07: No activity can handle the Health Connect permission intent")
            return
        }
        try {
            launched = true
            GrimHcDiag.launchAttempted = true
            GrimHcDiag.lastEvent = "launch"
            launcher.launch(requested)
            GrimHcDiag.launchReturned = true
            Log.i(TAG, "GRIM_HC: AFTER_PERMISSION_LAUNCH ts=\${System.currentTimeMillis()} lifecycle=\${lifecycle.currentState}")
        } catch (error: Throwable) {
            Log.e(TAG, "GRIM_HC: PERMISSION_LAUNCH_FAILED ts=\${System.currentTimeMillis()}", error)
            finishWithError("HC_NATIVE_05: \${error.javaClass.simpleName}: \${error.message ?: "no message"}")
        }
    }

    private fun finishWithError(message: String) {
        GrimHcDiag.lastError = message
        GrimHcDiag.lastEvent = "error"
        Log.e(TAG, "GRIM_HC: PERMISSION_ERROR \$message")
        setResult(Activity.RESULT_CANCELED, Intent().putExtra(EXTRA_ERROR, message))
        finish()
    }
}
`;

fs.mkdirSync(path.dirname(PERMISSION_PROXY), { recursive: true });
if (!fs.existsSync(PERMISSION_PROXY) || fs.readFileSync(PERMISSION_PROXY, "utf8") !== proxySource) {
  fs.writeFileSync(PERMISSION_PROXY, proxySource, "utf8");
  console.log("[patch-capacitor-health] lifecycle-isolerad Health Connect-proxy installerad.");
}

if (!kt.includes("GRIM_PERMISSION_PROXY_ACTIVITY")) {
  if (!kt.includes("import android.app.Activity\n")) {
    kt = kt.replace("import android.content.ActivityNotFoundException\n", "import android.app.Activity\nimport android.content.ActivityNotFoundException\n");
  }

  kt = kt.replace(
    /    @ActivityCallback\n    fun handleHealthPermissionResult\(call: PluginCall\?, result: ActivityResult\) \{[\s\S]*?\n    \}\n\n    override fun load\(\)/,
    `    // GRIM_PERMISSION_PROXY_ACTIVITY
    @ActivityCallback
    fun handleHealthPermissionResult(call: PluginCall?, result: ActivityResult) {
        permissionWatchdog?.let { mainHandler.removeCallbacks(it) }
        permissionWatchdog = null
        GrimHealthRequestState.inFlight = false
        permissionCallbackSeen = true
        val error = result.data?.getStringExtra(HealthPermissionProxyActivity.EXTRA_ERROR)
        val granted = result.data
            ?.getStringArrayListExtra(HealthPermissionProxyActivity.EXTRA_GRANTED)
            ?.toSet()
            .orEmpty()
        healthTrace(
            "proxy-result-raw",
            "resultCode=\${result.resultCode} hasData=\${result.data != null} granted=\${granted.size} error=\${error ?: "none"}"
        )
        val pending = requestPermissionContext.getAndSet(null)
        val target = call ?: pending?.pluginCal ?: pendingPermissionCall ?: lastPermissionCallId?.let { bridge.getSavedCall(it) }
        val requested = pending?.requestedPermissions ?: lastRequestedPermissions
        lastPermissionCallId = null
        lastRequestedPermissions = emptySet()
        pendingPermissionCall = null
        if (target == null) {
            Log.w(tag, "health-ts=\${System.currentTimeMillis()} step=proxy-dialog-response-orphan code=HC_NATIVE_06")
            return
        }
        if (result.resultCode != Activity.RESULT_OK || error != null) {
            val coded = error?.takeIf { it.startsWith("HC_NATIVE_") }
            target.reject(coded ?: "HC_NATIVE_05: \${error ?: "Health Connect permission activity was cancelled before returning a result"}")
            bridge.releaseCall(target)
            return
        }
        target.resolve(grantedPermissionResult(requested, granted))
        bridge.releaseCall(target)
    }

    override fun load()`,
  );

  kt = kt.replace(
    /                var intentResolved: String\? = null[\s\S]*?                healthTrace\("dialog-launch-returned", "route=\$launchedVia"\)/,
    `                try {
                    val proxyIntent = Intent(activity, HealthPermissionProxyActivity::class.java).apply {
                        putStringArrayListExtra(
                            HealthPermissionProxyActivity.EXTRA_PERMISSIONS,
                            ArrayList(healthConnectPermissions)
                        )
                    }
                    healthTrace("dialog-launch-attempt", "route=proxy")
                    startActivityForResult(call, proxyIntent, "handleHealthPermissionResult")
                    healthTrace("dialog-launch-returned", "route=proxy")
                    lastIntentUnresolved = false
                } catch (launchError: Exception) {
                    val launchReason = "\${launchError.javaClass.simpleName}: \${launchError.message ?: "no message"}"
                    Log.e(tag, "health-ts=\${System.currentTimeMillis()} step=dialog-launch-failed route=proxy code=HC_NATIVE_05 reason=\$launchReason", launchError)
                    requestPermissionContext.set(null)
                    pendingPermissionCall = null
                    lastPermissionCallId = null
                    lastRequestedPermissions = emptySet()
                    GrimHealthRequestState.inFlight = false
                    call.reject("HC_NATIVE_05: \$launchReason")
                    bridge.releaseCall(call)
                    return@runOnUiThread
                }`.replace(/\\\$/g, "$"),
  );
}

// 5q. GRIM_HC_DIAGNOSTICS_METHOD: native statusrapport för felsökning på enhet.
// Går direkt mot Health Connect utan JS-synkens logik.
if (!kt.includes("GRIM_HC_DIAGNOSTICS_METHOD")) {
  const diagMethod = `    // GRIM_HC_DIAGNOSTICS_METHOD
    @PluginMethod
    fun grimHealthDiagnostics(call: PluginCall) {
        val result = JSObject()
        val sdkStatus = try { HealthConnectClient.getSdkStatus(context) } catch (e: Exception) { -1 }
        result.put("apiLevel", android.os.Build.VERSION.SDK_INT)
        result.put("manufacturer", android.os.Build.MANUFACTURER)
        result.put("model", android.os.Build.MODEL)
        result.put("packageName", context.packageName)
        result.put("sdkStatus", sdkStatus)
        result.put("sdkAvailable", sdkStatus == HealthConnectClient.SDK_AVAILABLE)
        val candidates = listOf("com.google.android.apps.healthdata", "com.google.android.healthconnect.controller", "com.android.healthconnect.controller")
        val installed = JSArray()
        for (pkg in candidates) {
            try { context.packageManager.getPackageInfo(pkg, 0); installed.put(pkg) } catch (e: Exception) { }
        }
        result.put("installedPackages", installed)
        result.put("installed", installed.length() > 0 || sdkStatus == HealthConnectClient.SDK_AVAILABLE)
        val requested = permissionMapping.values.filter { p ->
            listOf("READ_STEPS", "READ_ACTIVE_CALORIES_BURNED", "READ_DISTANCE", "READ_EXERCISE", "READ_HEART_RATE", "READ_SLEEP").any { p.endsWith(it) }
        }.toSet()
        val resolvers = JSArray()
        try {
            val intent = permissionContract.createIntent(context, requested)
            result.put("permissionIntentAction", intent.action ?: "")
            result.put("permissionIntentPackage", intent.\\\`package\\\` ?: "")
            @Suppress("DEPRECATION")
            for (info in context.packageManager.queryIntentActivities(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)) {
                resolvers.put("\\${info.activityInfo.packageName}/\\${info.activityInfo.name}")
            }
        } catch (e: Exception) {
            result.put("permissionIntentError", "\\${e.javaClass.simpleName}: \\${e.message}")
        }
        result.put("permissionIntentResolvers", resolvers)
        Log.i("GRIM_HC", "GRIM_HC: permission intent resolvers = \\$resolvers")
        result.put("requestedPermissions", JSArray(requested.toList()))
        result.put("launcherRegistered", permissionsLauncher != null || GrimHcDiag.launcherRegistered)
        result.put("proxyLauncherRegistered", GrimHcDiag.launcherRegistered)
        result.put("launchAttempted", GrimHcDiag.launchAttempted)
        result.put("launchReturned", GrimHcDiag.launchReturned)
        result.put("resultReceived", GrimHcDiag.resultReceived)
        result.put("lastRequested", JSArray(GrimHcDiag.lastRequested))
        result.put("lastGranted", JSArray(GrimHcDiag.lastGranted))
        result.put("lastResolvers", JSArray(GrimHcDiag.lastResolvers))
        result.put("lastError", GrimHcDiag.lastError ?: "")
        result.put("lastEvent", GrimHcDiag.lastEvent)
        if (sdkStatus != HealthConnectClient.SDK_AVAILABLE || !ensureClient()) {
            Log.i("GRIM_HC", "GRIM_HC: DIAGNOSTICS \\$result")
            call.resolve(result)
            return
        }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val granted = healthConnectClient.permissionController.getGrantedPermissions()
                result.put("grantedPermissions", JSArray(granted.toList()))
                result.put("missingPermissions", JSArray(requested.filter { !granted.contains(it) }))
                // Grim syns i Health Connect oavsett om något redan är beviljat.
                result.put("registered", true)
            } catch (e: Exception) {
                result.put("grantedError", "\\${e.javaClass.simpleName}: \\${e.message}")
            }
            Log.i("GRIM_HC", "GRIM_HC: DIAGNOSTICS \\$result")
            call.resolve(result)
        }
    }

`;
  kt = kt.replace("    // Open Google Health Connect app settings\n", `${diagMethod}    // Open Google Health Connect app settings\n`);
}

const requiredMarkers = [
  "GRIM_BRIDGE_ACTIVITY_RESULT",
  "handleHealthPermissionResult",
  "GRIM_LAUNCH_GUARD",
  "GRIM_FOREGROUND_LAUNCH",
  "GRIM_HEALTH_REQUEST_STATE",
  "CoroutineScope(Dispatchers.Main).launch {",
  "HC_NATIVE_05",
  "GRIM_OFFICIAL_LAUNCHER_FIRST",
  "HC_NATIVE_06",
  "GRIM_PERMISSION_PROXY_ACTIVITY",
  "proxy-result-raw",
  'healthTrace("dialog-launch-attempt", "route=proxy")',
  "GRIM_HC_DIAGNOSTICS_METHOD",
];
const missingMarkers = requiredMarkers.filter((m) => !kt.includes(m));
if (missingMarkers.length > 0) {
  console.error(`[patch-capacitor-health] kunde inte installera bryggans activity-result-hantering: ${missingMarkers.join(", ")}`);
  process.exit(1);
}


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
  if (!xml.includes("HealthPermissionProxyActivity")) {
    const activity = `        <activity\n            android:name=".HealthPermissionProxyActivity"\n            android:exported="false"\n            android:theme="@android:style/Theme.Translucent.NoTitleBar" />`;
    if (/<application(?:\s[^>]*)?>/.test(xml)) {
      xml = xml.replace(/<application(?:\s[^>]*)?>/, (tag) => `${tag}\n${activity}`);
    } else {
      xml = xml.replace("</manifest>", `    <application>\n${activity}\n    </application>\n</manifest>`);
    }
    fs.writeFileSync(PLUGIN_MANIFEST, xml, "utf8");
    console.log("[patch-capacitor-health] Plugin-manifest: permission-proxy tillagd.");
  }
}

// 7. Gradle: samma AGP och core-ktx som rootProject. Pluginets alpha01 är för
// gammal för den aktuella Android 16-modulen: alpha05 säkrade intents och
// rättade signaturvalidering, alpha06 uppdaterade Health Connect-certifikaten.
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
  gradle = gradle.replace(
    /implementation ["']androidx\.health\.connect:connect-client:[^"']+["']/g,
    `implementation 'androidx.health.connect:connect-client:${HEALTH_CONNECT_CLIENT_VERSION}'`
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
