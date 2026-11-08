import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(import.meta.url);
const { patchNativeSymbols, NDK_VERSION } = require("../../scripts/patch-android-native-symbols.cjs");
const collector = resolve("scripts/collect-android-native-symbols.py");

describe("native release symbol tools", () => {
  it("patches a generated build without signing and is idempotent", () => {
    const original = "android { defaultConfig {} buildTypes { release { minifyEnabled false } } }\n";
    const result = patchNativeSymbols(original);
    expect(patchNativeSymbols(result)).toBe(result);
    expect(result).toContain(`ndkVersion '${NDK_VERSION}'`);
    expect(result).toMatch(/buildTypes\s*\{\s*release\s*\{\s*ndk\s*\{\s*debugSymbolLevel 'FULL'/);
    expect(result).toContain("minifyEnabled false");
  });
  it.each([true, false])("collects embedded metadata, never invents symbols for stripped libraries (metadata=%s)", (metadata) => {
    const dir = mkdtempSync(join(tmpdir(), "grim-symbols-"));
    try {
      const aab = join(dir, "app.aab");
      execFileSync("python3", ["-c", `import zipfile,sys
with zipfile.ZipFile(sys.argv[1], 'w') as z:
 z.writestr('base/lib/arm64-v8a/libexample.so', b'prebuilt')
 if sys.argv[2] == 'true': z.writestr('BUNDLE-METADATA/com.android.tools.build.debugsymbols/arm64-v8a/libexample.so.dbg', b'known-symbol-data')`, aab, String(metadata)]);
      const result = spawnSync("python3", [collector, aab], { cwd: dir, encoding: "utf8" });
      expect(result.status).toBe(0);
      if (metadata) {
        expect(result.stdout).toContain("symbols_path=android/app/build/outputs/native-debug-symbols/release/native-debug-symbols.zip");
        const extracted = execFileSync("python3", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.namelist()); print(z.read(z.namelist()[0]).decode())", join(dir, result.stdout.trim().split("=")[1])], { encoding: "utf8" });
        expect(extracted).toContain("arm64-v8a/libexample.so.dbg");
        expect(extracted).toContain("known-symbol-data");
      } else {
        expect(result.stdout.trim()).toBe("symbols_path=");
        expect(result.stderr).toContain("already-stripped third-party libraries");
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
