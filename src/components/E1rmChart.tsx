import { bestE1rm, type PSet } from "@/lib/progression";

/** Liten e1RM-trend per övning (Epley), äldst → nyast. */
export default function E1rmChart({ sessions }: { sessions: { date: Date; sets: PSet[] }[] }) {
  const pts = sessions
    .map((s) => ({ date: s.date, v: bestE1rm(s.sets) }))
    .filter((p) => p.v > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = Math.max(1, max - min);
  const W = 300, H = 70, pad = 6;
  const coords = pts.map((p, i) => [(i / (pts.length - 1)) * W, pad + (1 - (p.v - min) / span) * (H - pad * 2)]);
  const last = pts[pts.length - 1].v;
  const first = pts[0].v;
  const delta = Math.round((last - first) * 10) / 10;
  return (
    <div className="rounded-lg border border-border/50 bg-card p-2">
      <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1">
        <span>Uppskattat 1RM (e1RM)</span>
        <span className="tabular-nums">{Math.round(last)} kg {delta !== 0 && <span className={delta > 0 ? "text-success" : "text-destructive"}>({delta > 0 ? "+" : ""}{delta})</span>}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 60 }} role="img" aria-label="e1RM-trend">
        <polyline points={coords.map((c) => c.join(",")).join(" ")} className="stroke-primary" fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {coords.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} className="fill-primary" />)}
      </svg>
    </div>
  );
}
