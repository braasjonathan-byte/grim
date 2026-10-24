import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const pluginDir = resolve(root, "node_modules/capacitor-health/android/src/main");
const pluginKt = resolve(pluginDir, "java/com/fit_up/health/capacitor/HealthPlugin.kt");
const run = (script: string) => execFileSync("node", [resolve(root, "scripts", script)], { cwd: root, stdio: "pipe" });
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe.skipIf(!existsSync(pluginKt))("patch-health-write (GRIM_HC_WRITE)", () => {
  it("är idempotent över upprepade postinstall-körningar", () => {
    run("patch-health-write.cjs");
    const first = readFileSync(pluginKt, "utf8");
    run("patch-health-write.cjs");
    run("patch-health-write.cjs");
    expect(readFileSync(pluginKt, "utf8")).toBe(first);
    expect(count(first, "// GRIM_HC_WRITE_METHODS")).toBe(1);
    expect(count(first, "// GRIM_HC_WRITE_MAPPING")).toBe(1);
    expect(count(first, "// GRIM_HC_WRITE_ENUM")).toBe(1);
    expect(count(first, "// GRIM_ENSURE_CLIENT ")).toBe(4);
  });

  it("lägger till metoder, behörigheter och writer-klass", () => {
    const kt = readFileSync(pluginKt, "utf8");
    expect(kt).toContain("fun writeWorkout(call: PluginCall)");
    expect(kt).toContain("fun deleteWorkouts(call: PluginCall)");
    expect(kt).toContain('Pair(CapHealthPermission.WRITE_WORKOUTS, "android.permission.health.WRITE_EXERCISE")');
    // Skrivning sker aldrig på UI-tråden.
    const methods = kt.slice(kt.indexOf("// GRIM_HC_WRITE_METHODS"), kt.indexOf("fun queryWorkouts("));
    expect(methods).not.toContain("Dispatchers.Main");
    expect(count(methods, "if (!ensureClient())")).toBe(2);
    const manifest = readFileSync(resolve(pluginDir, "AndroidManifest.xml"), "utf8");
    for (const p of ["WRITE_EXERCISE", "WRITE_ACTIVE_CALORIES_BURNED", "WRITE_DISTANCE"]) {
      expect(count(manifest, `android.permission.health.${p}"`)).toBe(1);
    }
    expect(readFileSync(resolve(pluginDir, "java/com/fit_up/health/capacitor/GrimHealthWriter.kt"), "utf8")).toContain(
      "Metadata.manualEntry(",
    );
  });

  it("appens manifest deklarerar skrivbehörigheterna", () => {
    const app = readFileSync(resolve(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
    for (const p of ["WRITE_EXERCISE", "WRITE_ACTIVE_CALORIES_BURNED", "WRITE_DISTANCE"]) {
      expect(app).toContain(`android.permission.health.${p}`);
    }
  });

  it("körs i postinstall efter övriga hälsopatchar", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.scripts.postinstall).toMatch(/patch-health-proxy-race\.cjs && node scripts\/patch-health-write\.cjs/);
  });
});
