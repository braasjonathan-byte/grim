import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Execute the actual callback with isolated dependencies; no rendering or
// native device is needed to reproduce blocked logging/fallback queries.
const source = readFileSync(new URL("../pages/Index.tsx", import.meta.url), "utf8");
const start = source.indexOf("const loadUserData = useCallback(async (uid: string) => {");
const end = source.indexOf("\n  }, []);", start);
if (start < 0 || end < 0) throw new Error("Profile loading callback not found");
const callback = source.slice(start, end + "\n  }".length)
  .replace("const loadUserData = useCallback(", "");
const js = ts.transpileModule(`const load = ${callback};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function harness(fallback: boolean) {
  const state = { nickname: "", role: "member", honorary: false, password: false, theme: "" };
  const pending = () => new Promise<void>(() => {});
  const status = { nickname: "Testnamn", role: "admin", is_honorary: true, must_change_password: true, theme: "forest" };
  const dependencies = {
    loadUserDataSeqRef: { current: 0 },
    userRef: { current: {} },
    logCrashlyticsMessage: vi.fn(pending),
    recordError: vi.fn(pending),
    supabase: {
      rpc: vi.fn(async () => ({ data: fallback ? null : status, error: fallback ? new Error("RPC unavailable") : null })),
      from: vi.fn((table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: table === "profiles" ? status : { role: "admin" }, error: null,
      }) }) }) })),
    },
    isGrimAliasUser: () => false,
    fallbackNicknameFromUser: () => "fallback",
    setNickname: (value: string) => { state.nickname = value; },
    setIsHonorary: (value: boolean) => { state.honorary = value; },
    setUserRole: (value: string) => { state.role = value; },
    setForceChangePassword: (value: boolean) => { state.password = value; },
    setShowChangePassword: vi.fn(),
    storeThemeId: vi.fn(),
    isThemeLocked: () => false,
    applyTheme: (value: string) => { state.theme = value; },
    console: { warn: vi.fn() },
  };
  const load = new Function(...Object.keys(dependencies), `${js}\nreturn load;`)(...Object.values(dependencies));
  return { state, dependencies, load };
}

describe("profile loading is independent of crash reporting", () => {
  for (const fallback of [false, true]) {
    it(`loads profile, admin access, required password change and theme with hanging diagnostics (${fallback ? "fallback" : "RPC"})`, async () => {
      const { load, state, dependencies } = harness(fallback);
      await load("test-user");
      expect(state).toEqual({ nickname: "Testnamn", role: "admin", honorary: true, password: true, theme: "forest" });
      expect(dependencies.supabase.rpc).toHaveBeenCalledWith("get_my_access_status");
      if (fallback) {
        expect(dependencies.recordError).toHaveBeenCalled();
        expect(dependencies.supabase.from).toHaveBeenCalledWith("profiles");
        expect(dependencies.supabase.from).toHaveBeenCalledWith("user_roles");
      }
    });
  }
});