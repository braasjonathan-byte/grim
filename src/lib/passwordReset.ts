import type { SupabaseClient } from "@supabase/supabase-js";
import { looksLikeTempPassword } from "../../supabase/functions/_shared/tempPassword";

export const MIN_PASSWORD_LENGTH = 8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

/** Always resolves; the server never reveals whether the account exists. */
export async function requestPasswordReset(client: Client, identifier: string): Promise<{ ok: boolean }> {
  const value = identifier.trim();
  if (value.length < 2) return { ok: false };
  try {
    const { error } = await client.functions.invoke("forgot-password", { body: { identifier: value } });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export type LoginResult =
  | { ok: true; viaTempPassword: boolean }
  | { ok: false; error: string };

/**
 * Normal login first; if that fails and the password looks like a temporary
 * password from the "Glömt lösenord" mail, try the temp-password-login function
 * and adopt the session it mints.
 */
export async function signInWithPasswordOrTemp(
  client: Client,
  opts: { email: string; nickname: string; password: string },
): Promise<LoginResult> {
  const { error } = await client.auth.signInWithPassword({ email: opts.email, password: opts.password });
  if (!error) return { ok: true, viaTempPassword: false };

  if (!looksLikeTempPassword(opts.password)) {
    return { ok: false, error: "Fel användarnamn eller lösenord" };
  }
  try {
    const { data, error: fnError } = await client.functions.invoke("temp-password-login", {
      body: { nickname: opts.nickname.trim(), password: opts.password.trim() },
    });
    const session = data?.session;
    if (fnError || !data?.success || !session?.access_token || !session?.refresh_token) {
      const status = (fnError as { context?: { status?: number } } | null)?.context?.status;
      return {
        ok: false,
        error: status === 429 ? "För många försök. Vänta en stund och försök igen." : "Fel användarnamn eller lösenord",
      };
    }
    const { error: setErr } = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (setErr) return { ok: false, error: "Inloggningen misslyckades. Försök igen." };
    return { ok: true, viaTempPassword: true };
  } catch {
    return { ok: false, error: "Fel användarnamn eller lösenord" };
  }
}

export function validateNewPassword(newPassword: string, confirm: string): string | null {
  if (newPassword.length < MIN_PASSWORD_LENGTH) return `Lösenord måste vara minst ${MIN_PASSWORD_LENGTH} tecken`;
  if (newPassword === "12345678") return "Välj ett annat lösenord";
  if (looksLikeTempPassword(newPassword)) return "Välj ett eget lösenord, inte det tillfälliga";
  if (newPassword !== confirm) return "Lösenorden matchar inte";
  return null;
}

/** Sets the new password, clears the must-change flag and deletes temp passwords. */
export async function completeForcedPasswordChange(client: Client, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  const { error: rpcError } = await client.rpc("complete_forced_password_change");
  if (rpcError) {
    // Fallback: at least clear the flag so the user isn't stuck
    const { data } = await client.auth.getUser();
    if (data?.user) {
      await client.from("profiles").update({ must_change_password: false }).eq("user_id", data.user.id);
    }
  }
  return { ok: true };
}
