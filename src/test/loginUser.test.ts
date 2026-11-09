import { describe, expect, it } from "vitest";
import { loginEmailFor, loginNameFromAuthEmail } from "../../supabase/functions/_shared/tempPassword";
import { loginNameForUser, resolveLoginUserId } from "../../supabase/functions/_shared/loginUser";

describe("login name helpers", () => {
  it("maps login name <-> internal auth e-mail", () => {
    expect(loginEmailFor(" Jonne ")).toBe("jonne@trainapp.local");
    expect(loginNameFromAuthEmail("Jonne@trainapp.local")).toBe("jonne");
    expect(loginNameFromAuthEmail("kalle@example.com")).toBeNull();
    expect(loginNameFromAuthEmail("@trainapp.local")).toBeNull();
    expect(loginNameFromAuthEmail(null)).toBeNull();
  });
});

// Minimal fake of the supabase admin client
function fakeAdmin(opts: { rpc?: { data: unknown; error: unknown }; authEmail?: string | null; profileNick?: string }) {
  const calls: string[] = [];
  const chain = {
    select: () => chain,
    ilike: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: opts.profileNick ? { user_id: "p1", nickname: opts.profileNick } : null }),
  };
  return {
    calls,
    rpc: async (name: string) => {
      calls.push(`rpc:${name}`);
      return opts.rpc ?? { data: null, error: null };
    },
    from: (t: string) => {
      calls.push(`from:${t}`);
      return chain;
    },
    auth: { admin: { getUserById: async () => ({ data: { user: opts.authEmail ? { email: opts.authEmail } : null } }) } },
  };
}

describe("resolveLoginUserId", () => {
  it("resolves via the login RPC, not the editable profile nickname", async () => {
    const admin = fakeAdmin({ rpc: { data: "u-jonne", error: null }, profileNick: "Grim" });
    expect(await resolveLoginUserId(admin, "jonne")).toBe("u-jonne");
    expect(admin.calls).toEqual(["rpc:resolve_login_user"]);
  });
  it("returns null when the RPC finds nothing", async () => {
    expect(await resolveLoginUserId(fakeAdmin({ rpc: { data: null, error: null } }), "nobody")).toBeNull();
  });
  it("falls back to profiles if the RPC is unavailable", async () => {
    const admin = fakeAdmin({ rpc: { data: null, error: { message: "missing" } }, profileNick: "kalle" });
    expect(await resolveLoginUserId(admin, "kalle")).toBe("p1");
  });
});

describe("loginNameForUser", () => {
  it("prefers the login name from the auth e-mail over the profile nickname", async () => {
    expect(await loginNameForUser(fakeAdmin({ authEmail: "jonne@trainapp.local", profileNick: "Grim" }), "u")).toBe("jonne");
  });
  it("falls back to the profile nickname", async () => {
    expect(await loginNameForUser(fakeAdmin({ authEmail: null, profileNick: "Grim" }), "u")).toBe("Grim");
  });
});
