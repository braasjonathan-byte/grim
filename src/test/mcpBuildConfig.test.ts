import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveConfig } from "vite";

describe("Owned MCP function build configuration", () => {
  it.each(["development", "production"])(
    "resolves %s configuration without generating over the owned function",
    async (mode) => {
      const functionPath = resolve("supabase/functions/mcp/index.ts");
      const digest = () => createHash("sha256").update(readFileSync(functionPath)).digest("hex");
      const before = digest();
      const config = await resolveConfig({ configFile: resolve("vite.config.ts"), mode }, "build");

      expect(config.plugins.map((plugin) => plugin.name)).not.toContain("@lovable.dev/mcp-js/supabase");
      expect(digest()).toBe(before);
    },
    30_000,
  );
});