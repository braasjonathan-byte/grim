import { useMemo } from "react";

interface Ring {
  label: string;
  value: number;
  target: number;
  color: string;
  unit?: string;
}

interface MacroRingsProps {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  targets: { kcal: number; protein_g: number; fat_g: number; carbs_g: number };
  compact?: boolean;
}

export default function MacroRings({ kcal, protein, fat, carbs, targets, compact }: MacroRingsProps) {
  const rings: Ring[] = useMemo(() => [
    { label: "Kcal", value: kcal, target: targets.kcal, color: "hsl(var(--primary))" },
    { label: "Protein", value: protein, target: targets.protein_g, color: "hsl(var(--success, 142 71% 45%))", unit: "g" },
    { label: "Fett", value: fat, target: targets.fat_g, color: "hsl(45 93% 47%)", unit: "g" },
    { label: "Kolhydrater", value: carbs, target: targets.carbs_g, color: "hsl(199 89% 48%)", unit: "g" },
  ], [kcal, protein, fat, carbs, targets]);

  const size = compact ? 56 : 84;
  const stroke = compact ? 6 : 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className={`grid grid-cols-4 ${compact ? "gap-2" : "gap-3"}`}>
      {rings.map((ring) => {
        const pct = ring.target > 0 ? Math.min(100, (ring.value / ring.target) * 100) : 0;
        const dash = (pct / 100) * c;
        return (
          <div key={ring.label} className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted) / 0.6)" strokeWidth={stroke} />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${c}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 0.4s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`font-bold tabular-nums ${compact ? "text-[10px]" : "text-xs"}`}>{Math.round(pct)}%</span>
              </div>
            </div>
            <div className={`text-center mt-1 ${compact ? "text-[9px]" : "text-[10px]"} text-muted-foreground font-medium`}>
              {ring.label}
            </div>
            <div className={`text-center ${compact ? "text-[9px]" : "text-[10px]"} tabular-nums`}>
              <span className="font-semibold text-foreground">{Math.round(ring.value)}</span>
              <span className="text-muted-foreground">/{ring.target}{ring.unit || ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
