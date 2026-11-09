import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const invoke = vi.fn();
const updateUser = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ error: null }));
const signInWithPassword = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...(a as [])),
      setSession: vi.fn(async () => ({ error: null })),
      updateUser: (...a: unknown[]) => updateUser(...(a as [])),
      getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "k@trainapp.local" } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    rpc: (...a: unknown[]) => rpc(...(a as [])),
    from: vi.fn(() => ({ update: () => ({ eq: async () => ({ error: null }) }) })),
  },
}));
vi.mock("@/lib/biometric", () => ({
  isBiometricEnabled: () => false,
  hasBiometricLogin: () => false,
  getBiometricLogin: async () => null,
  saveBiometricLogin: vi.fn(),
}));

import AuthScreen from "@/components/AuthScreen";
import ChangePassword from "@/components/ChangePassword";

beforeEach(() => {
  invoke.mockReset();
  updateUser.mockClear();
  rpc.mockClear();
  signInWithPassword.mockClear();
});

describe("Glömt lösenord UI", () => {
  it("sends identifier to forgot-password and shows a generic confirmation", async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    render(<AuthScreen onAuth={() => {}} />);
    fireEvent.click(screen.getByText("Glömt lösenord?"));
    expect(screen.queryByText(/säkerhetsfrågor/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Användarnamn eller e-post"), { target: { value: "kalle@example.com" } });
    fireEvent.click(screen.getByText("Skicka tillfälligt lösenord"));
    await waitFor(() => expect(screen.getByTestId("forgot-sent")).toBeTruthy());
    expect(invoke).toHaveBeenCalledWith("forgot-password", { body: { identifier: "kalle@example.com" } });
    expect(screen.getByTestId("forgot-spam-hint").textContent).toContain(
      'Hittar du inte mejlet? Kolla skräpposten och markera det som "Inte skräp" så hamnar nästa mejl rätt.',
    );
    expect(screen.getByText(/Om kontot finns och har en e-postadress kopplad/)).toBeTruthy();
  });
});

describe("Forced 'Välj nytt lösenord'", () => {
  it("has no close/cancel, no current-password field and completes the change", async () => {
    const onChanged = vi.fn();
    const onClose = vi.fn();
    render(<ChangePassword forced onClose={onClose} onChanged={onChanged} />);
    expect(screen.getByText("Välj nytt lösenord")).toBeTruthy();
    expect(screen.queryByText("Nuvarande lösenord")).toBeNull();
    expect(screen.queryByText("Avbryt")).toBeNull();
    const [pw, confirm] = screen.getAllByPlaceholderText("••••••");
    fireEvent.change(pw, { target: { value: "nyttlosen1" } });
    fireEvent.change(confirm, { target: { value: "nyttlosen2" } });
    fireEvent.click(screen.getByRole("button", { name: "Byt lösenord" }));
    expect(await screen.findByText("Lösenorden matchar inte")).toBeTruthy();
    fireEvent.change(confirm, { target: { value: "nyttlosen1" } });
    fireEvent.click(screen.getByRole("button", { name: "Byt lösenord" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("complete_forced_password_change"));
    expect(updateUser).toHaveBeenCalledWith({ password: "nyttlosen1" });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
