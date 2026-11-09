import { describe, expect, it, vi } from "vitest";
import {
  completeForcedPasswordChange,
  requestPasswordReset,
  signInWithPasswordOrTemp,
  validateNewPassword,
} from "@/lib/passwordReset";

function mockClient(opts: {
  signInError?: unknown;
  invoke?: (name: string, args: unknown) => { data?: unknown; error?: unknown };
  setSessionError?: unknown;
  updateError?: unknown;
  rpcError?: unknown;
} = {}) {
  const calls: Record<string, unknown[]> = { invoke: [], setSession: [], rpc: [], update: [], profileUpdate: [] };
  const client = {
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: opts.signInError ?? null })),
      setSession: vi.fn(async (s: unknown) => { calls.setSession.push(s); return { error: opts.setSessionError ?? null }; }),
      updateUser: vi.fn(async (u: unknown) => { calls.update.push(u); return { error: opts.updateError ?? null }; }),
      getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })),
    },
    functions: {
      invoke: vi.fn(async (name: string, args: unknown) => {
        calls.invoke.push([name, args]);
        return opts.invoke ? opts.invoke(name, args) : { data: { success: true }, error: null };
      }),
    },
    rpc: vi.fn(async (name: string) => { calls.rpc.push(name); return { error: opts.rpcError ?? null }; }),
    from: vi.fn(() => ({
      update: (v: unknown) => ({ eq: async () => { calls.profileUpdate.push(v); return { error: null }; } }),
    })),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

const TEMP = "K7mP-x9Qa-R3tW";

describe("signInWithPasswordOrTemp", () => {
  it("uses the normal password when it works (old password keeps working)", async () => {
    const { client, calls } = mockClient();
    const res = await signInWithPasswordOrTemp(client, { email: "k@trainapp.local", nickname: "k", password: "gammaltlosen" });
    expect(res).toEqual({ ok: true, viaTempPassword: false });
    expect(calls.invoke).toHaveLength(0);
  });

  it("does not call the temp function for non-temp passwords", async () => {
    const { client, calls } = mockClient({ signInError: { message: "Invalid" } });
    const res = await signInWithPasswordOrTemp(client, { email: "k@trainapp.local", nickname: "k", password: "fellosenord" });
    expect(res.ok).toBe(false);
    expect(calls.invoke).toHaveLength(0);
  });

  it("falls back to temp-password-login and adopts the session", async () => {
    const { client, calls } = mockClient({
      signInError: { message: "Invalid" },
      invoke: () => ({ data: { success: true, session: { access_token: "a", refresh_token: "r" } }, error: null }),
    });
    const res = await signInWithPasswordOrTemp(client, { email: "k@trainapp.local", nickname: " Kalle ", password: TEMP });
    expect(res).toEqual({ ok: true, viaTempPassword: true });
    expect(calls.invoke[0]).toEqual(["temp-password-login", { body: { nickname: "Kalle", password: TEMP } }]);
    expect(calls.setSession[0]).toEqual({ access_token: "a", refresh_token: "r" });
  });

  it("reports wrong credentials and rate limiting", async () => {
    const wrong = mockClient({ signInError: {}, invoke: () => ({ data: null, error: { context: { status: 401 } } }) });
    expect(await signInWithPasswordOrTemp(wrong.client, { email: "e", nickname: "k", password: TEMP }))
      .toEqual({ ok: false, error: "Fel användarnamn eller lösenord" });
    const limited = mockClient({ signInError: {}, invoke: () => ({ data: null, error: { context: { status: 429 } } }) });
    const res = await signInWithPasswordOrTemp(limited.client, { email: "e", nickname: "k", password: TEMP });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toContain("För många försök");
  });
});

describe("requestPasswordReset", () => {
  it("calls forgot-password with the identifier", async () => {
    const { client, calls } = mockClient();
    expect(await requestPasswordReset(client, "  kalle@example.com ")).toEqual({ ok: true });
    expect(calls.invoke[0]).toEqual(["forgot-password", { body: { identifier: "kalle@example.com" } }]);
  });
  it("rejects empty input without calling the server", async () => {
    const { client, calls } = mockClient();
    expect(await requestPasswordReset(client, " ")).toEqual({ ok: false });
    expect(calls.invoke).toHaveLength(0);
  });
});

describe("forced password change", () => {
  it("validates new password", () => {
    expect(validateNewPassword("short", "short")).toMatch(/minst 8/);
    expect(validateNewPassword("abcdefgh", "abcdefgx")).toMatch(/matchar inte/);
    expect(validateNewPassword(TEMP, TEMP)).toMatch(/tillfälliga/);
    expect(validateNewPassword("nyttlosen1", "nyttlosen1")).toBeNull();
  });
  it("updates password then clears flag + temp rows via rpc", async () => {
    const { client, calls } = mockClient();
    expect(await completeForcedPasswordChange(client, "nyttlosen1")).toEqual({ ok: true });
    expect(calls.update[0]).toEqual({ password: "nyttlosen1" });
    expect(calls.rpc).toEqual(["complete_forced_password_change"]);
  });
  it("does not clear the flag if updateUser fails", async () => {
    const { client, calls } = mockClient({ updateError: { message: "weak" } });
    expect(await completeForcedPasswordChange(client, "nyttlosen1")).toEqual({ ok: false, error: "weak" });
    expect(calls.rpc).toHaveLength(0);
  });
  it("falls back to clearing the profile flag if rpc fails", async () => {
    const { client, calls } = mockClient({ rpcError: { message: "missing" } });
    await completeForcedPasswordChange(client, "nyttlosen1");
    expect(calls.profileUpdate[0]).toEqual({ must_change_password: false });
  });
});
