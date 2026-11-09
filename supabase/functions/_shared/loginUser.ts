import { loginNameFromAuthEmail } from "./tempPassword.ts";

// The login screen signs in with `${loginName}@trainapp.local`. profiles.nickname is a
// separately editable display name and can differ, so resolve accounts via auth.users.

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Login name -> auth user id (null if no such account). */
// deno-lint-ignore no-explicit-any
export async function resolveLoginUserId(admin: any, login: string): Promise<string | null> {
  const { data, error } = await admin.rpc("resolve_login_user", { _login: login });
  if (!error) return (data as string | null) ?? null;
  console.error("[loginUser] resolve_login_user rpc failed, falling back to profiles", error.message);
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("nickname", escapeLike(login))
    .limit(1)
    .maybeSingle();
  return profile?.user_id ?? null;
}

/** Auth user id -> the login name the user types (falls back to profile nickname). */
// deno-lint-ignore no-explicit-any
export async function loginNameForUser(admin: any, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const fromAuth = loginNameFromAuthEmail(data?.user?.email);
  if (fromAuth) return fromAuth;
  const { data: profile } = await admin.from("profiles").select("nickname").eq("user_id", userId).maybeSingle();
  return profile?.nickname ?? null;
}
