import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const android = resolve(root, "node_modules/capacitor-health/android");
const pkgDir = resolve(android, "src/main/java/com/fit_up/health/capacitor");
const pluginKt = resolve(pkgDir, "HealthPlugin.kt");
const run = () => execFileSync("node", [resolve(root, "scripts/patch-health-background.cjs")], { cwd: root, stdio: "pipe" });
const count = (s: string, n: string) => s.split(n).length - 1;

describe.skipIf(!existsSync(pluginKt))("patch-health-background (GRIM_HC_BACKGROUND)", () => {
  it("är idempotent", () => {
    run();
    const kt = readFileSync(pluginKt, "utf8");
    const gradle = readFileSync(resolve(android, "build.gradle"), "utf8");
    const manifest = readFileSync(resolve(android, "src/main/AndroidManifest.xml"), "utf8");
    run();
    run();
    expect(readFileSync(pluginKt, "utf8")).toBe(kt);
    expect(readFileSync(resolve(android, "build.gradle"), "utf8")).toBe(gradle);
    expect(readFileSync(resolve(android, "src/main/AndroidManifest.xml"), "utf8")).toBe(manifest);
    expect(count(kt, "// GRIM_HC_BACKGROUND_METHODS")).toBe(1);
    expect(count(gradle, "androidx.work:work-runtime-ktx")).toBe(1);
    expect(count(manifest, 'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"')).toBe(1);
  });

  it("installerar worker, metoder och behörighetsmappning", () => {
    const kt = readFileSync(pluginKt, "utf8");
    for (const m of ["readDailySummary", "scheduleBackgroundSync", "cancelBackgroundSync", "getBackgroundSyncState", "enqueuePendingWrites", "runBackgroundSyncNow"]) {
      expect(kt).toContain(`fun ${m}(call: PluginCall)`);
    }
    expect(kt).toContain('Pair(CapHealthPermission.READ_BACKGROUND, "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND")');
    expect(kt).toContain('Pair(CapHealthPermission.READ_RESTING_HEART_RATE, "android.permission.health.READ_RESTING_HEART_RATE")');
    const methods = kt.slice(kt.indexOf("// GRIM_HC_BACKGROUND_METHODS"), kt.indexOf("// GRIM_HC_WRITE_METHODS"));
    expect(methods).not.toContain("Dispatchers.Main");
    const bg = readFileSync(resolve(pkgDir, "GrimHealthBackground.kt"), "utf8");
    expect(bg).toContain("class GrimHealthSyncWorker");
    expect(bg).toContain("FEATURE_READ_HEALTH_DATA_IN_BACKGROUND");
    // Bara mått med beviljad behörighet får efterfrågas.
    expect(bg).toContain("metrics.filter { granted.contains(it.permission) }");
  });

  it("körs sist i postinstall", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.scripts.postinstall).toMatch(/patch-health-write\.cjs && node scripts\/patch-health-background\.cjs && node scripts\/patch-health-settings-v2\.cjs"?$/);
  });
});

describe("Android 13 och 14+", () => {
  const manifest = readFileSync(resolve(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
  it("Android 14+: alias för VIEW_PERMISSION_USAGE skyddat med START_VIEW_PERMISSION_USAGE", () => {
    const alias = manifest.match(/<activity-alias[\s\S]*?<\/activity-alias>/)?.[0] ?? "";
    expect(alias).toContain('android:permission="android.permission.START_VIEW_PERMISSION_USAGE"');
    expect(alias).toContain("android.intent.action.VIEW_PERMISSION_USAGE");
    expect(alias).toContain("android.intent.category.HEALTH_PERMISSIONS");
    expect(alias).toContain('android:exported="true"');
  });
  it("Android 13 och äldre: rationale-filter och paketsynlighet för Health Connect-appen", () => {
    expect(manifest).toContain("androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE");
    expect(manifest).toContain('<package android:name="com.google.android.apps.healthdata" />');
  });
  it("deklarerar alla nya behörigheter i appens manifest", () => {
    for (const p of ["READ_WEIGHT", "READ_RESTING_HEART_RATE", "READ_HEALTH_DATA_IN_BACKGROUND", "WRITE_EXERCISE"]) {
      expect(manifest).toContain(`android.permission.health.${p}`);
    }
  });
  it("rationale-vyn berättar om skrivning och bakgrundsläsning", () => {
    const text = readFileSync(resolve(root, "scripts/android/HealthPrivacyActivity.java"), "utf8");
    expect(text).toContain("sparar Grim dina genomförda pass");
    expect(text).toContain("i bakgrunden");
  });
});
