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

// Lock MainActivity to portrait orientation
if (!/android:screenOrientation="portrait"/.test(xml)) {
  xml = xml.replace(
    /(<activity[^>]*android:name=".MainActivity")/,
    `$1\n            android:screenOrientation="portrait"`
  );
  console.log("[patch-android-manifest] Locked MainActivity to portrait orientation");
}

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

const MLKIT_BARCODE_META = 'android:name="com.google.mlkit.vision.DEPENDENCIES"';
if (!xml.includes(MLKIT_BARCODE_META)) {
  xml = xml.replace(
    /<application([^>]*)>/,
    `<application$1>\n        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />`
  );
  changed = true;
  console.log("[patch-android-manifest] Added ML Kit barcode scanner dependency metadata");
}

const FCM_CHANNEL_META = 'android:name="com.google.firebase.messaging.default_notification_channel_id"';
if (!xml.includes(FCM_CHANNEL_META)) {
  xml = xml.replace(
    /<application([^>]*)>/,
    `<application$1>\n        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="grim_default" />`
  );
  changed = true;
  console.log("[patch-android-manifest] Added FCM default notification channel meta-data");
}

// Android 11+ package visibility: required so the TextToSpeech plugin can
// bind to the installed TTS engine. Without this <queries> block,
// tts.speak() silently fails on real devices (no voice output).
if (!xml.includes("android.intent.action.TTS_SERVICE")) {
  const queriesBlock = `    <queries>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>
`;
  xml = xml.replace(/<\/manifest>/, `${queriesBlock}</manifest>`);
  changed = true;
  console.log("[patch-android-manifest] Added TTS_SERVICE queries block (Android 11+ package visibility)");
}


if (changed) {
  fs.writeFileSync(MANIFEST, xml, "utf8");
  console.log("[patch-android-manifest] AndroidManifest.xml updated.");
} else {
  console.log("[patch-android-manifest] All permissions already declared.");
}
