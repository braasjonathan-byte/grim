import { describe, expect, it, vi } from "vitest";
import { credsFromRecord, loadGmailCreds } from "../../supabase/functions/_shared/gmailConfig";

const fullEnv: Record<string, string> = {
  GMAIL_CLIENT_ID: "env-id",
  GMAIL_CLIENT_SECRET: "env-secret",
  GMAIL_REFRESH_TOKEN: "env-refresh",
};

function fakeAdmin(rows: { key: string; value: string }[] | null, error: unknown = null) {
  const inFn = vi.fn().mockResolvedValue({ data: rows, error });
  const select = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ select }));
  return { from, select, inFn };
}

describe("gmailConfig", () => {
  it("credsFromRecord requires all three", () => {
    expect(credsFromRecord({ GMAIL_CLIENT_ID: "a", GMAIL_CLIENT_SECRET: "b" })).toBeNull();
    expect(credsFromRecord({ GMAIL_CLIENT_ID: " a ", GMAIL_CLIENT_SECRET: "b", GMAIL_REFRESH_TOKEN: "c" })).toEqual({
      clientId: "a",
      clientSecret: "b",
      refreshToken: "c",
    });
  });

  it("prefers env and skips the DB", async () => {
    const admin = fakeAdmin([]);
    const creds = await loadGmailCreds((k) => fullEnv[k], admin);
    expect(creds?.clientId).toBe("env-id");
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("falls back to app_private_config when env incomplete", async () => {
    const admin = fakeAdmin([
      { key: "GMAIL_CLIENT_ID", value: "db-id" },
      { key: "GMAIL_CLIENT_SECRET", value: "db-secret" },
      { key: "GMAIL_REFRESH_TOKEN", value: "db-refresh" },
    ]);
    const creds = await loadGmailCreds((k) => (k === "GMAIL_CLIENT_ID" ? "env-id" : undefined), admin);
    expect(admin.from).toHaveBeenCalledWith("app_private_config");
    expect(creds).toEqual({ clientId: "db-id", clientSecret: "db-secret", refreshToken: "db-refresh" });
  });

  it("returns null when DB missing values or errors", async () => {
    expect(await loadGmailCreds(() => undefined, fakeAdmin([{ key: "GMAIL_CLIENT_ID", value: "x" }]))).toBeNull();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await loadGmailCreds(() => undefined, fakeAdmin(null, { message: "boom" }))).toBeNull();
    err.mockRestore();
  });
});
