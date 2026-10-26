import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = process.cwd();
const pluginKt = resolve(root, "node_modules/capacitor-health/android/src/main/java/com/fit_up/health/capacitor/HealthPlugin.kt");
const run = (file?: string) =>
  execFileSync("node", [resolve(root, "scripts/patch-health-settings-v2.cjs")], {
    cwd: root,
    stdio: "pipe",
    env: file ? { ...process.env, GRIM_HEALTH_PLUGIN_KT: file } : process.env,
  }).toString();
const count = (s: string, n: string) => s.split(n).length - 1;

describe.skipIf(!existsSync(pluginKt))("patch-health-settings-v2 (GRIM_SETTINGS_V2)", () => {
  it("är idempotent", () => {
    run();
    const kt = readFileSync(pluginKt, "utf8");
    expect(run()).toContain("redan patchad");
    expect(readFileSync(pluginKt, "utf8")).toBe(kt);
    expect(count(kt, "// GRIM_SETTINGS_V2")).toBe(1);
    expect(count(kt, "fun openHealthConnectSettings(call: PluginCall)")).toBe(1);
  });

  it("väljer vägar per Android-version, upptäcker studs och har diagnostik", () => {
    const kt = readFileSync(pluginKt, "utf8");
    expect(kt).toContain('"android.health.connect.action.MANAGE_HEALTH_PERMISSIONS"');
    expect(kt).toContain('"androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS"');
    expect(kt).toContain("activity.hasWindowFocus()");
    expect(kt).toContain("SETTINGS_BOUNCED");
    expect(kt).toContain("fun grimSettingsDiagnostics(call: PluginCall)");
    // DEFAULT_PROVIDER_PACKAGE_NAME är internal i connect-client 1.1.0 – får inte användas.
    expect(kt).not.toContain("DEFAULT_PROVIDER_PACKAGE_NAME");
  });

  it("uppgraderar en V1-patchad fil på plats", () => {
    // Arbetar på en kopia – andra testfiler läser HealthPlugin.kt parallellt.
    const original = readFileSync(pluginKt, "utf8");
    const start = original.indexOf("    // GRIM_SETTINGS_CANDIDATES");
    const end = original.indexOf("    // Open the Google Play Store to install Health Connect");
    const copy = resolve(mkdtempSync(resolve(tmpdir(), "grim-hc-")), "HealthPlugin.kt");
    writeFileSync(copy, original.slice(0, start) + "    // GRIM_SETTINGS_CANDIDATES\n    // v1 placeholder\n\n" + original.slice(end), "utf8");
    expect(run(copy)).toContain("installerad");
    expect(readFileSync(copy, "utf8")).toBe(original);
  });

  it("körs sist i postinstall", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.scripts.postinstall).toMatch(/patch-health-background\.cjs && node scripts\/patch-health-settings-v2\.cjs"?$/);
  });
});
