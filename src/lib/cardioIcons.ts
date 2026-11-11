import { Bike, Footprints, PersonStanding, Sailboat, TrendingUp, Waves, type LucideIcon } from "lucide-react";
import type { CardioCategory } from "@/lib/cardioVisibility";

/** Lucide-ikoner för grenar i UI-chrome (rutnät, chips). Emojin i CARDIO_CATEGORIES finns kvar för delningstexter. */
export const CARDIO_ICONS: Record<CardioCategory, LucideIcon> = {
  "löpning": Footprints,
  cykling: Bike,
  simning: Waves,
  rodd: Sailboat,
  promenad: PersonStanding,
  trapp: TrendingUp,
};
