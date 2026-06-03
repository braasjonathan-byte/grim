#!/usr/bin/env node
/**
 * Patch AndroidManifest.xml to declare background-location permissions
 * required for GPS workout recording when the screen is off.
 *
 * Run after `npx cap add android` and after every `npx cap sync android`.
 *   node scripts/patch-android-manifest.cjs
 */
const fs = require("fs");
const path = require("path");

const MANIFEST = path.join(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");

if (!fs.existsSync(MANIFEST)) {
  console.log("[patch-android-manifest] AndroidManifest.xml not found — run `npx cap add android` first.");
  process.exit(0);
}

let xml = fs.readFileSync(MANIFEST, "utf8");

const PERMS = [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_LOCATION",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.BLUETOOTH",
  "android.permission.BLUETOOTH_ADMIN",
  "android.permission.CAMERA",
];

// Features (non-required so the app can still install on devices without them)
const FEATURES = [
  { name: "android.hardware.camera", required: false },
  { name: "android.hardware.camera.autofocus", required: false },
  { name: "android.hardware.bluetooth_le", required: false },
];

let changed = false;
for (const p of PERMS) {
  if (!xml.includes(`android:name="${p}"`)) {
    const tag = `    <uses-permission android:name="${p}" />`;
    xml = xml.replace(/<\/manifest>/, `${tag}\n</manifest>`);
    changed = true;
    console.log(`[patch-android-manifest] Added ${p}`);
  }
}

for (const f of FEATURES) {
  if (!xml.includes(`android:name="${f.name}"`)) {
    const tag = `    <uses-feature android:name="${f.name}" android:required="${f.required}" />`;
    xml = xml.replace(/<\/manifest>/, `${tag}\n</manifest>`);
    changed = true;
    console.log(`[patch-android-manifest] Added feature ${f.name}`);
  }
}

if (changed) {
  fs.writeFileSync(MANIFEST, xml, "utf8");
  console.log("[patch-android-manifest] AndroidManifest.xml updated.");
} else {
  console.log("[patch-android-manifest] All permissions already declared.");
}
