#!/usr/bin/env node
/**
 * Capacitor-hook: körs automatiskt av `npx cap sync` / `npx cap update`
 * (npm-scriptet "capacitor:sync:after"). Lägger på exakt samma Android-patchar
 * som CI (release-aab.yml) så att en lokal Android Studio-build får
 * Health Connect-manifestet (rationale + Android 14 activity-alias + queries),
 * MainActivity-skyddet och Firebase-konfigurationen. Utan detta fick lokala
 * byggen ett manifest där Health Connect inte känner igen Grim: behörighets-
 * rutan stängs direkt och MANAGE_HEALTH_PERMISSIONS studsar.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const platform = process.env.CAPACITOR_PLATFORM_NAME;
const root = path.join(__dirname, "..");
if (platform && platform !== "android") process.exit(0);
if (!fs.existsSync(path.join(root, "android", "app", "src", "main", "AndroidManifest.xml"))) {
  console.log("[cap-sync-after] android/ saknas – inget att patcha.");
  process.exit(0);
}
const steps = [
  "patch-android-firebase.cjs",
  "patch-android-manifest.cjs",
  "patch-android-system-insets.cjs",
  "verify-android-plugins.cjs",
];
for (const step of steps) {
  execFileSync(process.execPath, [path.join(__dirname, step)], { stdio: "inherit", cwd: root });
}
// Tvinga om-kompilering av pluginet så ingen gammal HealthPlugin-klass återanvänds.
fs.rmSync(path.join(root, "node_modules", "capacitor-health", "android", "build"), { recursive: true, force: true });
console.log("[cap-sync-after] Android-patchar klara. Bygg AAB i Android Studio (Build > Clean Project först).");
