#!/usr/bin/env node
/**
 * Sätter versionskoden som användaren angett.
 * Byt inte versionCode utan att fråga först. Play Console kräver att nästa
 * uppladdning är strikt högre än den som redan finns där.
 */
const fs = require("fs");
const path = require("path");

const versionCode = 1093;
const versionName = "1.0.93";

const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");
if (!fs.existsSync(gradlePath)) {
  console.error("[bump-android-version] android/app/build.gradle saknas.");
  process.exit(1);
}
if (!Number.isInteger(versionCode) || versionCode <= 1092 || versionCode > 2100000000) {
  console.error(`[bump-android-version] versionCode ${versionCode} kan inte laddas upp till Play Console.`);
  process.exit(1);
}

const gradle = fs.readFileSync(gradlePath, "utf8");
const next = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

if (
  next === gradle ||
  !next.includes(`versionCode ${versionCode}`) ||
  !next.includes(`versionName "${versionName}"`)
) {
  console.error("[bump-android-version] kunde inte uppdatera versionCode/versionName.");
  process.exit(1);
}

fs.writeFileSync(gradlePath, next);
console.log(`[bump-android-version] versionCode=${versionCode} versionName=${versionName}`);
