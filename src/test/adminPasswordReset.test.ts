import { describe, expect, it, vi } from "vitest";
import { generateTemporaryPassword, resetMemberPassword } from "../../supabase/functions/admin-set-password/reset";

describe("admin password reset", () => {
  it("uses unique strong passwords instead of the rejected shared password", () => {
    const passwords = Array.from({ length: 100 }, generateTemporaryPassword);
    expect(new Set(passwords).size).toBe(100);
    for (const password of passwords) {
      expect(password).toHaveLength(36);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!]/);
      expect(password).not.toBe("Grim123");
    }
  });

  it("requires a password change before replacing the auth password", async () => {
    const events: string[] = [];
    const result = await resetMemberPassword(false, async (value) => {
      events.push(`flag:${value}`);
      return { error: null };
    }, async () => {
      events.push("password");
      return { error: null };
    });
    expect(events).toEqual(["flag:true", "password"]);
    expect(result.password).toHaveLength(36);
  });

  it("does not change credentials if the password-change requirement cannot be saved", async () => {
    const setPassword = vi.fn();
    const result = await resetMemberPassword(false, async () => ({ error: { message: "denied" } }), setPassword);
    expect(setPassword).not.toHaveBeenCalled();
    expect(result.password).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  it.each([false, true])("restores the previous flag (%s) if auth rejects the reset", async (previous) => {
    const setFlag = vi.fn(async () => ({ error: null }));
    const result = await resetMemberPassword(previous, setFlag, async () => ({ error: { message: "weak password" } }));
    expect(setFlag.mock.calls).toEqual([[true], [previous]]);
    expect(result.password).toBeUndefined();
    expect(result.error).toBeDefined();
  });
});