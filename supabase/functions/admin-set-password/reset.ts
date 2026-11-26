// Fresh cryptographic entropy per reset; never weaken the auth password policy.
export function generateTemporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `Aa1!${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

type Result = { error: { message: string } | null };

export async function resetMemberPassword(
  previousMustChange: boolean,
  setMustChange: (value: boolean) => PromiseLike<Result>,
  setPassword: (password: string) => PromiseLike<Result>,
): Promise<{ password?: string; error?: string }> {
  const flag = await setMustChange(true);
  if (flag.error) return { error: "Kunde inte kräva lösenordsbyte. Inget lösenord har ändrats." };
  const password = generateTemporaryPassword();
  const result = await setPassword(password);
  if (result.error) {
    await setMustChange(previousMustChange);
    return { error: "Kunde inte återställa lösenordet. Försök igen." };
  }
  return { password };
}