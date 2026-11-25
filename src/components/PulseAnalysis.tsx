import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, Heart, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RouteMap from "@/components/RouteMap";
import { useProfileBasics } from "@/lib/profileBasics";
import { HR_ZONES, maxHeartRateForZones } from "@/lib/hrCurve";
import { readSessionHr } from "@/lib/sessionHeartRate";
import { parseWorkoutSeries, seriesFromEvenHr, seriesFromTimedHr, type WorkoutSeries } from "@/lib/workoutSeries";
import {
  computeSplits, formatClock, formatPace, formatSpeed, hrStats, loadLabel, recoveryFrom, similarTrend,
  speedSeries, splitLengthM, sportKind, trainingLoad, zoneIndex, zoneSeconds, type SportKind,
} from "@/lib/pulseAnalysis";
import { importedRoute } from "@/lib/importedRoute";
import { cardioSummaryFromSession, findSessionForEntry, loadHistoryCached } from "@/lib/cardioHistory";

type Point = [number, number];
type Channel = "speed" | "power" | "cadence";

interface Props {
  /** Övnings- eller passnamn (avgör löpning/cykling). */
  name: string;
  /** Konditionsradens sparade data (time, dist, pulse, hr, series, route …). */
  cond?: Record<string, any> | null;
  /** Passets egen pulsinspelning (logged_weights.__hr_session__). */
  sessionHr?: unknown;
  /** Värden på passnivå när konditionsrad saknas (t.ex. äldre Strava-import). */
  fallback?: { avgHr?: number | string | null; maxHr?: number | string | null; minHr?: number | string | null; minutes?: number | null; distanceKm?: number | null };
  /** Passets id i historiken (för jämförelsen). Annars matchas konditionsraden. */
  sessionId?: string;
  defaultExpanded?: boolean;
}

const W = 320;
const H = 130;
const PAD_TOP = 6;
const PAD_BOTTOM = 14;

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function routeCumulative(route: Point[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) {
    const [la1, lo1] = route[i - 1];
    const [la2, lo2] = route[i];
    const x = (lo2 - lo1) * Math.cos(((la1 + la2) / 2) * (Math.PI / 180));
    const y = la2 - la1;
    out.push(out[i - 1] + Math.sqrt(x * x + y * y));
  }
  return out;
}

function pointAtFraction(route: Point[], cum: number[], f: number): Point | null {
  if (route.length < 2) return null;
  const total = cum[cum.length - 1];
  if (!(total > 0)) return route[Math.round(f * (route.length - 1))];
  const target = Math.max(0, Math.min(1, f)) * total;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
  return route[lo];
}

function useUserId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setId(data.user?.id ?? null); }).catch(() => null);
    return () => { alive = false; };
  }, []);
  return id;
}

/** Pulsanalys för hela passet: zonfärgad kurva, tempo/fart, delsträckor, återhämtning, belastning och formtrend. */
export default function PulseAnalysis({ name, cond, sessionHr, fallback, sessionId, defaultExpanded = false }: Props) {
  const profile = useProfileBasics();
  const kind: SportKind | null = sportKind(name);
  const minutes = num(cond?.time) || fallback?.minutes || 0;
  // Bara importerade rutter visas (Grim spelar inte längre in GPS-pass).
  const route = useMemo<Point[]>(() => importedRoute(cond) ?? [], [cond?.route, cond?.routeSource]);
  const routeCum = useMemo(() => routeCumulative(route), [route]);

  const series: WorkoutSeries | null = useMemo(
    () => parseWorkoutSeries(cond?.series) ?? seriesFromTimedHr(readSessionHr(sessionHr ? { __hr_session__: sessionHr } : null)?.raw) ?? seriesFromEvenHr(cond?.hr, minutes || null),
    [cond?.series, cond?.hr, sessionHr, minutes],
  );
  const stats = useMemo(() => (series ? hrStats(series) : null), [series]);
  const avgHr = stats?.avg || num(cond?.pulse) || num(fallback?.avgHr);
  const maxObserved = stats?.max || num(cond?.pulseMax) || num(fallback?.maxHr);
  const minObserved = stats?.min || num(cond?.pulseMin) || num(fallback?.minHr);
  const maxHr = maxHeartRateForZones(profile?.maxHeartRate, profile?.age, maxObserved);

  const hasHrSeries = !!series && series.hr.filter((b) => b != null).length > 1;
  const zoneSec = useMemo(() => (hasHrSeries ? zoneSeconds(series!, maxHr) : null), [series, maxHr, hasHrSeries]);
  const totalZoneSec = zoneSec ? zoneSec.reduce((a, b) => a + b, 0) : 0;
  const load = zoneSec ? trainingLoad(zoneSec) : 0;
  const speeds = useMemo(() => (series?.d && kind ? speedSeries(series) : null), [series, kind]);
  const splits = useMemo(() => (series?.d && kind ? computeSplits(series, splitLengthM(kind)) : []), [series, kind]);
  const recovery = recoveryFrom(series?.rec);

  const channels: Channel[] = [];
  if (speeds?.some((v) => v != null)) channels.push("speed");
  if (series?.pw) channels.push("power");
  if (series?.cad) channels.push("cadence");
  const [channel, setChannel] = useState<Channel | null>(null);
  const activeChannel = channel && channels.includes(channel) ? channel : channels[0] ?? null;

  const [cursor, setCursor] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const n = series?.hr.length ?? 0;
  const lo = Math.max(30, Math.min(minObserved || maxHr * 0.5, maxHr * 0.5) - 5);
  const hi = Math.max(maxHr, maxObserved) + 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const yHr = (b: number) => PAD_TOP + plotH - ((b - lo) / (hi - lo)) * plotH;
  const xAt = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);

  // Zonfärgade segment av pulskurvan.
  const hrPaths = useMemo(() => {
    if (!series || !hasHrSeries) return [];
    const segs: { zone: number; d: string }[] = [];
    let cur: { zone: number; d: string } | null = null;
    let prev: { x: number; y: number } | null = null;
    series.hr.forEach((b, i) => {
      if (b == null) { cur = null; prev = null; return; }
      const z = zoneIndex(b, maxHr);
      const x = xAt(i).toFixed(1);
      const y = yHr(b).toFixed(1);
      if (!cur || cur.zone !== z) {
        cur = { zone: z, d: prev ? `M${prev.x.toFixed(1)},${prev.y.toFixed(1)} L${x},${y}` : `M${x},${y}` };
        segs.push(cur);
      } else cur.d += ` L${x},${y}`;
      prev = { x: Number(x), y: Number(y) };
    });
    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, maxHr, hasHrSeries, lo, hi]);

  const channelValues: (number | null)[] | null =
    activeChannel === "speed" ? speeds : activeChannel === "power" ? series?.pw ?? null : activeChannel === "cadence" ? series?.cad ?? null : null;
  const channelRange = useMemo(() => {
    const vals = (channelValues ?? []).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
    if (!vals.length) return null;
    // Ytterpercentiler så att enstaka toppar inte plattar till kurvan.
    let min = vals[Math.floor(vals.length * 0.02)];
    let max = vals[Math.min(vals.length - 1, Math.ceil(vals.length * 0.98))];
    // Minsta spann 20 % så att jämnt tempo blir en lugn linje, inte förstorat brus.
    const minSpan = max * 0.2;
    if (max - min < minSpan) { const mid = (max + min) / 2; min = mid - minSpan / 2; max = mid + minSpan / 2; }
    return { min, max };
  }, [channelValues]);
  const channelPath = useMemo(() => {
    if (!channelValues || !channelRange) return "";
    const span = channelRange.max - channelRange.min || 1;
    let d = "";
    let pen = false;
    channelValues.forEach((v, i) => {
      if (v == null || !(v > 0)) { pen = false; return; }
      const c = Math.max(channelRange.min, Math.min(channelRange.max, v));
      const y = PAD_TOP + plotH - ((c - channelRange.min) / span) * plotH;
      d += `${pen ? " L" : " M"}${xAt(i).toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    });
    return d.trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelValues, channelRange, n]);

  const highlight = useMemo<Point | null>(() => {
    if (cursor == null || route.length < 2 || !series) return null;
    const d = series.d;
    const f = d && d[d.length - 1] > 0 ? d[cursor] / d[d.length - 1] : cursor / Math.max(1, n - 1);
    return pointAtFraction(route, routeCum, f);
  }, [cursor, route, routeCum, series, n]);

  if (!hasHrSeries && !avgHr && !maxObserved && route.length < 2) return null;

  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !(rect.width > 0) || n < 2 || !Number.isFinite(e.clientX)) return;
    const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCursor(Math.round(f * (n - 1)));
  };

  const fmtChannel = (v: number | null | undefined, ch: Channel | null) => {
    if (v == null || !(v > 0) || !ch) return "–";
    if (ch === "speed") return formatSpeed(v, kind ?? "run");
    if (ch === "power") return `${Math.round(v)} W`;
    return `${Math.round(v)} ${kind === "run" ? "spm" : "rpm"}`;
  };
  const channelLabel = (ch: Channel) => (ch === "speed" ? (kind === "bike" ? "Fart" : "Tempo") : ch === "power" ? "Watt" : "Kadens");

  const cursorHr = cursor != null ? series?.hr[cursor] ?? null : null;
  const timeKnown = !!series && series.t0 > 0;
  const comparisonEnabled = expanded && !!kind;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
        <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3 text-destructive" aria-hidden="true" />Snitt <b className="tabular-nums">{avgHr || "–"}</b></span>
        <span>Max <b className="tabular-nums">{maxObserved || "–"}</b></span>
        {minObserved ? <span>Lägsta <b className="tabular-nums">{minObserved}</b></span> : null}
        {load > 0 && (
          <span className="ml-auto" title="Träningsbelastning (Edwards TRIMP): minuter i pulszon × zonvikt 1–5">
            ⚡ <b className="tabular-nums">{load}</b> {loadLabel(load)}
          </span>
        )}
      </div>

      {hasHrSeries && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 min-h-[18px] text-[11px] tabular-nums" aria-live="polite">
            {cursor != null ? (
              <span className="flex flex-wrap gap-x-2">
                <b>{formatClock(cursor * series!.step)}</b>
                <span className="text-destructive">❤️ {cursorHr ?? "–"} bpm{cursorHr ? ` · ${HR_ZONES[zoneIndex(cursorHr, maxHr)].label}` : ""}</span>
                {speeds && <span>{formatSpeed(speeds[cursor], kind ?? "run")}</span>}
                {series?.pw && <span>{fmtChannel(series.pw[cursor], "power")}</span>}
                {series?.cad && <span>{fmtChannel(series.cad[cursor], "cadence")}</span>}
                {series?.d && <span className="text-muted-foreground">{(series.d[cursor] / 1000).toFixed(2).replace(".", ",")} km</span>}
              </span>
            ) : (
              <span className="text-muted-foreground">Tryck eller dra i grafen för exakta värden</span>
            )}
            {channels.length > 0 && (
              <span className="flex shrink-0 gap-1">
                {channels.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-colors ${activeChannel === ch ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                    aria-pressed={activeChannel === ch}
                  >
                    {channelLabel(ch)}
                  </button>
                ))}
              </span>
            )}
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-32 select-none"
            style={{ touchAction: "pan-y" }}
            preserveAspectRatio="none"
            role="img"
            aria-label="Puls över tid, färgad efter pulszon"
            onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); pick(e); }}
            onPointerMove={(e) => { if (e.buttons || e.pointerType === "mouse") pick(e); }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") setCursor(null); }}
          >
            {HR_ZONES.map((z, i) => {
              const top = i < HR_ZONES.length - 1 ? yHr(HR_ZONES[i + 1].min * maxHr) : PAD_TOP;
              const bottom = i === 0 ? PAD_TOP + plotH : yHr(z.min * maxHr);
              const t = Math.max(PAD_TOP, top);
              const b = Math.min(PAD_TOP + plotH, bottom);
              return b > t ? <rect key={z.label} x={0} y={t} width={W} height={b - t} fill={z.color} opacity={0.08} /> : null;
            })}
            {channelPath && (
              <path d={channelPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.7} strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            )}
            {hrPaths.map((s, i) => (
              <path key={i} d={s.d} fill="none" stroke={HR_ZONES[s.zone].color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {cursor != null && (
              <>
                <line x1={xAt(cursor)} x2={xAt(cursor)} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="hsl(var(--foreground))" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                {cursorHr != null && <circle cx={xAt(cursor)} cy={yHr(cursorHr)} r={3} fill={HR_ZONES[zoneIndex(cursorHr, maxHr)].color} stroke="hsl(var(--background))" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
              </>
            )}
            <text x={2} y={H - 3} fontSize={9} fill="hsl(var(--muted-foreground))">0:00</text>
            <text x={W - 2} y={H - 3} fontSize={9} textAnchor="end" fill="hsl(var(--muted-foreground))">{formatClock(n * series!.step)}</text>
            {activeChannel && channelRange && (
              <text x={W - 2} y={PAD_TOP + 8} fontSize={9} textAnchor="end" fill="hsl(var(--muted-foreground))">
                {activeChannel === "speed" && kind === "run" ? "Snabbast" : `${channelLabel(activeChannel)} max`} {fmtChannel(channelRange.max, activeChannel)}
              </text>
            )}
          </svg>
          {!timeKnown && <p className="text-[10px] text-muted-foreground">Äldre pass: kurvan är utspridd över passets tid.</p>}
        </div>
      )}

      {zoneSec && totalZoneSec > 0 && (
        <div className="space-y-1">
          <div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
            {zoneSec.map((s, i) => s > 0 && <div key={i} style={{ width: `${(s / totalZoneSec) * 100}%`, backgroundColor: HR_ZONES[i].color }} />)}
          </div>
          <div className="grid grid-cols-5 gap-1 text-[10px] text-center tabular-nums">
            {HR_ZONES.map((z, i) => (
              <div key={z.label} title={`${z.name}: ${Math.round(z.min * maxHr)}+ bpm`}>
                <div className="font-semibold" style={{ color: z.color }}>{z.label}</div>
                <div>{formatClock(zoneSec[i])}</div>
                <div className="text-muted-foreground">{Math.round((zoneSec[i] / totalZoneSec) * 100)}%</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Zoner från maxpuls {maxHr} bpm{profile?.maxHeartRate ? " (din profil)" : " – ange maxpuls i profilen för exaktare zoner"}</p>
        </div>
      )}

      {recovery && (
        <p className="text-[11px]">
          Återhämtning: pulsen sjönk <b className="tabular-nums">{recovery.drop}</b> slag första minuten
          <span className="text-muted-foreground"> ({recovery.end} → {recovery.at60} bpm) · {recovery.label}</span>
        </p>
      )}

      {route.length > 1 && (
        <RouteMap route={route} height={180} collapsible defaultOpen={false} highlight={highlight} />
      )}

      {kind && (splits.length > 0 || avgHr > 0) && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between text-[11px] font-semibold text-primary py-1">
          <span>{expanded ? "Dölj" : "Visa"} {splits.length > 0 ? "delsträckor och " : ""}jämförelse</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}

      {expanded && kind && splits.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] tabular-nums">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="font-medium py-0.5">{kind === "bike" ? "5 km" : "Km"}</th>
                <th className="font-medium">{kind === "bike" ? "Fart" : "Tempo"}</th>
                <th className="font-medium">Snittpuls</th>
                <th className="font-medium">Max</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((s) => (
                <tr key={s.index} className="border-t border-border/40">
                  <td className="py-0.5">{s.distM < splitLengthM(kind) ? `${(s.distM / 1000).toFixed(2).replace(".", ",")}` : kind === "bike" ? s.index * 5 : s.index}</td>
                  <td>{kind === "bike" ? `${String(s.kmh).replace(".", ",")} km/h` : `${formatPace(s.paceSecPerKm)} /km`}</td>
                  <td>
                    {s.avgHr != null ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: HR_ZONES[zoneIndex(s.avgHr, maxHr)].color }} />
                        {s.avgHr}
                      </span>
                    ) : "–"}
                  </td>
                  <td>{s.maxHr ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {comparisonEnabled && <SimilarComparison name={name} cond={cond ?? null} sessionId={sessionId} kind={kind!} fallbackAvg={avgHr} />}
    </div>
  );
}

function SimilarComparison({ name, cond, sessionId, kind, fallbackAvg }: { name: string; cond: Record<string, any> | null; sessionId?: string; kind: SportKind; fallbackAvg: number }) {
  const userId = useUserId();
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; trend: ReturnType<typeof similarTrend> }>({ status: "loading", trend: null });

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    loadHistoryCached(userId).then((sessions) => {
      if (!alive) return;
      const current = sessionId ? sessions.find((s) => s.id === sessionId) ?? null : findSessionForEntry(sessions, name, cond);
      const summary = current ? cardioSummaryFromSession(current) : null;
      const all = sessions.map(cardioSummaryFromSession).filter((s): s is NonNullable<typeof s> => !!s);
      const trend = summary && summary.sport === kind ? similarTrend({ ...summary, avgHr: summary.avgHr || fallbackAvg }, all) : null;
      setState({ status: "ready", trend });
    }).catch(() => alive && setState({ status: "error", trend: null }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sessionId, name, cond?.time, cond?.dist, cond?.pulse, kind, fallbackAvg]);

  if (state.status === "loading") return <p className="text-[10px] text-muted-foreground">Letar liknande pass…</p>;
  const t = state.trend;
  if (!t) return null;

  const hrs = t.points.map((p) => p.avgHr);
  const lo = Math.min(...hrs) - 3;
  const hi = Math.max(...hrs) + 3;
  const w = 300, h = 50;
  const x = (i: number) => (t.points.length > 1 ? (i / (t.points.length - 1)) * (w - 10) + 5 : w / 2);
  const y = (b: number) => h - 6 - ((b - lo) / (hi - lo || 1)) * (h - 12);
  const Icon = t.verdict === "better" ? TrendingDown : t.verdict === "worse" ? TrendingUp : Minus;
  const verdictText =
    t.verdict === "better" ? `${Math.abs(t.deltaBpm)} slag lägre puls än vanligt vid samma ${kind === "bike" ? "fart" : "tempo"} – formen går uppåt.`
      : t.verdict === "worse" ? `${t.deltaBpm} slag högre puls än vanligt vid samma ${kind === "bike" ? "fart" : "tempo"}. Trötthet, värme eller sjukdom kan spela in.`
        : `Ungefär samma puls som vanligt vid samma ${kind === "bike" ? "fart" : "tempo"}.`;

  return (
    <div className="space-y-1 border-t border-border/40 pt-2">
      <p className="text-[11px] font-semibold">Jämfört med liknande pass</p>
      <p className="text-[11px] flex items-start gap-1">
        <Icon className={`w-3.5 h-3.5 shrink-0 mt-px ${t.verdict === "better" ? "text-success" : t.verdict === "worse" ? "text-destructive" : "text-muted-foreground"}`} aria-hidden="true" />
        <span>{verdictText}</span>
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" role="img" aria-label="Snittpuls i liknande pass över tid">
        <polyline points={t.points.map((p, i) => `${x(i).toFixed(1)},${y(p.avgHr).toFixed(1)}`).join(" ")} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={1.2} />
        {t.points.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.avgHr)} r={p.current ? 4 : 2.5} fill={p.current ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}>
            <title>{`${p.date}: ${p.avgHr} bpm, ${kind === "bike" ? `${p.speedKmh} km/h` : `${formatPace(3600 / p.speedKmh)} /km`}`}</title>
          </circle>
        ))}
      </svg>
      <p className="text-[10px] text-muted-foreground">
        {t.points.length} pass med liknande {kind === "bike" ? "fart" : "tempo"} och distans. Vanlig snittpuls {t.baselineHr} bpm.
      </p>
    </div>
  );
}
