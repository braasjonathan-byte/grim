import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from "node:fs";
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
    for (const file of ["GrimRestService.java", "GrimGpsService.java"]) {
      const source = read(`android/app/src/main/java/se/grim/app/${file}`);
      const calls = [...source.matchAll(/setSmallIcon\(([^)]+)\)/g)];
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((m) => m[1] === "R.drawable.ic_stat_grim")).toBe(true);
    }
  });
});
