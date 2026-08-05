interface Props {
  /** Höjd i meter för varje punkt längs rutten. */
  elevations: number[];
  /** Total distans i km – används för x-axelns etiketter. */
  distanceKm: number;
  height?: number;
}

/** Enkel höjdprofil som SVG-area, färgad med temats primärfärg. */
const ElevationProfile = ({ elevations, distanceKm, height = 84 }: Props) => {
  const pts = elevations.filter((e) => Number.isFinite(e));
  if (pts.length < 2) return null;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const W = 300;
  const H = 100;
  const pad = 6;

  const coords = pts.map((e, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = pad + (1 - (e - min) / span) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>Höjdprofil</span>
        <span className="tabular-nums">
          {Math.round(min)}–{Math.round(max)} m ö.h.
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height, width: "100%" }} role="img" aria-label="Höjdprofil">
        <polygon points={`0,${H} ${coords.join(" ")} ${W},${H}`} className="fill-primary/20" />
        <polyline points={coords.join(" ")} className="stroke-primary" fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>0 km</span>
        <span>{(distanceKm / 2).toFixed(1)} km</span>
        <span>{distanceKm.toFixed(1)} km</span>
      </div>
    </div>
  );
};

export default ElevationProfile;
