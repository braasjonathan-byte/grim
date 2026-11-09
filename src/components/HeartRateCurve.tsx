import { useMemo } from "react";
import { useProfileBasics } from "@/lib/profileBasics";
import { HR_ZONES, effortLabel, maxHeartRateForZones, relativeEffort, zoneShares } from "@/lib/hrCurve";

interface Props {
  hr?: number[] | null;
  avg?: number | string | null;
  max?: number | string | null;
  min?: number | string | null;
  minutes?: number | null;
}

/** Pulskurva med zonfärger, min/snitt/max och tid i zoner. */
export default function HeartRateCurve({ hr, avg, max, min, minutes }: Props) {
  const profile = useProfileBasics();
  const series = Array.isArray(hr) ? hr.filter((n) => Number.isFinite(n) && n > 0) : [];
  const maxObserved = series.length ? Math.max(...series) : Number(max) || 0;
  const minObserved = series.length ? Math.min(...series) : Number(min) || 0;
  const avgVal = series.length ? Math.round(series.reduce((a, b) => a + b, 0) / series.length) : Number(avg) || 0;
  const maxHr = maxHeartRateForZones(profile?.maxHeartRate, profile?.age, maxObserved);
  const chartMaxHr = Math.max(maxHr, maxObserved);
  const shares = useMemo(() => zoneShares(series, maxHr), [series.join(","), maxHr]);

  if (!series.length && !maxObserved && !minObserved) return null;

  const W = 300, H = 70;
  const lo = Math.min(minObserved, maxHr * 0.5) - 5;
  const hi = chartMaxHr;
  const y = (b: number) => H - ((b - lo) / (hi - lo)) * H;
  const path = series.map((b, i) => `${i ? "L" : "M"}${((i / Math.max(1, series.length - 1)) * W).toFixed(1)},${y(b).toFixed(1)}`).join(" ");

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-2 space-y-1.5">
      <div className="flex gap-3 text-[11px]">
        <span>❤️ Snitt <b className="tabular-nums">{avgVal || "–"}</b></span>
        <span>Max <b className="tabular-nums">{maxObserved || "–"}</b></span>
        <span>Lägsta <b className="tabular-nums">{minObserved || "–"}</b></span>
        {series.length > 1 && minutes ? (() => { const e = relativeEffort(shares, minutes); return e > 0 ? <span className="ml-auto" title="Relativ ansträngning: minuter i pulszon × zonvikt">⚡ <b className="tabular-nums">{e}</b> {effortLabel(e)}</span> : null; })() : null}
      </div>
      {series.length > 1 && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none" role="img" aria-label="Pulskurva">
            {HR_ZONES.map((z, i) => {
              const top = i < HR_ZONES.length - 1 ? y(HR_ZONES[i + 1].min * maxHr) : 0;
              const bottom = y(z.min * maxHr);
              return <rect key={z.label} x={0} y={Math.max(0, top)} width={W} height={Math.max(0, Math.min(H, bottom) - Math.max(0, top))} fill={z.color} opacity={0.12} />;
            })}
            <path d={path} fill="none" stroke="hsl(var(--destructive))" strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          <div className="flex h-2 overflow-hidden rounded-full">
            {shares.map((s, i) => s > 0 && <div key={i} style={{ width: `${s * 100}%`, backgroundColor: HR_ZONES[i].color }} />)}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {HR_ZONES.map((z, i) => (
              <span key={z.label} title={z.name}>{z.label} {minutes ? `${Math.round(shares[i] * minutes)}m` : `${Math.round(shares[i] * 100)}%`}</span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Zoner beräknade med maxpuls {maxHr} bpm</p>
        </>
      )}
    </div>
  );
}
