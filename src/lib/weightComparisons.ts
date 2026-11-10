/** Gemensam tabell för "≈ …"-jämförelser av lyft tonnage (åtgärd 14). Värden i ton. */
const WEIGHT_COMPARISONS: { tons: number; text: string }[] = [
  { tons: 0.3, text: "en flygel 🎹" },
  { tons: 0.5, text: "en häst 🐴" },
  { tons: 1.2, text: "en personbil 🚗" },
  { tons: 2.3, text: "en noshörning 🦏" },
  { tons: 6, text: "en afrikansk elefant 🐘" },
  { tons: 8, text: "en T-Rex 🦖" },
  { tons: 12, text: "en skolbuss 🚌" },
  { tons: 40, text: "en fullastad lastbil 🚛" },
  { tons: 60, text: "en stridsvagn 🪖" },
  { tons: 150, text: "en blåval 🐳" },
  { tons: 225, text: "Frihetsgudinnan 🗽" },
  { tons: 7300, text: "Eiffeltornet 🗼" },
  { tons: 52000, text: "Titanic 🚢" },
];

/** Väljer den STÖRSTA posten där tons <= värdet. Under 0,3 t: ingen jämförelse (""). */
export const getWeightComparison = (tons: number): string => {
  if (!Number.isFinite(tons) || tons < WEIGHT_COMPARISONS[0].tons) return "";
  let match = WEIGHT_COMPARISONS[0];
  for (const w of WEIGHT_COMPARISONS) if (w.tons <= tons) match = w;
  return match.text;
};

/** Ton med svensk decimal, t.ex. 0,6. */
export const formatTons = (tons: number): string =>
  tons.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
