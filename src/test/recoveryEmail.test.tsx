import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";

// ---- supabase mock -------------------------------------------------------
const state: { row: { email: string } | null; selectError: unknown; upsertError: unknown } = {
  row: null,
  selectError: null,
  upsertError: null,
};
const upsert = vi.fn(async () => ({ error: state.upsertError }));
const maybeSingle = vi.fn(async () => ({ data: state.row, error: state.selectError }));
const signOut = vi.fn(async () => ({ error: null }));
const signUp = vi.fn(async () => ({
  data: { user: { id: "new-user" }, session: { user: { id: "new-user" } } },
  error: null,
}));
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle }) }),
  upsert: (...a: unknown[]) => upsert(...(a as [])),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: unknown[]) => from(...(a as [])),
    auth: {
      signOut: (...a: unknown[]) => signOut(...(a as [])),
      signUp: (...a: unknown[]) => signUp(...(a as [])),
      signInWithPassword: vi.fn(async () => ({ error: null })),
    },
    rpc: vi.fn(async () => ({ error: null })),
    functions: { invoke: vi.fn(async () => ({ data: {}, error: null })) },
  },
}));
vi.mock("@/lib/biometric", () => ({
  isBiometricEnabled: () => false,
  hasBiometricLogin: () => false,
  getBiometricLogin: async () => null,
  saveBiometricLogin: vi.fn(),
}));

import { supabase } from "@/integrations/supabase/client";
import {
  fetchRecoveryEmailStatus,
  isValidRecoveryEmail,
  saveRecoveryEmail,
  validateRecoveryEmail,
} from "@/lib/recoveryEmail";
import { useRecoveryEmailGate } from "@/hooks/useRecoveryEmailGate";
import RequiredEmailPrompt from "@/components/RequiredEmailPrompt";
import AuthScreen from "@/components/AuthScreen";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}
function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
}

beforeEach(() => {
  state.row = null;
  state.selectError = null;
  state.upsertError = null;
  upsert.mockClear();
  maybeSingle.mockClear();
  signOut.mockClear();
  signUp.mockClear();
  setOnline(true);
  setVisibility("visible");
});
afterEach(() => setOnline(true));

describe("recovery e-mail validation", () => {
  it("accepts normal addresses and rejects junk / our fake auth domain", () => {
    expect(isValidRecoveryEmail("Kalle.Anka@Example.se ")).toBe(true);
    expect(isValidRecoveryEmail("kalle@example")).toBe(false);
    expect(isValidRecoveryEmail("kalle example.se")).toBe(false);
    expect(isValidRecoveryEmail("kalle@@example.se")).toBe(false);
    expect(isValidRecoveryEmail("kalle@example..se")).toBe(false);
    expect(isValidRecoveryEmail("kalle@trainapp.local")).toBe(false);
  });
  it("requires the retyped address to match (case/whitespace-insensitive)", () => {
    expect(validateRecoveryEmail("", "")).toBe("Ange din e-postadress");
    expect(validateRecoveryEmail("a@b.se", "a@b.com")).toBe("E-postadresserna matchar inte");
    expect(validateRecoveryEmail("A@B.se", " a@b.se ")).toBeNull();
  });
});

describe("fetchRecoveryEmailStatus / saveRecoveryEmail", () => {
  it("reports present, missing and unknown (error or offline)", async () => {
    state.row = { email: "a@b.se" };
    expect(await fetchRecoveryEmailStatus(supabase, "u1")).toBe("present");
    state.row = null;
    expect(await fetchRecoveryEmailStatus(supabase, "u1")).toBe("missing");
    state.row = { email: "  " };
    expect(await fetchRecoveryEmailStatus(supabase, "u1")).toBe("missing");
    state.selectError = { message: "network" };
    expect(await fetchRecoveryEmailStatus(supabase, "u1")).toBe("unknown");
    state.selectError = null;
    setOnline(false);
    expect(await fetchRecoveryEmailStatus(supabase, "u1")).toBe("unknown");
  });
  it("upserts the normalized address on user_id and maps errors", async () => {
    const ok = await saveRecoveryEmail(supabase, "u1", "  Kalle@Example.SE ");
    expect(ok).toEqual({ ok: true, email: "kalle@example.se" });
    expect(from).toHaveBeenCalledWith("user_emails");
    expect(upsert).toHaveBeenCalledWith({ user_id: "u1", email: "kalle@example.se" }, { onConflict: "user_id" });

    state.upsertError = { code: "42501", message: "rls" };
    const rls = await saveRecoveryEmail(supabase, "u1", "kalle@example.se");
    expect(rls.ok).toBe(false);

    setOnline(false);
    const offline = await saveRecoveryEmail(supabase, "u1", "kalle@example.se");
    expect(offline).toEqual({ ok: false, error: expect.stringMatching(/offline/i) });
  });
});

describe("useRecoveryEmailGate", () => {
  it("opens at boot when the e-mail is missing", async () => {
    const { result } = renderHook(() => useRecoveryEmailGate("u1"));
    await waitFor(() => expect(result.current.open).toBe(true));
    act(() => result.current.markSaved());
    expect(result.current.open).toBe(false);
  });
  it("stays closed when an e-mail exists or no user", async () => {
    state.row = { email: "a@b.se" };
    const { result } = renderHook(() => useRecoveryEmailGate("u1"));
    await waitFor(() => expect(result.current.status).toBe("present"));
    expect(result.current.open).toBe(false);
    const none = renderHook(() => useRecoveryEmailGate(null));
    expect(none.result.current.open).toBe(false);
  });
  it("never blocks offline; a later online check defers the gate to the next app resume", async () => {
    setOnline(false);
    const { result } = renderHook(() => useRecoveryEmailGate("u1"));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.open).toBe(false);
    expect(result.current.status).toBe("unknown");

    setOnline(true);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(result.current.status).toBe("missing"));
    // Not interrupting the user while they are in the app
    expect(result.current.open).toBe(false);

    setVisibility("hidden");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(result.current.open).toBe(false);
    setVisibility("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(result.current.open).toBe(true);
  });
});

describe("RequiredEmailPrompt", () => {
  it("explains why, has no close button, validates the retype and saves", async () => {
    const onSaved = vi.fn();
    render(<RequiredEmailPrompt userId="u1" onSaved={onSaved} />);
    expect(screen.getByText("Lägg till din e-post")).toBeTruthy();
    expect(screen.getByText(/träningshistorik/)).toBeTruthy();
    expect(screen.getByText(/aldrig för reklam/)).toBeTruthy();
    expect(screen.queryByText("Avbryt")).toBeNull();

    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "kalle@example.se" } });
    fireEvent.change(screen.getByLabelText("Skriv e-postadressen igen"), { target: { value: "kalle@example.com" } });
    fireEvent.click(screen.getByText("Spara och fortsätt"));
    expect(await screen.findByText("E-postadresserna matchar inte")).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Skriv e-postadressen igen"), { target: { value: "Kalle@example.se" } });
    fireEvent.click(screen.getByText("Spara och fortsätt"));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith({ user_id: "u1", email: "kalle@example.se" }, { onConflict: "user_id" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("kalle@example.se"), { timeout: 3000 });
  });
  it("shows a friendly error when saving fails and offers Logga ut", async () => {
    state.upsertError = { code: "XX000", message: "boom" };
    render(<RequiredEmailPrompt userId="u1" onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "kalle@example.se" } });
    fireEvent.change(screen.getByLabelText("Skriv e-postadressen igen"), { target: { value: "kalle@example.se" } });
    fireEvent.click(screen.getByText("Spara och fortsätt"));
    expect(await screen.findByText(/Kunde inte spara e-postadressen/)).toBeTruthy();
    fireEvent.click(screen.getByText("Logga ut"));
    expect(signOut).toHaveBeenCalled();
  });
});

describe("Sign-up requires an e-mail", () => {
  function openSignup() {
    render(<AuthScreen onAuth={() => {}} />);
    fireEvent.click(screen.getByText("Har du inget konto? Skapa ett"));
    fireEvent.change(screen.getByPlaceholderText("Användarnamn"), { target: { value: "kalle" } });
    fireEvent.change(screen.getByPlaceholderText("••••••"), { target: { value: "hemligt123" } });
  }
  it("blocks sign-up without a valid, matching e-mail", async () => {
    openSignup();
    expect(screen.getByText(/träningshistorik/)).toBeTruthy();
    fireEvent.click(screen.getByText("Skapa konto", { selector: "button" }));
    expect(await screen.findByText("Ange din e-postadress")).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });
  it("signs up and saves the e-mail to user_emails", async () => {
    openSignup();
    fireEvent.change(screen.getByLabelText("E-postadress"), { target: { value: "kalle@example.se" } });
    fireEvent.change(screen.getByLabelText("Skriv e-postadressen igen"), { target: { value: "kalle@example.se" } });
    fireEvent.click(screen.getByText("Skapa konto", { selector: "button" }));
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    await waitFor(() => expect(upsert).toHaveBeenCalledWith({ user_id: "new-user", email: "kalle@example.se" }, { onConflict: "user_id" }));
  });
});
