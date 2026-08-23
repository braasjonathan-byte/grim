#!/usr/bin/env node
/**
 * send-intent@7 är byggt för Capacitor 7: dess android/build.gradle hårdkodar
 * compileSdkVersion 35, targetSdkVersion 35, minSdkVersion 23 och AGP 8.7.2.
 *
 * Resten av projektet (Capacitor 8) bygger mot compileSdk 36 med AGP 8.13.0.
 * Det gör att Gradle faller med t.ex.
 *   "Dependency 'androidx.core:core:1.17.0' requires libraries and applications
 *    that depend on it to compile against version 36 or later of the Android APIs"
 * och/eller konflikt mellan två olika AGP-versioner på buildscript-classpathen.
 *
 * Skriptet skriver om pluginens build.gradle så att den ärver rootProject.ext
 * (samma SDK-nivåer som appen) och samma AGP-version. Kör efter `npm install`
 * och före Gradle-buildet. Skriptet är idempotent.
 */
const fs = require("fs");
const path = require("path");

const GRADLE = path.join(__dirname, "..", "node_modules", "send-intent", "android", "build.gradle");
const PROGUARD = path.join(__dirname, "..", "node_modules", "send-intent", "android", "proguard-rules.pro");
const AGP_VERSION = "8.13.0";

if (!fs.existsSync(GRADLE)) {
  console.log("[patch-send-intent] node_modules/send-intent/android/build.gradle saknas — hoppar över.");
  process.exit(0);
}

let gradle = fs.readFileSync(GRADLE, "utf8");
const before = gradle;

// 1. Samma AGP-version som root-projektet
gradle = gradle.replace(
  /classpath ['"]com\.android\.tools\.build:gradle:[^'"]+['"]/g,
  `classpath 'com.android.tools.build:gradle:${AGP_VERSION}'`
);

// 2. Ärv SDK-nivåer från rootProject.ext (36/36/24) istället för hårdkodat 35/35/23
gradle = gradle.replace(
  /compileSdkVersion\s+\d+/,
  "compileSdkVersion project.hasProperty('compileSdkVersion') ? rootProject.ext.compileSdkVersion : 36"
);
gradle = gradle.replace(
  /targetSdkVersion\s+\d+/,
  "targetSdkVersion project.hasProperty('targetSdkVersion') ? rootProject.ext.targetSdkVersion : 36"
);
gradle = gradle.replace(
  /minSdkVersion\s+\d+/,
  "minSdkVersion project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24"
);

if (gradle !== before) {
  fs.writeFileSync(GRADLE, gradle, "utf8");
  console.log("[patch-send-intent] build.gradle uppdaterad (compileSdk/targetSdk/minSdk + AGP).");
} else {
  console.log("[patch-send-intent] build.gradle redan patchad.");
}

// 3. proguard-rules.pro refereras i build.gradle men publiceras inte i npm-paketet
if (!fs.existsSync(PROGUARD)) {
  fs.writeFileSync(PROGUARD, "# genererad av scripts/patch-send-intent-gradle.cjs\n", "utf8");
  console.log("[patch-send-intent] Skapade saknad proguard-rules.pro.");
}
