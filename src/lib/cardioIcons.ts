import { Activity, Bike, Footprints, PersonStanding, Sailboat, TrendingUp, Waves, type LucideIcon } from "lucide-react";
import { getCardioCategory, type CardioCategory } from "@/lib/cardioVisibility";

/** Lucide-ikoner för grenar i UI-chrome (rutnät, chips). Emojin i CARDIO_CATEGORIES finns kvar för delningstexter. */
export const CARDIO_ICONS: Record<CardioCategory, LucideIcon> = {
  "löpning": Footprints,
  cykling: Bike,
  simning: Waves,
  rodd: Sailboat,
  promenad: PersonStanding,
  trapp: TrendingUp,
};

/** Rätt ikon per gren för en övnings-/passrad (cykel, simning …); okänd gren → neutral aktivitetsikon. */
export function cardioIconFor(name: string | null | undefined): LucideIcon {
  const cat = getCardioCategory(name);
  return cat ? CARDIO_ICONS[cat] : Activity;
}
