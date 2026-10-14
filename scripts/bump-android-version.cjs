#!/usr/bin/env node
/**
 * Sätter versionskoden som användaren angett.
 * Byt inte versionCode utan att fråga först. Play Console kräver att nästa
 * uppladdning är strikt högre än den som redan finns där.
 */
const fs = require("fs");
const path = require("path");

const versionCode = 1095;
const versionName = "1.0.95";

const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");
if (!fs.existsSync(gradlePath)) {
  console.error("[bump-android-version] android/app/build.gradle saknas.");
  process.exit(1);
}
if (!Number.isInteger(versionCode) || versionCode <= 1094 || versionCode > 2100000000) {
  console.error(`[bump-android-version] versionCode ${versionCode} kan inte laddas upp till Play Console.`);
  process.exit(1);
}

const gradle = fs.readFileSync(gradlePath, "utf8");

// Tål alla skrivsätt: `versionCode 1`, `versionCode = 1`, `versionCode(1)`,
// enkla/dubbla citattecken och värden från variabler (t.ex. rootProject.ext).
const CODE_RE = /^([ \t]*)versionCode\b[^\n]*$/m;
const NAME_RE = /^([ \t]*)versionName\b[^\n]*$/m;

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
console.log(`[bump-android-version] versionCode=${versionCode} versionName=${versionName}`);
