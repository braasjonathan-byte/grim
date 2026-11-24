import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const dirs: string[] = [];
const run = (file: string) => execFileSync("node", [resolve("scripts/patch-health-permission-request.cjs")], {
  env: { ...process.env, GRIM_HEALTH_PLUGIN_KT: file }, encoding: "utf8",
});
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "grim-permission-deadline-"));
  dirs.push(dir);
  const file = join(dir, "HealthPlugin.kt");
  writeFileSync(file, `class HealthPlugin {
    // GRIM_LAUNCHER_FIRST_REQUEST
    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        // GRIM_REQUEST_DEADLINE_V2
        oldRequest(call)
    }
    fun unrelatedMethod() { keepMe() }
}
`);
  return file;
};

afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("Health Connect permission request patch", () => {
  it("upgrades installed V2 requests and preserves unrelated methods", () => {
    const file = fixture();
    run(file);
    const kt = readFileSync(file, "utf8");
    expect(kt).toContain("GRIM_REQUEST_DEADLINE_V3");
    expect(kt).not.toContain("GRIM_REQUEST_DEADLINE_V2");
    expect(kt).toContain("fun unrelatedMethod() { keepMe() }");
    expect(run(file)).toContain("redan patchad");
    expect(readFileSync(file, "utf8")).toBe(kt);
  });

  it("extends a dispatched direct launcher beyond 8 seconds without depending on proxy onPause", () => {
    const file = fixture();
    run(file);
    const kt = readFileSync(file, "utf8");
    expect(kt).toContain("val launcherDispatched = java.util.concurrent.atomic.AtomicBoolean(false)");
    expect(kt).toMatch(/launcher\.launch\(healthConnectPermissions\)[\s\S]*?launcherDispatched\.set\(true\)/);
    expect(kt).toMatch(/val sheetShown = launcherDispatched\.get\(\) \|\|\s*\(try \{ GrimHcDiag\.sheetVisibleAt >= requestStartedAt \}/);
    expect(kt).toContain("if (sheetShown && elapsed < 125_000)");
    expect(kt).toMatch(/postDelayed\(this, 125_000 - elapsed\)\s*return/);
    expect(kt.indexOf("postDelayed(this, 125_000 - elapsed)")).toBeLessThan(kt.indexOf('if (sheetShown) "HC_NATIVE_04'));
    expect(kt).toContain("deadlineHandler.postDelayed(deadline, 8000)");
    expect(kt).toContain('else "HC_NATIVE_04: no permission result in 8s"');
    expect(kt).toContain("if (current.pluginCal.callbackId != call.callbackId) return");
    expect(kt).toContain('"route=proxy-fallback"');
  });
});