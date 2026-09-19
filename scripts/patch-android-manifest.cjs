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


// "Dela till Grim": ta emot GPX/TCX/FIT-filer från Garmin Connect, Strava, Zwift m.fl.
if (!xml.includes("SHARE_TARGET_GRIM")) {
  const mimes = [
    "application/gpx+xml",
    "application/vnd.garmin.tcx+xml",
    "application/xml",
    "text/xml",
    "application/octet-stream",
    "application/fit",
    "*/*",
  ];
  const data = mimes.map((m) => `                <data android:mimeType="${m}" />`).join("\n");
  const filter = `
            <!-- SHARE_TARGET_GRIM: träningsfiler delade från andra appar -->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
${data}
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND_MULTIPLE" />
                <category android:name="android.intent.category.DEFAULT" />
${data}
            </intent-filter>`;
  xml = xml.replace(
    /(<intent-filter>\s*<action android:name="android.intent.action.MAIN" \/>[\s\S]*?<\/intent-filter>)/,
    `$1\n${filter}`
  );
  changed = true;
  console.log("[patch-android-manifest] Added SEND/SEND_MULTIPLE share-target intent filters");
}

// Health Connect: behörigheter, rationale-aktivitet och paketsynlighet.
// Utan rationale-aktiviteten vägrar Health Connect visa samtyckesdialogen,
// och behörighetsanropet returnerar "nekad" utan att något fönster öppnas.
const HEALTH_PERMS = [
  "android.permission.health.READ_STEPS",
  "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
];
for (const p of HEALTH_PERMS) {
  if (!xml.includes(`android:name="${p}"`)) {
    xml = xml.replace(/<\/manifest>/, `    <uses-permission android:name="${p}" />\n</manifest>`);
    changed = true;
    console.log(`[patch-android-manifest] Added ${p}`);
  }
}

if (!xml.includes("HEALTH_CONNECT_GRIM")) {
  const block = `        <!-- HEALTH_CONNECT_GRIM: rationale-vy för Health Connect (Android 13 och äldre) -->
        <activity
            android:name="com.fit_up.health.capacitor.PermissionsRationaleActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>
        </activity>
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity="com.fit_up.health.capacitor.PermissionsRationaleActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>
`;
  xml = xml.replace(/(\s*)<\/application>/, `\n${block}$1</application>`);
  changed = true;
  console.log("[patch-android-manifest] Added Health Connect rationale activity + alias");
}

if (!xml.includes("com.google.android.apps.healthdata")) {
  const q = `        <package android:name="com.google.android.apps.healthdata" />
        <intent>
            <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
        </intent>
`;
  if (xml.includes("<queries>")) {
    xml = xml.replace(/<\/queries>/, `${q}    </queries>`);
  } else {
    xml = xml.replace(/<\/manifest>/, `    <queries>\n${q}    </queries>\n</manifest>`);
  }
  changed = true;
  console.log("[patch-android-manifest] Added Health Connect package visibility");
}

if (changed) {


  fs.writeFileSync(MANIFEST, xml, "utf8");
  console.log("[patch-android-manifest] AndroidManifest.xml updated.");
} else {
  console.log("[patch-android-manifest] All permissions already declared.");
}
