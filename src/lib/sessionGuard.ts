import { supabase } from "@/integrations/supabase/client";

/**
 * Sessionen kan hinna gå ut (eller ogiltigförklaras) medan appen fortfarande
 * visar användaren som inloggad. getSession() läser bara lokal cache, så vi
 * verifierar token mot servern med getUser() och försöker förnya sessionen en
 * gång om den avvisas. Skrivningar hoppas över om ingen giltig session finns.
 */
export async function hasValidSessionFor(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return false;

    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user?.id) return data.user.id === userId;

    const status = (error as any)?.status;
    // Tillfälliga nätverksfel (ingen statuskod) får inte tyst blockera
    // achievements/push – lita på den cachade sessionen i stället.
    if (status !== 401 && status !== 403) {
      return sessionData.session.user?.id === userId;
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed?.session?.user?.id) {
      // Token avvisas permanent – logga ut så användaren kan logga in på nytt.
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      return false;
    }
    return refreshed.session.user.id === userId;
  } catch {
    return false;
  }
}
