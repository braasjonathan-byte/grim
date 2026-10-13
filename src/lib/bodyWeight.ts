import { supabase } from "@/integrations/supabase/client";
import { toLocalDateKey } from "@/lib/dateUtils";

export const WEIGHT_CHANGED_EVENT = "grim:weight-changed";

/**
 * Sparar en vägning för dagens datum och meddelar alla viktgrafer att ladda om.
 * Används av alla ställen där användaren uppdaterar sin vikt (profil, mål, kost).
 */
export async function logBodyWeight(userId: string, weightKg: number): Promise<void> {
  await supabase.from("body_weight_logs").upsert(
    { user_id: userId, log_date: toLocalDateKey(new Date()), weight_kg: weightKg },
    { onConflict: "user_id,log_date" }
  );
  window.dispatchEvent(new Event(WEIGHT_CHANGED_EVENT));
}
