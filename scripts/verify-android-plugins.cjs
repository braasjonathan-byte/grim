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
  if (!manifest.includes("com.google.android.apps.healthdata")) {
    failures.push("AndroidManifest.xml: missing Health Connect package visibility <queries> entry");
  }
}

const healthPlugin = path.join(
  nodeModules,
  "capacitor-health/android/src/main/java/com/fit_up/health/capacitor/HealthPlugin.kt"
);
if (fs.existsSync(healthPlugin)) {
  const source = fs.readFileSync(healthPlugin, "utf8");
  if (!source.includes("READ_SLEEP") || !source.includes('"sleep" -> metricAndMapper')) {
    failures.push("capacitor-health: sleep support missing — run `node scripts/patch-capacitor-health.cjs`");
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