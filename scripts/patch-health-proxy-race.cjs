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
  kt = kt.replace(
    "private val launcher = registerForActivityResult(contract) { granted ->",
    "private val launcher = registerForActivityResult(contract) { granted ->\n        resultDelivered = true\n        mainHandler.removeCallbacksAndMessages(null)"
  );
  kt = kt.replace(
    /    private var launched = false\n    private var resumeCount = 0\n\n    override fun onResume\(\) \{[\s\S]*?\n    \}\n/,
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
                finishWithError("HC_NATIVE_08: Health Connect closed without returning a permission result")
            }
        }, 400)
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
    `launcher.launch(requested)
            // GRIM_SHEET_WATCHDOG: om rutan aldrig pausar oss är den inte synlig.
            // Avsluta så WebView-timern kan köra och synken inte hänger.
            mainHandler.postDelayed({
                if (!resultDelivered && !sawPauseAfterLaunch && !isFinishing) {
                    finishWithError("HC_NATIVE_04: Health Connect permission sheet did not appear")
                }
            }, 4000)`
  );
}

if (!kt.includes("sawPauseAfterLaunch") || !kt.includes("GRIM_SHEET_WATCHDOG")) {
  console.error("[patch-health-proxy-race] kunde inte patcha proxyn.");
  process.exit(1);
}
fs.writeFileSync(proxy, kt);
console.log("[patch-health-proxy-race] proxy avslutas om rutan inte syns inom 4 s.");

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
