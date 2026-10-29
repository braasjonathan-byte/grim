#!/usr/bin/env node
/**
 * Höjer versionskoden automatiskt inför varje bygge.
 *
 * Play Console kräver att varje uppladdning har strikt högre versionCode än
 * den som redan finns där, så koden räknas upp av sig själv i stället för att
 * skrivas för hand:
 *
 *   versionCode = AUTO_BASE + GitHub-runnummer
 *
 * GitHub-runnumret ökar aldrig och återanvänds inte, så koden kan aldrig gå
 * baklänges eller krocka med en tidigare uppladdning. versionName följer med
 * som "1.0.<runnummer>", vilket är samma nummer som bygg-taggen build-<runnummer>.
 *
 * Vill du låsa en specifik kod den här gången, sätt miljövariablerna
 * ANDROID_VERSION_CODE (och valfritt ANDROID_VERSION_NAME) innan bygget.
 */
const fs = require("fs");
const path = require("path");

// Alltid högre än vad som redan finns i Play Console, även vid runnummer 1.
const AUTO_BASE = 10000;
// Högsta kod som redan ligger uppe i Play Console — aldrig lägre än så här.
// 10107 är den senast uppladdade versionen på Play Alfa, så nästa bygge blir minst 10108.
const MIN_VERSION_CODE = 10108;

const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");
if (!fs.existsSync(gradlePath)) {
  console.error("[bump-android-version] android/app/build.gradle saknas.");
  process.exit(1);
}

const gradle = fs.readFileSync(gradlePath, "utf8");

// Tål alla skrivsätt: `versionCode 1`, `versionCode = 1`, `versionCode(1)`,
// enkla/dubbla citattecken och värden från variabler (t.ex. rootProject.ext).
const CODE_RE = /^([ \t]*)versionCode\b[^\n]*$/m;
const NAME_RE = /^([ \t]*)versionName\b[^\n]*$/m;

const readCurrentCode = () => {
  const m = /^\s*versionCode\s*[=(]?\s*"?\s*(\d+)/m.exec(gradle);
  return m ? Number(m[1]) : 0;
};

const currentCode = readCurrentCode();
const runNumber = Number(process.env.GITHUB_RUN_NUMBER) || 0;
const explicitCode = Number(process.env.ANDROID_VERSION_CODE);

let versionCode;
if (Number.isInteger(explicitCode) && explicitCode > 0) {
  versionCode = explicitCode;
} else {
  // Lokalt bygge utan runnummer: lägg bara ett på dencommittede koden.
  const auto = runNumber ? AUTO_BASE + runNumber : currentCode + 1;
  versionCode = Math.max(auto, currentCode + 1, MIN_VERSION_CODE + 1);
}

const explicitName = (process.env.ANDROID_VERSION_NAME || "").trim();
const versionName =
  explicitName || (runNumber ? `1.0.${runNumber}` : `1.0.${versionCode - 1000}`);

if (
  !Number.isInteger(versionCode) ||
  versionCode <= MIN_VERSION_CODE ||
  versionCode <= currentCode ||
  versionCode > 2100000000
) {
  console.error(
    `[bump-android-version] versionCode ${versionCode} kan inte laddas upp till Play Console ` +
      `(nuvarande ${currentCode}, minsta tillåtna ${MIN_VERSION_CODE + 1}).`
  );
  process.exit(1);
}

let next = gradle;
if (CODE_RE.test(next)) {
  next = next.replace(CODE_RE, (_m, indent) => `${indent}versionCode ${versionCode}`);
}
if (NAME_RE.test(next)) {
  next = next.replace(NAME_RE, (_m, indent) => `${indent}versionName "${versionName}"`);
}

// Saknas raderna helt läggs de in överst i defaultConfig.
const missing = [];
if (!CODE_RE.test(next)) missing.push(`versionCode ${versionCode}`);
if (!NAME_RE.test(next)) missing.push(`versionName "${versionName}"`);
if (missing.length) {
  const dc = /defaultConfig\s*\{[^\n]*\n/;
  if (dc.test(next)) {
    next = next.replace(dc, (m) => m + missing.map((l) => `        ${l}\n`).join(""));
  }
}

const okCode = new RegExp(`^\\s*versionCode ${versionCode}\\s*$`, "m").test(next);
const okName = new RegExp(`^\\s*versionName "${versionName.replace(/\./g, "\\.")}"\\s*$`, "m").test(next);
if (!okCode || !okName) {
  console.error("[bump-android-version] kunde inte uppdatera versionCode/versionName.");
  const start = gradle.indexOf("defaultConfig");
  console.error("--- android/app/build.gradle (defaultConfig) ---");
  console.error(start >= 0 ? gradle.slice(start, start + 600) : gradle.slice(0, 1200));
  process.exit(1);
}

if (next === gradle) {
  console.log(`[bump-android-version] versionCode=${versionCode} versionName=${versionName} (redan satt)`);
  process.exit(0);
}

fs.writeFileSync(gradlePath, next);
console.log(
  `[bump-android-version] versionCode=${versionCode} versionName=${versionName}` +
    (runNumber ? ` (run ${runNumber})` : "")
);
