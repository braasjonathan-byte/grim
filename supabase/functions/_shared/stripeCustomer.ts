import { allowedOrigin } from "./appOrigin.ts";
// Resolves the Stripe customer that belongs to the signed-in user.
// The stored stripe_customer_id can only be written server-side (DB trigger),
// and e-mail fallback lookups only accept customers that are provably tied to
// this user: tagged with our user id, or matching the user's confirmed login e-mail.
// deno-lint-ignore-file no-explicit-any
export async function resolveStripeCustomerId(
  stripe: any,
  admin: any,
  user: { id: string; email?: string | null; email_confirmed_at?: string | null },
  storedId: string | null | undefined,
  registeredEmail: string | null | undefined,
): Promise<string | null> {
  if (storedId) return storedId;
  const confirmed = user.email && user.email_confirmed_at ? user.email.toLowerCase() : null;
  const emails = Array.from(new Set([registeredEmail?.toLowerCase(), confirmed].filter(Boolean))) as string[];
  for (const email of emails) {
    const customers = await stripe.customers.list({ email, limit: 10 });
    const match = customers.data.find((c: any) =>
      c?.metadata?.grim_user_id === user.id || (confirmed && (c.email ?? "").toLowerCase() === confirmed)
    );
    if (match) {
      await admin.from("user_emails").update({ stripe_customer_id: match.id }).eq("user_id", user.id);
      return match.id;
    }
  }
  return null;
}

export function safeAppOrigin(req: Request): string {
  return allowedOrigin(req.headers.get("origin"));
}
