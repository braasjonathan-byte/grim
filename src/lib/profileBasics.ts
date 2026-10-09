import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PROFILE_UPDATED_EVENT = "grim:profile-updated";
export const notifyProfileUpdated = () => window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));

export interface ProfileBasics { age: number | null; gender: string | null; weightKg: number | null; heightCm: number | null; mainSport: string | null; ftpWatt: number | null }

/** Grundvärden från profilen, laddas om när profilen sparas. */
export function useProfileBasics(): ProfileBasics | null {
  const [p, setP] = useState<ProfileBasics | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("profiles").select("age, gender, weight_kg, height_cm, main_sport, ftp_watt").eq("user_id", uid).maybeSingle();
      if (cancelled || !data) return;
      setP({
        age: data.age ?? null, gender: data.gender ?? null,
        weightKg: data.weight_kg != null ? Number(data.weight_kg) : null,
        heightCm: data.height_cm != null ? Number(data.height_cm) : null,
        mainSport: (data as any).main_sport ?? null, ftpWatt: (data as any).ftp_watt ?? null,
      });
    };
    load();
    window.addEventListener(PROFILE_UPDATED_EVENT, load);
    return () => { cancelled = true; window.removeEventListener(PROFILE_UPDATED_EVENT, load); };
  }, []);
  return p;
}
