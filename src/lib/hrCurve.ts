/** Pulskurva: nedsampling och zonfördelning (zoner = % av maxpuls, samma som PulseZoneCalculator). */
export const HR_ZONES = [
  { label: "Z1", name: "Återhämtning", min: 0.5, color: "#60a5fa" },
  { label: "Z2", name: "Grunduthållighet", min: 0.6, color: "#4ade80" },
  { label: "Z3", name: "Aerob", min: 0.7, color: "#facc15" },
  { label: "Z4", name: "Tröskel", min: 0.8, color: "#fb923c" },
  { label: "Z5", name: "Max", min: 0.9, color: "#f87171" },
] as const;

/** Medelvärdesbildar en pulsserie till högst maxPoints punkter. */
export function downsampleHr(samples: { timestamp: string; bpm: number }[], maxPoints = 90): number[] {
  const s = samples
    .filter((x) => Number.isFinite(x.bpm) && x.bpm > 25 && x.bpm < 240)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((x) => x.bpm);
  if (s.length <= maxPoints) return s.map(Math.round);
  const out: number[] = [];
  const step = s.length / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    const chunk = s.slice(Math.floor(i * step), Math.max(Math.floor(i * step) + 1, Math.floor((i + 1) * step)));
    out.push(Math.round(chunk.reduce((a, b) => a + b, 0) / chunk.length));
  }
  return out;
}

/**
 * Returnerar maxpulsen som zonerna ska bygga på. En sparad maxpuls går alltid
 * före åldersuppskattningen; utan den behålls den tidigare uppskattningen.
 */
export function maxHeartRateForZones(configured?: number | null, age?: number | null, observedMax = 0): number {
  if (configured != null && Number.isFinite(configured) && configured >= 80 && configured <= 230) return configured;
  const estimated = age != null && Number.isFinite(age) ? 220 - age : 190;
  return Math.max(estimated, observedMax || 0);
}

/** Andel (0–1) av punkterna i varje zon; under Z1 räknas till Z1. */
export function zoneShares(hr: number[], maxHr: number): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const b of hr) {
    const pct = b / maxHr;
    let z = 0;
    for (let i = HR_ZONES.length - 1; i >= 0; i--) if (pct >= HR_ZONES[i].min) { z = i; break; }
    counts[z]++;
  }
  return counts.map((c) => (hr.length ? c / hr.length : 0));
}

/**
 * Relativ ansträngning (Strava-inspirerad, förenklad TRIMP): minuter i zon × zonvikt.
 * Vikter Z1–Z5 = 1,2,3,4,5 → 45 min jämnt i Z2 ≈ 90.
 */
export function relativeEffort(shares: number[], minutes: number): number {
  if (!(minutes > 0)) return 0;
  return Math.round(shares.reduce((sum, s, i) => sum + s * minutes * (i + 1), 0));
}
export function effortLabel(score: number): string {
  if (score < 50) return "Lätt";
  if (score < 120) return "Måttlig";
  if (score < 200) return "Tuff";
  return "Mycket tuff";
}
