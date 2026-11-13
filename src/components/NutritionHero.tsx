import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

function MacroBar({ label, v, t, color, note }: { label: string; v: number; t: number; color: string; note?: string }) {
  const pct = t > 0 ? Math.min(100, (v / t) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{Math.round(v)}</span> / {note ?? ""}{Math.round(t)} g
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted mt-1 overflow-hidden" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemax={Math.round(t)}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Kalorihjälte: Kvar = Mål − Ätit (målet bygger redan på träningsvolymen; Förbränt visas bara som info), plus fyra makroringar. */
export default function NutritionHero({ kcal, burned, protein, fat, carbs, fiber, targets, micros = {}, microTargets = {}, quality = null }: Props) {
  const [microOpen, setMicroOpen] = useState(false);
  const microRows = MICROS.filter((m) => (microTargets[m.key] ?? 0) > 0 || micros[m.key] != null);
  // Målet bygger redan på vald aktivitetsnivå, så dagens träning läggs INTE på målet — "Förbränt" visas bara som info.
  const budget = targets.kcal;
  const carbTarget = targets.carbs_g;
  const left = Math.round(budget) - Math.round(kcal);
  const over = left < 0;
  const fiberTarget = targets.fiber_g && targets.fiber_g > 0 ? targets.fiber_g : 30;
  const proteinLeft = Math.max(0, Math.round(targets.protein_g - protein));
  const kcalPct = budget > 0 ? Math.min(100, (kcal / budget) * 100) : 0;
  const macros = [
    { label: "Protein", v: protein, t: targets.protein_g, color: "hsl(var(--destructive))" },
    { label: "Kolhydrater", v: carbs, t: carbTarget, color: "hsl(199 89% 48%)" },
    { label: "Fett", v: fat, t: targets.fat_g, color: "hsl(45 93% 47%)" },
  ];
  return (
    <div className="space-y-4">
      {/* Kompakt kcal-mätare: en rad + en stapel i stället för stor ring. */}
      <div className="rounded-tile bg-primary/10 p-3.5 space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-bold tabular-nums leading-none">
              <span className={over ? "text-destructive" : ""}>{Math.abs(left)}</span>
              <span className="text-sm font-semibold"> kcal {over ? "över" : "kvar"}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {Math.round(kcal)} av {Math.round(budget)} kcal ätit
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold tabular-nums">{Math.round(burned)} kcal</p>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-xs text-muted-foreground font-medium">Förbränt ⓘ</button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-xs">Uppskattade kalorier från dagens genomförda träningspass (samma uppskattning som i Träning; 75 kg används om du inte angett din vikt). Förbränningen räknas INTE in i "kvar" – ditt dagsmål bygger redan på den aktivitetsnivå du valt under Mål, så träningen räknas inte dubbelt.</PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="Kalorier" aria-valuenow={Math.round(kcal)} aria-valuemax={Math.round(budget)}>
          <div className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${kcalPct}%` }} />
        </div>
      </div>
      {targets.protein_g > 0 && (
        <p className="text-base font-semibold" data-testid="protein-left">
          {proteinLeft > 0 ? <><span className="tabular-nums">{proteinLeft} g</span> protein kvar idag</> : "Proteinmålet är nått idag"}
        </p>
      )}
      <div className="space-y-2.5">
        {macros.map((m) => <MacroBar key={m.label} {...m} />)}
        <p className="text-xs text-muted-foreground tabular-nums">
          Fiber {Math.round(fiber)} / {targets.fiber_g && targets.fiber_g > 0 ? "" : "rek. "}{Math.round(fiberTarget)} g
        </p>
      </div>
      {microRows.length > 0 && (
        <div className="tile-soft">
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
