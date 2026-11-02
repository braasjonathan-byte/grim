import { useEffect, useMemo, useState } from "react";
import { Moon, Footprints, HeartPulse, Gauge, Scale, ChevronRight, CalendarRange } from "lucide-react";
import type { HealthDay } from "@/lib/healthSync";
import { readBodyComposition, isHealthSupported, type BodyComposition } from "@/lib/healthSync";
import { computeReadiness } from "@/lib/readiness";
import { toLocalDateKey } from "@/lib/dateUtils";

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const fmtH = (m: number) => `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;

function Spark({ values, color = "hsl(var(--primary))" }: { values: (number | null)[]; color?: string }) {
  const v = values.map((x) => (x && x > 0 ? x : null));
  const nums = v.filter((x): x is number => x != null);
  if (nums.length < 2) return null;
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const W = 100, H = 24;
  let d = "";
  v.forEach((x, i) => {
    if (x == null) return;
    const px = (i / Math.max(1, v.length - 1)) * W;
    const py = hi === lo ? H / 2 : H - ((x - lo) / (hi - lo)) * (H - 4) - 2;
    d += `${d ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
  });
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-6" preserveAspectRatio="none"><path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" /></svg>;
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[2px] h-6">
      {values.map((x, i) => <div key={i} className={`flex-1 rounded-sm ${i === values.length - 1 ? "bg-primary" : "bg-primary/40"}`} style={{ height: `${Math.max(4, (x / max) * 100)}%` }} />)}
    </div>
  );
}

interface Props { days: HealthDay[] }

/** Hem: dagsform + trender för sömn, steg/distans, puls och vilopuls från hälsoappen. */
export default function HomeHealthTrends({ days }: Props) {
  const todayKey = toLocalDateKey(new Date());
  const last14 = useMemo(() => {
    const out: HealthDay[] = [];
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const k = toLocalDateKey(dt);
      out.push(days.find((d) => d.day === k) ?? { day: k, steps: 0, activeCalories: 0, sleepMinutes: 0 });
    }
    return out;
  }, [days]);
  const readiness = useMemo(() => computeReadiness(days, todayKey), [days, todayKey]);
  const [body, setBody] = useState<BodyComposition | null>(null);
  useEffect(() => { if (isHealthSupported()) readBodyComposition(false).then(setBody).catch(() => {}); }, []);

  const sleep7 = avg(last14.slice(-7).map((d) => d.sleepMinutes).filter((m) => m > 120));
  const sleepPrev = avg(last14.slice(0, 7).map((d) => d.sleepMinutes).filter((m) => m > 120));
  const steps7 = avg(last14.slice(-7).map((d) => d.steps).filter((s) => s > 0));
  const dist7 = last14.slice(-7).reduce((a, d) => a + (d.distanceM || 0), 0);
  const today = last14[last14.length - 1];
  const rhrSeries = last14.map((d) => d.restingHeartRate ?? null);
  const rhrNums = rhrSeries.filter((x): x is number => !!x);
  const hasAny = sleep7 || steps7 || rhrNums.length || today.maxHeartRate;
  if (!hasAny && !readiness) return null;

  const tone = readiness ? (readiness.score >= 75 ? "text-success" : readiness.score >= 50 ? "text-primary" : "text-warning") : "";

  return (
    <div className="space-y-3">
      {readiness && (
        <section className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3" aria-label="Dagsform">
          <div className={`relative w-14 h-14 shrink-0 ${tone}`}>
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(readiness.score / 100) * 97.4} 97.4`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">{readiness.score}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Gauge className="w-3 h-3" /> Dagsform</p>
            <p className={`text-base font-bold ${tone}`}>{readiness.label}</p>
            <p className="text-[11px] text-muted-foreground">{readiness.advice}</p>
            {readiness.reasons.length > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{readiness.reasons.join(" · ")}</p>}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        {sleep7 && (
          <section className="rounded-2xl border border-border bg-card p-3 space-y-1" aria-label="Sömntrend">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Moon className="w-3 h-3" /> Sömn 7 d</p>
            <p className="text-lg font-bold leading-none">{fmtH(sleep7)}</p>
            <Spark values={last14.map((d) => (d.sleepMinutes > 120 ? d.sleepMinutes : null))} color="#818cf8" />
            {sleepPrev && <p className="text-[10px] text-muted-foreground">{sleep7 >= sleepPrev ? "↑" : "↓"} {Math.abs(Math.round(sleep7 - sleepPrev))} min vs veckan innan</p>}
          </section>
        )}
        {steps7 && (
          <section className="rounded-2xl border border-border bg-card p-3 space-y-1" aria-label="Steg och distans">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Footprints className="w-3 h-3" /> Steg 14 d</p>
            <p className="text-lg font-bold leading-none">{Math.round(steps7).toLocaleString("sv-SE")}<span className="text-[10px] font-medium text-muted-foreground"> /dag</span></p>
            <Bars values={last14.map((d) => d.steps)} />
            {dist7 > 0 && <p className="text-[10px] text-muted-foreground">{(dist7 / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km senaste 7 d</p>}
          </section>
        )}
        {rhrNums.length >= 2 && (
          <section className="rounded-2xl border border-border bg-card p-3 space-y-1" aria-label="Vilopulstrend">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><HeartPulse className="w-3 h-3" /> Vilopuls</p>
            <p className="text-lg font-bold leading-none">{rhrNums[rhrNums.length - 1]}<span className="text-[10px] font-medium text-muted-foreground"> bpm</span></p>
            <Spark values={rhrSeries} color="hsl(var(--destructive))" />
            <p className="text-[10px] text-muted-foreground">14 d: {Math.min(...rhrNums)}–{Math.max(...rhrNums)} bpm</p>
          </section>
        )}
        {(today.maxHeartRate || today.minHeartRate) && (
          <section className="rounded-2xl border border-border bg-card p-3 space-y-1" aria-label="Puls idag">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><HeartPulse className="w-3 h-3" /> Puls idag</p>
            <p className="text-lg font-bold leading-none">{today.minHeartRate ?? "–"}–{today.maxHeartRate ?? "–"}<span className="text-[10px] font-medium text-muted-foreground"> bpm</span></p>
            {today.avgHeartRate && <p className="text-[10px] text-muted-foreground">Snitt {today.avgHeartRate} bpm</p>}
          </section>
        )}
        {body && (body.bodyFatPct || body.leanKg) ? (
          <section className="rounded-2xl border border-border bg-card p-3 space-y-1" aria-label="Kroppssammansättning">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Scale className="w-3 h-3" /> Kropp</p>
            {body.bodyFatPct != null && <p className="text-lg font-bold leading-none">{body.bodyFatPct.toLocaleString("sv-SE")} %<span className="text-[10px] font-medium text-muted-foreground"> fett</span></p>}
            {body.leanKg != null && <p className="text-[11px] text-muted-foreground">Fettfri massa {body.leanKg.toLocaleString("sv-SE")} kg</p>}
            {body.at && <p className="text-[10px] text-muted-foreground">{new Date(body.at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}</p>}
          </section>
        ) : isHealthSupported() && body && !body.granted ? (
          <button onClick={() => readBodyComposition(true).then(setBody).catch(() => {})} className="rounded-2xl border border-dashed border-border bg-card p-3 text-left space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Scale className="w-3 h-3" /> Kropp</p>
            <p className="text-xs">Visa fett % och fettfri massa från din smartvåg</p>
            <p className="text-[10px] text-primary font-semibold">Tillåt i Health Connect</p>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Ingång till vecko-/periodsammanfattningen direkt från Hem. */
export function WeeklySummaryEntry() {
  const isSundayish = [0, 1].includes(new Date().getDay());
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("grim:open-weekly-report", { detail: {} }))}
      className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left ${isSundayish ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}
    >
      <CalendarRange className="w-5 h-5 text-primary shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{isSundayish ? "Din veckosammanfattning är klar" : "Veckosammanfattning"}</span>
        <span className="block text-[11px] text-muted-foreground">Pass, volym, kost och rekord – vecka för vecka</span>
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
