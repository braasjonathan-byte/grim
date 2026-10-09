#!/usr/bin/env node
/**
 * Körs efter scripts/patch-capacitor-health.cjs.
 * Den proxyn räknar andra onResume som att Health Connect stängdes och skickar
 * HC_NATIVE_08 även när användaren godkänner. Det händer på Samsung för att
 * aktiviteten är translucent och MainActivity är singleTask.
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
  console.error("[patch-health-proxy-race] proxy saknas, patch-capacitor-health måste köra först.");
  process.exit(1);
}

let kt = fs.readFileSync(proxy, "utf8");
if (!kt.includes("sawPauseAfterLaunch")) {
  if (!kt.includes("private var launched = false")) {
    console.error("[patch-health-proxy-race] känner inte igen proxyn, avbryter.");
    process.exit(1);
  }
  kt = kt.replace(
    "private val launcher = registerForActivityResult(contract) { granted ->",
    "private val launcher = registerForActivityResult(contract) { granted ->\n        resultDelivered = true\n        mainHandler.removeCallbacksAndMessages(null)"
  );
  kt = kt.replace(
    `    private var launched = false
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
    }`,
    `    private var launched = false
    private var sawPauseAfterLaunch = false
    private var resultDelivered = false
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())

    override fun onPause() {
        super.onPause()
        if (launched && !resultDelivered) sawPauseAfterLaunch = true
    }

    override fun onResume() {
        super.onResume()
        if (!launched || resultDelivered || !sawPauseAfterLaunch || isFinishing) return
        mainHandler.postDelayed({
            if (!resultDelivered && !isFinishing) {
                Log.w(TAG, "GRIM_HC: DIALOG_CLOSED_WITHOUT_RESULT ts=\${System.currentTimeMillis()}")
                finishWithError("HC_NATIVE_08: Health Connect closed without returning a permission result")
            }
        }, 400)
    }`
  );
  kt = kt.replace(
    "private fun finishWithError(message: String) {\n        GrimHcDiag.lastError = message",
    "private fun finishWithError(message: String) {\n        if (resultDelivered) return\n        resultDelivered = true\n        mainHandler.removeCallbacksAndMessages(null)\n        GrimHcDiag.lastError = message"
  );
  if (!kt.includes("sawPauseAfterLaunch")) {
    console.error("[patch-health-proxy-race] kunde inte byta onResume.");
    process.exit(1);
  }
  fs.writeFileSync(proxy, kt);
  console.log("[patch-health-proxy-race] proxy väntar på onPause innan HC_NATIVE_08.");
}

if (fs.existsSync(manifest)) {
  let xml = fs.readFileSync(manifest, "utf8");
  const next = xml.replace(
    'android:theme="@android:style/Theme.Translucent.NoTitleBar"',
    'android:theme="@android:style/Theme.DeviceDefault.NoActionBar" android:taskAffinity="se.grim.app.health"'
  );
  if (next !== xml) {
    fs.writeFileSync(manifest, next);
    console.log("[patch-health-proxy-race] proxy-tema bytt från translucent.");
  }
}
