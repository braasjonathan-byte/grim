#!/usr/bin/env node
/**
 * Install the Grim app icons (legacy + adaptive) into the Android project.
 * Runs after `npx cap add android` so it overwrites the default Capacitor icons.
 *
 *   node scripts/patch-android-icons.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "android-icons-source");
const RES = path.join(ROOT, "android", "app", "src", "main", "res");

if (!fs.existsSync(RES)) {
  console.log("[patch-android-icons] android/app/src/main/res not found — run `npx cap add android` first.");
  process.exit(0);
}

const DENSITIES = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function copy(src, dst) { fs.copyFileSync(src, dst); }

// 1. Legacy ic_launcher.png + ic_launcher_round.png per density
for (const { dir, size } of DENSITIES) {
  const target = path.join(RES, dir);
  ensureDir(target);
  const srcFile = path.join(SRC, `ic_launcher_${size}.png`);
  if (!fs.existsSync(srcFile)) {
    console.warn(`[patch-android-icons] missing ${srcFile}, skipping`);
    continue;
  }
  copy(srcFile, path.join(target, "ic_launcher.png"));
  copy(srcFile, path.join(target, "ic_launcher_round.png"));
  // Adaptive foreground: store the 432x432 foreground in every density (Android picks it).
  copy(path.join(SRC, "ic_launcher_foreground.png"), path.join(target, "ic_launcher_foreground.png"));
  // Remove any legacy webp variants Capacitor placed there
  for (const ext of ["ic_launcher.webp", "ic_launcher_round.webp", "ic_launcher_foreground.webp"]) {
    const p = path.join(target, ext);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

// 2. Adaptive icon XML
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
const anyDpi = path.join(RES, "mipmap-anydpi-v26");
ensureDir(anyDpi);
fs.writeFileSync(path.join(anyDpi, "ic_launcher.xml"), adaptiveXml);
fs.writeFileSync(path.join(anyDpi, "ic_launcher_round.xml"), adaptiveXml);

// 3. White background color for adaptive icon
const valuesDir = path.join(RES, "values");
ensureDir(valuesDir);
fs.writeFileSync(
  path.join(valuesDir, "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFFFF</color>
</resources>
`
);

// 4. Remove any default vector foreground that Capacitor/Studio installed.
const stale = [
  path.join(RES, "drawable", "ic_launcher_background.xml"),
  path.join(RES, "drawable-v24", "ic_launcher_foreground.xml"),
];
for (const p of stale) {
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`[patch-android-icons] removed stale ${path.relative(ROOT, p)}`); }
}

console.log("[patch-android-icons] Grim icons installed in all mipmap densities.");
