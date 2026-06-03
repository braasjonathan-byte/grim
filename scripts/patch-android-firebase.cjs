#!/usr/bin/env node
/**
 * Configure Firebase / FCM in the generated Android project so that
 * @capacitor/push-notifications can register a device token.
 *
 * What it does:
 *   1. Copies google-services.json from project root to android/app/
 *   2. Adds the google-services classpath to android/build.gradle
 *   3. Applies the google-services plugin in android/app/build.gradle
 *
 * Run after every `npx cap add android` and `npx cap sync android`.
 *   node scripts/patch-android-firebase.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ANDROID = path.join(ROOT, "android");

if (!fs.existsSync(ANDROID)) {
  console.log("[patch-android-firebase] android/ not found — run `npx cap add android` first.");
  process.exit(0);
}

// 1. Copy google-services.json
const SRC = path.join(ROOT, "google-services.json");
const DEST = path.join(ANDROID, "app", "google-services.json");
if (!fs.existsSync(SRC)) {
  console.error("[patch-android-firebase] ERROR: google-services.json missing in project root.");
  process.exit(1);
}
fs.copyFileSync(SRC, DEST);
console.log("[patch-android-firebase] Copied google-services.json → android/app/");

// 2. Patch android/build.gradle (project-level) — add classpath
const PROJECT_GRADLE = path.join(ANDROID, "build.gradle");
if (fs.existsSync(PROJECT_GRADLE)) {
  let g = fs.readFileSync(PROJECT_GRADLE, "utf8");
  if (!g.includes("com.google.gms:google-services")) {
    // Insert inside the existing dependencies { } block under buildscript
    g = g.replace(
      /(buildscript\s*\{[\s\S]*?dependencies\s*\{)/,
      `$1\n        classpath 'com.google.gms:google-services:4.4.2'`
    );
    fs.writeFileSync(PROJECT_GRADLE, g, "utf8");
    console.log("[patch-android-firebase] Added google-services classpath to android/build.gradle");
  } else {
    console.log("[patch-android-firebase] google-services classpath already present.");
  }
}

// 3. Patch android/app/build.gradle — apply plugin at bottom
const APP_GRADLE = path.join(ANDROID, "app", "build.gradle");
if (fs.existsSync(APP_GRADLE)) {
  let g = fs.readFileSync(APP_GRADLE, "utf8");
  const APPLY_LINE = "apply plugin: 'com.google.gms.google-services'";
  if (!g.includes(APPLY_LINE)) {
    g = g.trimEnd() + "\n\n" + APPLY_LINE + "\n";
    fs.writeFileSync(APP_GRADLE, g, "utf8");
    console.log("[patch-android-firebase] Applied google-services plugin in android/app/build.gradle");
  } else {
    console.log("[patch-android-firebase] google-services plugin already applied.");
  }
}

console.log("[patch-android-firebase] Done. Rebuild the APK with `cd android && ./gradlew assembleDebug`.");
