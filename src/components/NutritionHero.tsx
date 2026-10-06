import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MICROS, formatMicro, qualityTone, type Micros } from "@/lib/micronutrients";

interface Props {
  kcal: number;
  burned: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  micros?: Micros;
  quality?: number | null;
  microTargets?: Micros;
  targets: { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number | null };
}

function Ring({ size, stroke, pct, color, children }: { size: number; stroke: number; pct: number; color: string; children: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted) / 0.6)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">{children}</div>
    </div>
  );
}

/** Kalorihjälte: Kvar = Mål − Ätit (målet bygger redan på träningsvolymen; Förbränt visas bara som info), plus fyra makroringar. */
export default function NutritionHero({ kcal, burned, protein, fat, carbs, fiber, targets, micros = {}, microTargets = {}, quality = null }: Props) {
  const [microOpen, setMicroOpen] = useState(false);
  const microRows = MICROS.filter((m) => (microTargets[m.key] ?? 0) > 0 || micros[m.key] != null);
  const budget = targets.kcal;
  const left = Math.round(budget - kcal);
  const over = left < 0;
  const fiberTarget = targets.fiber_g && targets.fiber_g > 0 ? targets.fiber_g : 30;
  const macros = [
    { label: "Fett", v: fat, t: targets.fat_g, color: "hsl(45 93% 47%)" },
    { label: "Protein", v: protein, t: targets.protein_g, color: "hsl(var(--destructive))" },
    { label: "Kolhydr.", v: carbs, t: targets.carbs_g, color: "hsl(199 89% 48%)" },
    { label: "Fiber", v: fiber, t: fiberTarget, color: "hsl(25 60% 50%)" },
  ];
  return (
    <div className="space-y-4">
      {quality != null && (
        <div className="flex justify-end -mb-2">
          <span title="Matkvalitet: andel hela livsmedel vs. processad mat" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${qualityTone(quality)}`}>Matkvalitet {quality}/100</span>
        </div>
      )}
      <div className="rounded-2xl bg-primary/10 p-4 flex items-center justify-between">
        <div className="text-center w-16">
          <p className="text-xl font-bold tabular-nums">{Math.round(kcal)}</p>
          <p className="text-[10px] text-muted-foreground font-medium">Ätit</p>
        </div>
        <Ring size={128} stroke={10} pct={budget > 0 ? (kcal / budget) * 100 : 0} color={over ? "hsl(var(--destructive))" : "hsl(var(--primary))"}>
          <span className={`text-2xl font-bold tabular-nums ${over ? "text-destructive" : ""}`}>{Math.abs(left)}</span>
          <span className="text-xs font-semibold">kcal</span>
          <span className="text-[10px] text-muted-foreground">{over ? "över" : "kvar"}</span>
        </Ring>
        <div className="text-center w-16">
          <p className="text-xl font-bold tabular-nums">{Math.round(burned)}</p>
          <p className="text-[10px] text-muted-foreground font-medium">Förbränt</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {macros.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-1">
            <Ring size={62} stroke={6} pct={m.t > 0 ? (m.v / m.t) * 100 : 0} color={m.color}>
              <span className="text-sm font-bold tabular-nums">{Math.round(m.v)}</span>
              <span className="text-[9px] text-muted-foreground tabular-nums">/{Math.round(m.t)}g</span>
            </Ring>
            <span className="text-[11px] font-medium">{m.label}</span>
          </div>
        ))}
      </div>
      {microRows.length > 0 && (
        <div className="rounded-2xl bg-muted/40">
          <button onClick={() => setMicroOpen((v) => !v)} aria-expanded={microOpen}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold">
            Mikronäringsämnen
            <ChevronDown className={`w-4 h-4 transition-transform ${microOpen ? "rotate-180" : ""}`} />
          </button>
          {microOpen && (
            <div className="px-3 pb-3 space-y-2">
              {microRows.map((m) => {
                const v = Number(micros[m.key] ?? 0);
                const t = Number(microTargets[m.key] ?? 0);
                const pct = t > 0 ? Math.min(100, (v / t) * 100) : 0;
                return (
                  <div key={m.key}>
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium">{m.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMicro(v)}{t > 0 ? ` / ${formatMicro(t)}` : ""} {m.unit}
                      </span>
                    </div>
                    {t > 0 && (
                      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
