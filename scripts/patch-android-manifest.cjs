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
  "android.permission.health.READ_TOTAL_CALORIES_BURNED",
  "android.permission.health.READ_DISTANCE",
  "android.permission.health.READ_EXERCISE",
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_SLEEP",
];


for (const p of HEALTH_PERMS) {
  if (!xml.includes(`android:name="${p}"`)) {
    xml = xml.replace(/<\/manifest>/, `    <uses-permission android:name="${p}" />\n</manifest>`);
    changed = true;
    console.log(`[patch-android-manifest] Added ${p}`);
  }
}

// Pluginets egen rationale-vy laddar policysidan i en WebView med JavaScript
// avstängt – Grims sida är en React-app och blir då helt blank. Vi pekar
// därför på vår egen vy som öppnar sidan i webbläsaren.
const RATIONALE_ACTIVITY = "se.grim.app.HealthPrivacyActivity";
if (xml.includes("com.fit_up.health.capacitor.PermissionsRationaleActivity")) {
  xml = xml.replace(
    /com\.fit_up\.health\.capacitor\.PermissionsRationaleActivity/g,
    RATIONALE_ACTIVITY
  );
  changed = true;
  console.log("[patch-android-manifest] Rationale activity pointed at Grim's own view");
}

const RATIONALE_BLOCK = `        <!-- HEALTH_CONNECT_GRIM: rationale-vy för Health Connect (Android 13 och äldre) -->
        <activity
            android:name="${RATIONALE_ACTIVITY}"
            android:exported="true">
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity>
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity="${RATIONALE_ACTIVITY}"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>
`;

if (!xml.includes("HEALTH_CONNECT_GRIM")) {
  xml = xml.replace(/(\s*)<\/application>/, `\n${RATIONALE_BLOCK}$1</application>`);
  changed = true;
  console.log("[patch-android-manifest] Added Health Connect rationale activity + alias");
} else {
  // Health Connect visar policylänken som klickbar bara när aktiviteten även
  // matchar kategorin HEALTH_PERMISSIONS. Äldre manifest saknar den.
  const existing = xml.match(
    /\s*<!-- HEALTH_CONNECT_GRIM[\s\S]*?<\/activity-alias>\n?/
  );
  if (existing && !/ACTION_SHOW_PERMISSIONS_RATIONALE"[\s\S]{0,400}?HEALTH_PERMISSIONS/.test(existing[0])) {
    xml = xml.replace(existing[0], `\n${RATIONALE_BLOCK}`);
    changed = true;
    console.log("[patch-android-manifest] Rationale intent-filter: HEALTH_PERMISSIONS category added");
  }
}


const HC_QUERIES_V2 = `        <!-- HC_QUERIES_V2: Health Connect paketsynlighet (Android 11+) -->
        <package android:name="com.google.android.apps.healthdata" />
        <package android:name="com.google.android.healthconnect.controller" />
        <package android:name="com.android.healthconnect.controller" />
        <intent>
            <action android:name="androidx.health.ACTION_REQUEST_PERMISSIONS" />
        </intent>
        <intent>
            <action android:name="android.health.connect.action.REQUEST_HEALTH_PERMISSIONS" />
        </intent>
        <intent>
            <action android:name="androidx.health.ACTION_HEALTH_CONNECT_SETTINGS" />
        </intent>
        <intent>
            <action android:name="android.health.connect.action.HEALTH_HOME_SETTINGS" />
        </intent>
        <intent>
            <action android:name="android.health.connect.action.MANAGE_HEALTH_PERMISSIONS" />
        </intent>
`;

if (!xml.includes("HC_QUERIES_V2")) {
  xml = xml.replace(/\s*<package android:name="com.google.android.apps.healthdata" \/>\n/, "\n");
  if (xml.includes("<queries>")) {
    xml = xml.replace(/<\/queries>/, `${HC_QUERIES_V2}    </queries>`);
  } else {
    xml = xml.replace(/<\/manifest>/, `    <queries>\n${HC_QUERIES_V2}    </queries>\n</manifest>`);
  }
  changed = true;
  console.log("[patch-android-manifest] Added Health Connect package visibility (HC_QUERIES_V2)");
}

if (changed) {


  fs.writeFileSync(MANIFEST, xml, "utf8");
  console.log("[patch-android-manifest] AndroidManifest.xml updated.");
} else {
  console.log("[patch-android-manifest] All permissions already declared.");
}

// Health Connects samtyckesvy laddar den här adressen. Saknas strängen
// kraschar rationale-vyn och Grim syns inte som valbar app.
const STRINGS = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "res",
  "values",
  "strings.xml"
);
const PRIVACY_URL = "https://grim.lovable.app/privacy";
if (fs.existsSync(STRINGS)) {
  let strings = fs.readFileSync(STRINGS, "utf8");
  if (!strings.includes('name="privacy_policy_url"')) {
    strings = strings.replace(
      /<\/resources>/,
      `    <string name="privacy_policy_url">${PRIVACY_URL}</string>\n</resources>`
    );
    fs.writeFileSync(STRINGS, strings, "utf8");
    console.log("[patch-android-manifest] Added privacy_policy_url string");
  } else if (!strings.includes(`>${PRIVACY_URL}<`)) {
    strings = strings.replace(
      /<string name="privacy_policy_url">[^<]*<\/string>/,
      `<string name="privacy_policy_url">${PRIVACY_URL}</string>`
    );
    fs.writeFileSync(STRINGS, strings, "utf8");
    console.log("[patch-android-manifest] Corrected privacy_policy_url string");
  }
}

// Rationale-vyn ska finnas i varje bygge, även efter `npx cap add android`
// eller en ren CI-utcheckning där android/ genererats om.
const ACTIVITY_TEMPLATE = path.join(__dirname, "android", "HealthPrivacyActivity.java");
const ACTIVITY_TARGET = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "java",
  "se",
  "grim",
  "app",
  "HealthPrivacyActivity.java"
);
if (fs.existsSync(ACTIVITY_TEMPLATE)) {
  const template = fs.readFileSync(ACTIVITY_TEMPLATE, "utf8");
  const current = fs.existsSync(ACTIVITY_TARGET)
    ? fs.readFileSync(ACTIVITY_TARGET, "utf8")
    : null;
  if (current !== template) {
    fs.mkdirSync(path.dirname(ACTIVITY_TARGET), { recursive: true });
    fs.writeFileSync(ACTIVITY_TARGET, template, "utf8");
    console.log("[patch-android-manifest] HealthPrivacyActivity.java installed from template");
  } else {
    console.log("[patch-android-manifest] HealthPrivacyActivity.java already up to date");
  }
} else {
  console.error("[patch-android-manifest] Missing scripts/android/HealthPrivacyActivity.java");
  process.exit(1);
}

