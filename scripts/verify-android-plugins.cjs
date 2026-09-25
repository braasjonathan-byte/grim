#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const nodeModules = path.join(root, "node_modules");
const expected = {
  agp: "8.13.0",
  compileSdk: 36,
  targetSdk: 36,
  minSdk: 24,
  healthConnectClient: "1.2.0-alpha06",
};

const failures = [];
let checked = 0;

const capacitorConfig = fs.readFileSync(path.join(root, "capacitor.config.ts"), "utf8");
if (!capacitorConfig.includes("'capacitor-health'")) {
  failures.push("capacitor.config.ts: capacitor-health is missing from android.includePlugins");
}

const generatedSettings = path.join(root, "android", "capacitor.settings.gradle");
if (fs.existsSync(generatedSettings)) {
  const settings = fs.readFileSync(generatedSettings, "utf8");
  if (!settings.includes("include ':capacitor-health'")) {
    failures.push("android/capacitor.settings.gradle: capacitor-health was not synced into Android");
  }
}

// Health Connect: utan integritetsadressen kraschar samtyckesvyn, och utan
// rationale-aktiviteten syns Grim inte i Health Connects app-lista.
const stringsPath = path.join(root, "android", "app", "src", "main", "res", "values", "strings.xml");
if (fs.existsSync(stringsPath)) {
  const strings = fs.readFileSync(stringsPath, "utf8");
  if (!strings.includes('name="privacy_policy_url"')) {
    failures.push("android/app/src/main/res/values/strings.xml: privacy_policy_url is missing (Health Connect rationale crashes)");
  } else if (!strings.includes("https://grim.lovable.app/privacy")) {
    failures.push("android/app/src/main/res/values/strings.xml: privacy_policy_url must point at https://grim.lovable.app/privacy");
  }
}

// Health Connect kräver Android 8 (API 26) eller senare.
const variablesPath = path.join(root, "android", "variables.gradle");
if (fs.existsSync(variablesPath)) {
  const variables = fs.readFileSync(variablesPath, "utf8");
  const match = variables.match(/minSdkVersion\s*=\s*(\d+)/);
  if (!match || Number(match[1]) < 26) {
    failures.push(`android/variables.gradle: minSdkVersion must be at least 26 for Health Connect (found ${match ? match[1] : "none"})`);
  }
}



const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
if (fs.existsSync(manifestPath)) {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const requiredHealth = [
    "android.permission.health.READ_STEPS",
    "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
    "android.permission.health.READ_DISTANCE",
    "android.permission.health.READ_EXERCISE",
    "android.permission.health.READ_HEART_RATE",
    "android.permission.health.READ_SLEEP",
  ];
  for (const permission of requiredHealth) {
    if (!manifest.includes(permission)) {
      failures.push(`AndroidManifest.xml: missing health permission ${permission}`);
    }
  }
  if (!manifest.includes("androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE")) {
    failures.push("AndroidManifest.xml: missing Health Connect permissions-rationale intent filter");
  }
  // Health Connect gör policylänken klickbar först när rationale-filtret
  // matchar BÅDE action och kategorin HEALTH_PERMISSIONS.
  const rationaleFilter = manifest.match(
    /<intent-filter>(?:(?!<\/intent-filter>)[\s\S])*ACTION_SHOW_PERMISSIONS_RATIONALE[\s\S]*?<\/intent-filter>/
  );
  if (!rationaleFilter) {
    failures.push("AndroidManifest.xml: rationale intent-filter not found");
  } else if (!rationaleFilter[0].includes("android.intent.category.HEALTH_PERMISSIONS")) {
    failures.push("AndroidManifest.xml: rationale intent-filter is missing the HEALTH_PERMISSIONS category (privacy link is unclickable)");
  }
  if (!manifest.includes("se.grim.app.HealthPrivacyActivity")) {
    failures.push("AndroidManifest.xml: rationale activity must point at se.grim.app.HealthPrivacyActivity (plugin view renders a blank page)");
  }
  if (!manifest.includes("HC_QUERIES_V2") || !manifest.includes("androidx.health.ACTION_REQUEST_PERMISSIONS")) {
    failures.push("android: AndroidManifest.xml saknar HC_QUERIES_V2 <queries> för Health Connect — kör `node scripts/patch-android-manifest.cjs`");
  }
  if (!manifest.includes("com.google.android.apps.healthdata")) {
    failures.push("AndroidManifest.xml: missing Health Connect package visibility <queries> entry");
  }
}

const healthPlugin = path.join(
  nodeModules,
  "capacitor-health/android/src/main/java/com/fit_up/health/capacitor/HealthPlugin.kt"
);
const healthPermissionProxy = path.join(
  nodeModules,
  "capacitor-health/android/src/main/java/com/fit_up/health/capacitor/HealthPermissionProxyActivity.kt"
);
const healthPluginManifest = path.join(
  nodeModules,
  "capacitor-health/android/src/main/AndroidManifest.xml"
);
const healthPluginGradle = path.join(nodeModules, "capacitor-health/android/build.gradle");
if (!fs.existsSync(healthPluginGradle)) {
  failures.push("capacitor-health: build.gradle is missing");
} else {
  const gradle = fs.readFileSync(healthPluginGradle, "utf8");
  const dependency = gradle.match(/androidx\.health\.connect:connect-client:([^'\"]+)/);
  if (!dependency || dependency[1] !== expected.healthConnectClient) {
    failures.push(
      `capacitor-health: connect-client must be ${expected.healthConnectClient} for current Android 16 compatibility (found ${dependency ? dependency[1] : "none"})`,
    );
  }
}
{
  const rootGradle = path.join(__dirname, "..", "android", "build.gradle");
  if (fs.existsSync(rootGradle) && !fs.readFileSync(rootGradle, "utf8").includes("GRIM_HC_CLIENT_GUARD")) {
    failures.push("android/build.gradle: GRIM_HC_CLIENT_GUARD (fails build on old connect-client) is missing");
  }
  const proxy = path.join(nodeModules, "capacitor-health/android/src/main/java/com/fit_up/health/capacitor/HealthPermissionProxyActivity.kt");
  const proxySrc = fs.existsSync(proxy) ? fs.readFileSync(proxy, "utf8") : "";
  for (const marker of ["GRIM_HC: BEFORE_PERMISSION_LAUNCH", "GRIM_HC: AFTER_PERMISSION_LAUNCH", "GRIM_HC: PERMISSION_RESULT", "GRIM_HC: permission intent resolvers", "HC_NATIVE_07", "HC_NATIVE_08"]) {
    if (!proxySrc.includes(marker)) failures.push(`capacitor-health: proxy diagnostics marker missing: ${marker}`);
  }
}
if (!fs.existsSync(healthPluginManifest)) {
  failures.push("capacitor-health: AndroidManifest.xml is missing");
} else if (!fs.readFileSync(healthPluginManifest, "utf8").includes('android:name=".HealthPermissionProxyActivity"')) {
  failures.push("capacitor-health: HealthPermissionProxyActivity is not declared in the plugin manifest");
}
if (fs.existsSync(healthPlugin)) {
  const source = fs.readFileSync(healthPlugin, "utf8");
  if (!source.includes("READ_SLEEP") || !source.includes('"sleep" -> metricAndMapper')) {
    failures.push("capacitor-health: sleep support missing — run `node scripts/patch-capacitor-health.cjs`");
  }
  // Behörighetsdialogen måste startas från UI-tråden, annars hänger anropet.
  if (!source.includes("activity.runOnUiThread {")) {
    failures.push("capacitor-health: permission request still launches off the UI thread — run `node scripts/patch-capacitor-health.cjs`");
  }
  if (!source.includes("fun ensureClient()")) {
    failures.push("capacitor-health: checkHealthPermissions lacks the lazy client guard — run `node scripts/patch-capacitor-health.cjs`");
  }
  // Utan sparat anrop tappas behörighetssvaret om aktiviteten återskapas,
  // och JS-löftet blir aldrig klart (evig laddning).
  if (!source.includes("GRIM_SAVED_PERMISSION_CALL")) {
    failures.push("capacitor-health: permission call is not persisted via bridge.saveCall — run `node scripts/patch-capacitor-health.cjs`");
  }
  if (!source.includes("GRIM_EARLY_PERMISSION_LAUNCHER") || !source.includes("launcher-registration-ok")) {
    failures.push("capacitor-health: permission launcher is not registered and diagnosed during plugin load");
  }
  if (!source.includes("HC_NATIVE_03") || !source.includes("step=dialog-start")) {
    failures.push("capacitor-health: native permission setup/dialog diagnostics are missing");
  }
  if (!source.includes("GRIM_APP_HEALTH_PERMISSIONS") || !source.includes("ACTION_MANAGE_HEALTH_PERMISSIONS")) {
    failures.push("capacitor-health: app-specific Health Connect permission settings intent is missing");
  }
  if (!source.includes("SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED") || !source.includes('"update-required"')) {
    failures.push("capacitor-health: installed versus update-required availability diagnostics are missing");
  }
  if (!source.includes("GRIM_PERMISSION_CALLBACK_WATCHDOG") || !source.includes("HC_NATIVE_04")) {
    failures.push("capacitor-health: native permission callback watchdog is missing");
  }
  if (!source.includes("hard deadline independent of activity focus") || source.includes('healthTrace("dialog-wait"')) {
    failures.push("capacitor-health: permission watchdog can still pause forever while activity focus is lost");
  }
  if (/bridge\.releaseCall\(call\)\s*\n\s*call\.reject\("HC_NATIVE_04/.test(source)) {
    failures.push("capacitor-health: watchdog releases the native call before rejecting it, leaving JS pending");
  }
  if (!source.includes("GRIM_LAUNCH_GUARD") || !source.includes("HC_NATIVE_05")) {

    failures.push("capacitor-health: synchronous dialog launch failures are not reported as HC_NATIVE_05");
  }
  if (!source.includes('healthTrace("dialog-launch-attempt"') || !source.includes('healthTrace("dialog-launch-returned"')) {
    failures.push("capacitor-health: launch attempt/success tracing around the permission dialog is missing");
  }
  if (!source.includes("GRIM_BRIDGE_ACTIVITY_RESULT") || !source.includes("@ActivityCallback")) {
    failures.push("capacitor-health: lifecycle-safe bridge activity result handling is missing");
  }
  if (!source.includes("GRIM_PERMISSION_PROXY_ACTIVITY")) {
    failures.push("capacitor-health: lifecycle-isolated official permission launcher is missing");
  }
  if (!source.includes("HC_NATIVE_06") || !source.includes('healthTrace(\n            "dialog-result-raw"')) {
    if (!source.includes('healthTrace(\n            "proxy-result-raw"')) {
      failures.push("capacitor-health: raw permission result logging / HC_NATIVE_06 separation is missing");
    }
  }
  if (!source.includes("GRIM_PERMISSION_PROXY_ACTIVITY") || !source.includes('healthTrace("dialog-launch-attempt", "route=proxy")')) {
    failures.push("capacitor-health: Health Connect permission flow is not isolated from MainActivity");
  }
  if (!fs.existsSync(healthPermissionProxy)) {
    failures.push("capacitor-health: HealthPermissionProxyActivity source is missing");
  } else {
    const proxy = fs.readFileSync(healthPermissionProxy, "utf8");
    if (!proxy.includes("PermissionController.createRequestPermissionResultContract()") || !proxy.includes("registerForActivityResult(contract)")) {
      failures.push("capacitor-health: permission proxy does not use Google's official Activity Result contract");
    }
  }
  if (source.includes('HC_NATIVE_05: 4launchReason')) {
    failures.push("capacitor-health: launch failure contains a broken Kotlin interpolation");
  }
} else {

  failures.push("capacitor-health: installed native source is missing; patch verification cannot pass");
}


const activityTemplate = path.join(root, "scripts/android/HealthPrivacyActivity.java");
const rationaleActivity = path.join(
  root,
  "android/app/src/main/java/se/grim/app/HealthPrivacyActivity.java"
);
if (!fs.existsSync(activityTemplate)) {
  failures.push("scripts/android/HealthPrivacyActivity.java template is missing (build cannot reinstall the rationale view)");
}
if (!fs.existsSync(rationaleActivity)) {
  failures.push("android: HealthPrivacyActivity.java is missing (Health Connect privacy link breaks)");
} else {
  const source = fs.readFileSync(rationaleActivity, "utf8");
  if (!source.includes("R.string.privacy_policy_url")) {
    failures.push("HealthPrivacyActivity.java: must read the policy URL from R.string.privacy_policy_url");
  }
  if (!source.includes("Intent.ACTION_VIEW")) {
    failures.push("HealthPrivacyActivity.java: must open the policy in the device browser");
  }
  if (fs.existsSync(activityTemplate) && fs.readFileSync(activityTemplate, "utf8") !== source) {
    failures.push("android: HealthPrivacyActivity.java differs from scripts/android template — run `node scripts/patch-android-manifest.cjs`");
  }
}


function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.name !== "build.gradle" && entry.name !== "build.gradle.kts") continue;
    if (!fullPath.includes(`${path.sep}android${path.sep}`)) continue;

    checked += 1;
    const source = fs.readFileSync(fullPath, "utf8");
    const relative = path.relative(root, fullPath);
    const checks = [
      [/com\.android\.tools\.build:gradle:([0-9.]+)/g, expected.agp, "AGP"],
      [/compileSdk(?:Version)?\s*[=( ]\s*(\d+)/g, String(expected.compileSdk), "compileSdk"],
      [/targetSdk(?:Version)?\s*[=( ]\s*(\d+)/g, String(expected.targetSdk), "targetSdk"],
    ];

    for (const [pattern, wanted, label] of checks) {
      for (const match of source.matchAll(pattern)) {
        if (match[1] !== wanted) {
          failures.push(`${relative}: ${label} ${match[1]} (expected ${wanted})`);
        }
      }
    }

    for (const match of source.matchAll(/minSdk(?:Version)?\s*[=( ]\s*(\d+)/g)) {
      if (Number(match[1]) < expected.minSdk) {
        failures.push(`${relative}: minSdk ${match[1]} is below ${expected.minSdk}`);
      }
    }
  }
}

walk(nodeModules);

if (checked === 0) {
  console.error("[verify-android-plugins] No Android plugin Gradle files found.");
  process.exit(1);
}

if (failures.length > 0) {
  console.error("[verify-android-plugins] Incompatible native plugin configuration:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(`[verify-android-plugins] Checked ${checked} Gradle files; SDK/AGP versions are compatible.`);