import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const read = (p: string) => readFileSync(p, "utf8");
describe("Android release assets and symbols", () => {
  it("enables FULL native symbols outside the signing-secret conditional and pins the installed NDK", () => {
    const workflow = read(".github/workflows/release-aab.yml");
    expect(workflow).toContain("patch-android-native-symbols.cjs");
    expect(workflow).toContain('sdkmanager "ndk;$NDK_VERSION"');
    expect(workflow).toContain("name: native-debug-symbols");
    const script = read("scripts/patch-android-native-symbols.cjs");
    expect(script).toContain("debugSymbolLevel 'FULL'");
    expect(script).toContain("27.0.12077973");
  });
  it("declares screen.portrait as not required, also after the manifest patch re-adds it", () => {
    const re = /<uses-feature\b[^>]*android:name="android\.hardware\.screen\.portrait"[^>]*android:required="false"/;
    expect(read("android/app/src/main/AndroidManifest.xml")).toMatch(re);
    const dir = mkdtempSync(join(tmpdir(), "grim-portrait-"));
    try {
      mkdirSync(join(dir, "scripts"));
      cpSync("scripts/patch-android-manifest.cjs", join(dir, "scripts/patch-android-manifest.cjs"));
      cpSync("scripts/android", join(dir, "scripts/android"), { recursive: true });
      cpSync("android/app/src/main", join(dir, "android/app/src/main"), { recursive: true });
      const mp = join(dir, "android/app/src/main/AndroidManifest.xml");
      writeFileSync(mp, read(mp).replace(/\s*<uses-feature\b[^>]*screen\.portrait[^>]*\/>/, ""));
      expect(read(mp)).not.toContain("screen.portrait");
      execFileSync(process.execPath, [join(dir, "scripts/patch-android-manifest.cjs")], { stdio: "pipe" });
      expect(read(mp)).toMatch(re);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("has no location permissions or GPS service, also after patching an old manifest", () => {
    const LOCATION = ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_BACKGROUND_LOCATION", "FOREGROUND_SERVICE_LOCATION"];
    const check = (xml: string) => {
      for (const p of LOCATION) {
        const tags = xml.match(new RegExp(`<uses-permission\\b[^>]*android:name="android\\.permission\\.${p}"[^>]*/>`, "g")) ?? [];
        expect(tags).toHaveLength(1);
        expect(tags[0]).toContain('tools:node="remove"');
      }
      expect(xml).not.toContain("GrimGpsService");
      expect(xml).not.toContain('foregroundServiceType="location"');
      expect(xml).toContain('android:name="android.permission.health.READ_EXERCISE_ROUTES"');
      expect(xml).toContain('android:name="android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"');
      // Pulsbandet (BLE) får inte kräva plats på Android 12+.
      expect(xml).toMatch(/<uses-permission\b[^>]*android:name="android\.permission\.BLUETOOTH_SCAN"[^>]*android:usesPermissionFlags="neverForLocation"/);
    };
    check(read("android/app/src/main/AndroidManifest.xml"));
    const dir = mkdtempSync(join(tmpdir(), "grim-noloc-"));
    try {
      mkdirSync(join(dir, "scripts"));
      cpSync("scripts/patch-android-manifest.cjs", join(dir, "scripts/patch-android-manifest.cjs"));
      cpSync("scripts/android", join(dir, "scripts/android"), { recursive: true });
      cpSync("android/app/src/main", join(dir, "android/app/src/main"), { recursive: true });
      const mp = join(dir, "android/app/src/main/AndroidManifest.xml");
      const old = read(mp)
        .replace(/\s*<uses-permission\b[^>]*tools:node="remove"[^>]*\/>/g, "")
        .replace("</application>", '<service android:name="se.grim.app.GrimGpsService" android:exported="false" android:foregroundServiceType="location" />\n</application>')
        .replace("</manifest>", LOCATION.map((p) => `<uses-permission android:name="android.permission.${p}" />`).join("\n") + "\n</manifest>");
      writeFileSync(mp, old);
      execFileSync(process.execPath, [join(dir, "scripts/patch-android-manifest.cjs")], { stdio: "pipe" });
      const once = read(mp);
      check(once);
      execFileSync(process.execPath, [join(dir, "scripts/patch-android-manifest.cjs")], { stdio: "pipe" });
      expect(read(mp)).toBe(once);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("installs a white transparent vector and patches manifest metadata idempotently", () => {
    const dir = mkdtempSync(join(tmpdir(), "grim-notification-"));
    try {
      mkdirSync(join(dir, "scripts"));
      cpSync("scripts/patch-android-icons.cjs", join(dir, "scripts/patch-android-icons.cjs"));
      cpSync("scripts/patch-android-manifest.cjs", join(dir, "scripts/patch-android-manifest.cjs"));
      cpSync("scripts/android", join(dir, "scripts/android"), { recursive: true });
      cpSync("android-icons-source", join(dir, "android-icons-source"), { recursive: true });
      cpSync("android/app/src/main", join(dir, "android/app/src/main"), { recursive: true });
      const patch = () => {
        execFileSync(process.execPath, [join(dir, "scripts/patch-android-icons.cjs")], { stdio: "pipe" });
        execFileSync(process.execPath, [join(dir, "scripts/patch-android-manifest.cjs")], { stdio: "pipe" });
      };
      patch();
      const xml = read(join(dir, "android/app/src/main/res/drawable/ic_stat_grim.xml"));
      expect(xml).toContain('android:fillColor="#FFFFFFFF"');
      expect(xml).not.toContain("<background");
      const manifest = read(join(dir, "android/app/src/main/AndroidManifest.xml"));
      expect(manifest).toContain('android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_grim"');
      expect(manifest).toContain('android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/grim_notification_color"');
      expect(read(join(dir, "android/app/src/main/res/values/grim_notification_color.xml"))).toContain('<item type="drawable" name="ic_notification">@drawable/ic_stat_grim</item>');
      patch();
      expect(read(join(dir, "android/app/src/main/AndroidManifest.xml"))).toBe(manifest);
      expect(read(join(dir, "android/app/src/main/res/drawable/ic_stat_grim.xml"))).toBe(xml);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("uses the same small icon for local, push and every foreground-service notification", () => {
    const config = read("capacitor.config.ts");
    expect(config).toContain("'@capacitor/local-notifications'");
    expect(config).toContain("smallIcon: 'ic_stat_grim'");
    expect(read("src/lib/workoutOngoing.ts").match(/smallIcon: "ic_stat_grim"/g)).toHaveLength(2);
    for (const file of ["GrimRestService.java"]) {
      const source = read(`android/app/src/main/java/se/grim/app/${file}`);
      const calls = [...source.matchAll(/setSmallIcon\(([^)]+)\)/g)];
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((m) => m[1] === "R.drawable.ic_stat_grim")).toBe(true);
    }
  });
});
