import { useEffect } from "react";

export interface IntervalRow {
  h: string;
  m: string;
  s: string;
  tempo: string;
  distance: string;
  pulse: string;
  auto?: "time" | "tempo" | "distance" | null;
}

export const emptyIntervalRow = (): IntervalRow => ({
  h: "", m: "", s: "", tempo: "", distance: "", pulse: "", auto: null,
});

const parseTempo = (t: string): number | null => {
  const trimmed = t.trim();
  if (!trimmed) return null;
  const colon = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colon) return parseInt(colon[1]) + parseInt(colon[2]) / 60;
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
  const v = parseFloat(trimmed.replace(",", "."));
  return isNaN(v) ? null : v;
};

const formatTempo = (minPerKm: number): string => {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const rowTimeMin = (r: IntervalRow): number => {
  const h = parseInt(r.h) || 0;
  const m = parseInt(r.m) || 0;
  const s = parseInt(r.s) || 0;
  return h * 60 + m + s / 60;
};

const setTimeFromMin = (r: IntervalRow, total: number): IntervalRow => {
  const totalSec = Math.round(total * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    ...r,
    h: h > 0 ? String(h) : "",
    m: String(m),
    s: s > 0 ? String(s) : "",
  };
};

const autoCalc = (r: IntervalRow, changed: "time" | "tempo" | "distance"): IntervalRow => {
  const t = rowTimeMin(r);
  const p = parseTempo(r.tempo);
  const d = parseFloat(r.distance.replace(",", "."));
  const filled = {
    time: t > 0,
    tempo: r.tempo.trim().length > 0 && p !== null && p > 0,
    distance: r.distance.trim().length > 0 && !isNaN(d) && d > 0,
  };
  let next = { ...r };

  const compute = (field: "time" | "tempo" | "distance"): IntervalRow => {
    if (field === "distance" && t > 0 && p && p > 0) {
      return { ...next, distance: String(Math.round((t / p) * 100) / 100) };
    }
    if (field === "tempo" && t > 0 && d > 0) {
      return { ...next, tempo: formatTempo(t / d) };
    }
    if (field === "time" && d > 0 && p && p > 0) {
      return setTimeFromMin(next, p * d);
    }
    return next;
  };

  if (!filled[changed]) {
    if (next.auto === changed) next.auto = null;
    return next;
  }

  const filledCount = Object.values(filled).filter(Boolean).length;
  if (filledCount < 2) return next;

  const missing = (["time", "tempo", "distance"] as const).find((f) => !filled[f]);
  if (filledCount === 2 && missing) {
    next = compute(missing);
    next.auto = missing;
    return next;
  }

  if (filledCount === 3 && next.auto) {
    if (next.auto === changed) {
      next.auto = null;
      return next;
    }
    next = compute(next.auto);
  }
  return next;
};

interface Props {
  count: number;
  rows: IntervalRow[];
  onChange: (rows: IntervalRow[]) => void;
  /** Etikett för tempo-kolumnen, t.ex. "min/500m". Default "min/km". */
  paceUnit?: string;
  /** Distansenhet, t.ex. "m" för simning. Default "km". */
  distUnit?: string;
  /** Dölj distanskolumnen (t.ex. hopprep). */
  hideDistance?: boolean;
}

export default function IntervalRowsEditor({ count, rows, onChange, paceUnit = "min/km", distUnit = "km", hideDistance = false }: Props) {

  useEffect(() => {
    if (count <= 0) return;
    if (rows.length === count) return;
    const next = [...rows];
    while (next.length < count) next.push(emptyIntervalRow());
    if (next.length > count) next.length = count;
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (count <= 0) return null;

  const isRowEmpty = (r: IntervalRow) =>
    !r.h && !r.m && !r.s && !r.tempo.trim() && !r.distance.trim() && !r.pulse.trim();

  const rowsMatch = (a: IntervalRow, b: IntervalRow) =>
    a.h === b.h && a.m === b.m && a.s === b.s &&
    a.tempo === b.tempo && a.distance === b.distance && a.pulse === b.pulse;

  const update = (i: number, patch: Partial<IntervalRow>, changed?: "time" | "tempo" | "distance") => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    if (changed) next[i] = autoCalc(next[i], changed);
    // Auto-replicate Intervall 1 to subsequent rows that are still empty
    // or that currently mirror the previous Intervall 1 (i.e. haven't been edited manually).
    if (i === 0) {
      const prevSrc = rows[0];
      const src = next[0];
      for (let j = 1; j < next.length; j++) {
        if (isRowEmpty(rows[j]) || rowsMatch(rows[j], prevSrc)) {
          next[j] = {
            h: src.h, m: src.m, s: src.s,
            tempo: src.tempo, distance: src.distance, pulse: src.pulse,
            auto: src.auto ?? null,
          };
        }
      }
    }
    onChange(next);
  };

  const inputCls =
    "w-full min-w-0 bg-background text-foreground text-sm px-2 py-2 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-center font-bold tabular-nums placeholder:text-muted-foreground placeholder:font-normal";

  const unitCls = "text-[9px] text-muted-foreground uppercase tracking-wider mt-1 block text-center";
  const labelCls = "text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block text-center";

  return (
    <div className="space-y-2">
      {count > 1 && (
        <p className="text-[11px] text-muted-foreground italic">
          Tips: fyll i Intervall 1 så kopieras värdena automatiskt till övriga tomma intervaller.
        </p>
      )}
      {rows.slice(0, count).map((r, i) => (
        <div
          key={i}
          className={`rounded-xl p-3 border border-border/60 space-y-3 ${i % 2 === 0 ? "bg-muted/40" : "bg-background/60"}`}
        >
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Intervall {i + 1}
          </div>
          <div>
            <label className={`${labelCls} text-left`}>Tid</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0">
                <input
                  type="number" inputMode="numeric" min="0" value={r.h}
                  onChange={(e) => update(i, { h: e.target.value }, "time")}
                  placeholder="0" className={inputCls} />
                <span className={unitCls}>tim</span>
              </div>
              <div className="min-w-0">
                <input
                  type="number" inputMode="numeric" min="0" max="59" value={r.m}
                  onChange={(e) => update(i, { m: e.target.value }, "time")}
                  placeholder="0" className={inputCls} />
                <span className={unitCls}>min</span>
              </div>
              <div className="min-w-0">
                <input
                  type="number" inputMode="numeric" min="0" max="59" value={r.s}
                  onChange={(e) => update(i, { s: e.target.value }, "time")}
                  placeholder="0" className={inputCls} />
                <span className={unitCls}>sek</span>
              </div>
            </div>
          </div>
          <div className={`grid gap-2 ${hideDistance ? "grid-cols-2" : "grid-cols-3"}`}>
            <div className="min-w-0">
              <label className={labelCls}>Tempo</label>
              <input
                type="text" inputMode="numeric" pattern="[0-9:]*" value={r.tempo}
                onChange={(e) => update(i, { tempo: e.target.value }, "tempo")}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw || raw.includes(":")) return;
                  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return;
                  const v = parseFloat(raw.replace(",", "."));
                  if (!isFinite(v) || v <= 0) return;
                  update(i, { tempo: formatTempo(v) }, "tempo");
                }}
                placeholder="5:30" className={inputCls} />
              <span className={unitCls}>{paceUnit}</span>
            </div>
            {!hideDistance && (
              <div className="min-w-0">
                <label className={labelCls}>Distans</label>
                <input
                  type="number" inputMode="decimal" value={r.distance}
                  onChange={(e) => update(i, { distance: e.target.value }, "distance")}
                  placeholder={distUnit === "m" ? "400" : "1.0"} className={inputCls} />
                <span className={unitCls}>{distUnit}</span>
              </div>
            )}
            <div className="min-w-0">
              <label className={labelCls}>Puls</label>
              <input
                type="number" inputMode="numeric" value={r.pulse}
                onChange={(e) => update(i, { pulse: e.target.value })}
                placeholder="155" className={inputCls} />
              <span className={unitCls}>bpm</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


export function summarizeIntervalRows(rows: IntervalRow[]): {
  totalTimeMin: number;
  totalDistanceKm: number;
  avgTempoStr: string;
  avgPulse: number;
  hasAny: boolean;
} {
  let totalTimeMin = 0;
  let totalDistanceKm = 0;
  let pulseSum = 0;
  let pulseCount = 0;
  let hasAny = false;

  for (const r of rows) {
    const t = rowTimeMin(r);
    const d = parseFloat(r.distance.replace(",", "."));
    const p = parseInt(r.pulse);
    if (t > 0 || (!isNaN(d) && d > 0) || (!isNaN(p) && p > 0) || r.tempo.trim()) hasAny = true;
    if (t > 0) totalTimeMin += t;
    if (!isNaN(d) && d > 0) totalDistanceKm += d;
    if (!isNaN(p) && p > 0) {
      pulseSum += p;
      pulseCount += 1;
    }
  }

  let avgTempoStr = "";
  if (totalTimeMin > 0 && totalDistanceKm > 0) {
    avgTempoStr = formatTempo(totalTimeMin / totalDistanceKm);
  }

  return {
    totalTimeMin,
    totalDistanceKm,
    avgTempoStr,
    avgPulse: pulseCount > 0 ? Math.round(pulseSum / pulseCount) : 0,
    hasAny,
  };
}
