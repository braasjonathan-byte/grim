#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const nodeModules = path.join(root, "node_modules");
const expected = {
  agp: "8.13.0",
  compileSdk: 36,
  targetSdk: 36,
  minSdk: 24,
};

const failures = [];
let checked = 0;

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.name !== "build.gradle" && entry.name !== "build.gradle.kts") continue;
    if (!fullPath.includes(`${path.sep}android${path.sep}`)) continue;

    checked += 1;
    const source = fs.readFileSync(fullPath, "utf8");
    const relative = path.relative(root, fullPath);
    const checks = [
      [/com\.android\.tools\.build:gradle:([0-9.]+)/g, expected.agp, "AGP"],
      [/compileSdk(?:Version)?\s*[=( ]\s*(\d+)/g, String(expected.compileSdk), "compileSdk"],
      [/targetSdk(?:Version)?\s*[=( ]\s*(\d+)/g, String(expected.targetSdk), "targetSdk"],
    ];

    for (const [pattern, wanted, label] of checks) {
      for (const match of source.matchAll(pattern)) {
        if (match[1] !== wanted) {
          failures.push(`${relative}: ${label} ${match[1]} (expected ${wanted})`);
        }
      }
    }

    for (const match of source.matchAll(/minSdk(?:Version)?\s*[=( ]\s*(\d+)/g)) {
      if (Number(match[1]) < expected.minSdk) {
        failures.push(`${relative}: minSdk ${match[1]} is below ${expected.minSdk}`);
      }
    }
  }
}

walk(nodeModules);

if (checked === 0) {
  console.error("[verify-android-plugins] No Android plugin Gradle files found.");
  process.exit(1);
}

if (failures.length > 0) {
  console.error("[verify-android-plugins] Incompatible native plugin configuration:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(`[verify-android-plugins] Checked ${checked} Gradle files; SDK/AGP versions are compatible.`);