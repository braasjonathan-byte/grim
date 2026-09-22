import { supabase } from "@/integrations/supabase/client";

/**
 * Sessionen kan hinna gå ut medan appen fortfarande visar användaren som inloggad.
 * Skrivningar mot RLS-skyddade tabeller ska då hoppas över i stället för att
 * misslyckas tyst mot databasen.
 */
export async function hasValidSessionFor(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await supabase.auth.getSession();
    const sessionUserId = data?.session?.user?.id;
    if (error || !sessionUserId) return false;
    return sessionUserId === userId;
  } catch {
    return false;
  }
}
