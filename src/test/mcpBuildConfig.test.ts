import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Owned MCP function build configuration", () => {
  it.each(["development", "production"])(
    "resolves %s configuration without generating over the owned function",
    (mode) => {
      const functionPath = resolve("supabase/functions/mcp/index.ts");
      const digest = () => createHash("sha256").update(readFileSync(functionPath)).digest("hex");
      const before = digest();
      // Vite/esbuild needs Node's native typed arrays, not jsdom's realm.
      const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
        import { resolveConfig } from 'vite';
        const config = await resolveConfig({ configFile: 'vite.config.ts', mode: ${JSON.stringify(mode)} }, 'build');
        console.log(JSON.stringify(config.plugins.map(plugin => plugin.name)));
      `], { cwd: process.cwd(), encoding: "utf8" });
      expect(JSON.parse(output.trim())).not.toContain("@lovable.dev/mcp-js/supabase");
      expect(digest()).toBe(before);
    },
    30_000,
  );
});