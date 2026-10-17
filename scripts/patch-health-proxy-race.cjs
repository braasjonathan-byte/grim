#!/usr/bin/env node
/**
 * Efter patch-capacitor-health.cjs.
 * Proxyn får inte lämna en tom aktivitet uppe: då fryser WebView-timers och
 * Synka hälsodata snurrar tills användaren dödar appen.
 */
const fs = require("fs");
const path = require("path");

const proxy = path.join(
  __dirname,
  "..",
  "node_modules",
  "capacitor-health",
  "android",
  "src/main/java/com/fit_up/health/capacitor/HealthPermissionProxyActivity.kt"
);
const manifest = path.join(
  __dirname,
  "..",
  "node_modules",
  "capacitor-health",
  "android",
  "src/main/AndroidManifest.xml"
);

if (!fs.existsSync(proxy)) {
  console.error("[patch-health-proxy-race] proxy saknas.");
  process.exit(1);
}

let kt = fs.readFileSync(proxy, "utf8");

if (!kt.includes("sawPauseAfterLaunch") && kt.includes("private var launched = false")) {
  if (!kt.includes("import kotlinx.coroutines.launch")) {
    kt = kt.replace("import androidx.activity.ComponentActivity\n", "import androidx.activity.ComponentActivity\nimport kotlinx.coroutines.launch\n");
  }
  // GRIM_SHEET_VISIBLE_AT: läses av pluginet för att förlänga sin tidsgräns när rutan syns.
  kt = kt.replace(
    "    @Volatile @JvmStatic var lastEvent: String = \"none\"\n",
    "    @Volatile @JvmStatic var lastEvent: String = \"none\"\n    @Volatile @JvmStatic var sheetVisibleAt: Long = 0L\n"
  );
  kt = kt.replace(
    "private val launcher = registerForActivityResult(contract) { granted ->",
    "private val launcher = registerForActivityResult(contract) { granted ->\n        resultDelivered = true\n        mainHandler.removeCallbacksAndMessages(null)"
  );
  kt = kt.replace(
    /    private var launched = false\n    private var resumeCount = 0\n\n    override fun onResume\(\) \{[\s\S]*?\n    \}\n/,
    `    private var launched = false
    private var sawPauseAfterLaunch = false
    private var resultDelivered = false
    private var isResumedNow = false
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
    // GRIM_RESUME_GRACE: Health Connect kan visa en mellanskärm (introduktion,
    // första start) så att proxyn kort får fokus igen innan behörighetsrutan visas.
    // Felet rapporteras först när proxyn legat kvar i förgrunden i 2 s utan svar,
    // och först efter att de beviljade behörigheterna lästs av.
    private val resumeCheck = Runnable { checkGrantedAfterResume() }

    override fun onPause() {
        super.onPause()
        isResumedNow = false
        mainHandler.removeCallbacks(resumeCheck)
        if (launched && !resultDelivered) {
            sawPauseAfterLaunch = true
            GrimHcDiag.sheetVisibleAt = System.currentTimeMillis()
        }
    }

    override fun onResume() {
        super.onResume()
        isResumedNow = true
        if (!launched || resultDelivered || !sawPauseAfterLaunch || isFinishing) return
        mainHandler.removeCallbacks(resumeCheck)
        mainHandler.postDelayed(resumeCheck, 2000)
    }

    private fun checkGrantedAfterResume() {
        if (resultDelivered || isFinishing || !isResumedNow) return
        val requested = intent.getStringArrayListExtra(EXTRA_PERMISSIONS)?.toSet().orEmpty()
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
            val granted = try {
                kotlinx.coroutines.withTimeout(3000) {
                    HealthConnectClient.getOrCreate(this@HealthPermissionProxyActivity)
                        .permissionController.getGrantedPermissions()
                }
            } catch (_: Throwable) {
                emptySet<String>()
            }
            if (resultDelivered || isFinishing) return@launch
            if (!isResumedNow) return@launch // rutan kom upp under kontrollen
            val grantedRequested = granted.intersect(requested)
            if (grantedRequested.isNotEmpty()) {
                Log.i(TAG, "GRIM_HC: RESUME_WITHOUT_RESULT_BUT_GRANTED granted=$grantedRequested")
                resultDelivered = true
                mainHandler.removeCallbacksAndMessages(null)
                GrimHcDiag.resultReceived = true
                GrimHcDiag.lastGranted = grantedRequested.toList()
                GrimHcDiag.lastEvent = "result-from-check"
                setResult(
                    Activity.RESULT_OK,
                    Intent().putStringArrayListExtra(EXTRA_GRANTED, ArrayList(grantedRequested))
                )
                finish()
            } else {
                finishWithError("HC_NATIVE_08: Health Connect closed without returning a permission result")
            }
        }
    }
`
  );
  kt = kt.replace(
    "private fun finishWithError(message: String) {\n        GrimHcDiag.lastError = message",
    "private fun finishWithError(message: String) {\n        if (resultDelivered) return\n        resultDelivered = true\n        mainHandler.removeCallbacksAndMessages(null)\n        GrimHcDiag.lastError = message"
  );
}

if (!kt.includes("GRIM_SHEET_WATCHDOG") && kt.includes("launcher.launch(requested)")) {
  kt = kt.replace(
    "launcher.launch(requested)",
    `GrimHcDiag.sheetVisibleAt = 0L
            launcher.launch(requested)
            // GRIM_SHEET_WATCHDOG: om rutan aldrig pausar oss är den inte synlig.
            // Avsluta så WebView-timern kan köra och synken inte hänger.
            mainHandler.postDelayed({
                if (!resultDelivered && !sawPauseAfterLaunch && !isFinishing) {
                    finishWithError("HC_NATIVE_04: Health Connect permission sheet did not appear")
                }
            }, 4000)
            // GRIM_SHEET_SAFETY_TIMEOUT: när rutan väl syns styr användaren tiden.
            // Skyddsnätet finns bara så att appen aldrig kan hänga för evigt.
            mainHandler.postDelayed({
                if (!resultDelivered && !isFinishing) {
                    finishWithError("HC_NATIVE_04: Health Connect permission sheet did not return in 120s")
                }
            }, 120_000)`
  );
}

if (!kt.includes("sawPauseAfterLaunch") || !kt.includes("GRIM_SHEET_WATCHDOG") || !kt.includes("GRIM_RESUME_GRACE") || !kt.includes("sheetVisibleAt: Long") || !kt.includes("GRIM_SHEET_SAFETY_TIMEOUT")) {
  console.error("[patch-health-proxy-race] kunde inte patcha proxyn.");
  process.exit(1);
}
fs.writeFileSync(proxy, kt);
console.log("[patch-health-proxy-race] proxy: 4 s tills rutan syns, sedan 120 s skyddsnät; HC_NATIVE_08 först efter 2 s i förgrunden och behörighetskontroll.");

if (fs.existsSync(manifest)) {
  let xml = fs.readFileSync(manifest, "utf8");
  xml = xml.replace(
    'android:theme="@android:style/Theme.Translucent.NoTitleBar"',
    'android:theme="@android:style/Theme.DeviceDefault.NoActionBar"'
  );
  xml = xml.replace(/\s*android:taskAffinity="se\.grim\.app\.health"/g, "");
  fs.writeFileSync(manifest, xml);
  console.log("[patch-health-proxy-race] taskAffinity borttagen.");
}
