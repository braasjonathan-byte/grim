import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

export const RECOVERY_EMAIL_MAX_LENGTH = 254;

/** Why we ask for an e-mail, shown on the required-email screen and at sign-up. */
export const RECOVERY_EMAIL_WHY =
  "Om du glömmer lösenordet skickar vi ett tillfälligt lösenord hit. Utan e-post finns det inget sätt att komma tillbaka till ditt konto och din träningshistorik.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeRecoveryEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidRecoveryEmail(value: string): boolean {
  const email = normalizeRecoveryEmail(value);
  if (!email || email.length > RECOVERY_EMAIL_MAX_LENGTH) return false;
  if (!EMAIL_RE.test(email)) return false;
  // Our own fake auth domain is never a real inbox
  if (email.endsWith("@trainapp.local")) return false;
  if (email.includes("..")) return false;
  return true;
}

/** Validates the address and (when given) that the retyped confirmation matches. */
export function validateRecoveryEmail(email: string, confirm?: string): string | null {
  if (!email.trim()) return "Ange din e-postadress";
  if (!isValidRecoveryEmail(email)) return "Det ser inte ut som en giltig e-postadress";
  if (confirm !== undefined && normalizeRecoveryEmail(email) !== normalizeRecoveryEmail(confirm)) {
    return "E-postadresserna matchar inte";
  }
  return null;
}

export type RecoveryEmailStatus = "present" | "missing" | "unknown";

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Whether the user has a saved recovery e-mail in `user_emails`.
 * Returns "unknown" when offline or when the lookup fails, so callers never
 * lock someone out because the network is down.
 */
export async function fetchRecoveryEmailStatus(client: Client, userId: string): Promise<RecoveryEmailStatus> {
  if (!userId || isOffline()) return "unknown";
  try {
    const { data, error } = await client
      .from("user_emails")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return "unknown";
    const email = (data as { email?: string | null } | null)?.email;
    return email && email.trim() ? "present" : "missing";
  } catch {
    return "unknown";
  }
}

export type SaveRecoveryEmailResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * Saves (insert or update) the user's recovery e-mail in `user_emails`.
 * user_id is UNIQUE and RLS only lets a user write their own row.
 */
export async function saveRecoveryEmail(client: Client, userId: string, rawEmail: string): Promise<SaveRecoveryEmailResult> {
  const email = normalizeRecoveryEmail(rawEmail);
  if (!userId) return { ok: false, error: "Du är inte inloggad. Logga in igen." };
  if (!isValidRecoveryEmail(email)) return { ok: false, error: "Det ser inte ut som en giltig e-postadress" };
  if (isOffline()) return { ok: false, error: "Du är offline. Anslut till internet och försök igen." };
  try {
    const { error } = await client
      .from("user_emails")
      .upsert({ user_id: userId, email }, { onConflict: "user_id" });
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") return { ok: false, error: "E-postadressen kunde inte sparas. Försök igen." };
      if (code === "42501") return { ok: false, error: "Sessionen har gått ut. Logga ut och in igen." };
      return { ok: false, error: "Kunde inte spara e-postadressen. Försök igen." };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, error: "Kunde inte spara e-postadressen. Kontrollera anslutningen och försök igen." };
  }
}
