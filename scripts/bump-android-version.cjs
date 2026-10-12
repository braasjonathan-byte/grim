#!/usr/bin/env node
/**
 * Sätter ett nytt versionCode inför varje bygge.
 * Play Console avvisar en uppladdning om koden inte är strikt högre än
 * den som redan ligger där. Unix-tid i sekunder ligger långt över de
 * gamla 1000+run-koderna och ändras även när samma workflow körs om.
 */
const fs = require("fs");
const path = require("path");

const gradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");
if (!fs.existsSync(gradlePath)) {
  console.error("[bump-android-version] android/app/build.gradle saknas.");
  process.exit(1);
}

const versionCode = Math.floor(Date.now() / 1000);
if (versionCode <= 1091 || versionCode > 2100000000) {
  console.error(`[bump-android-version] versionCode ${versionCode} kan inte laddas upp till Play Console.`);
  process.exit(1);
}

const versionName = `1.0.${versionCode}`;
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
