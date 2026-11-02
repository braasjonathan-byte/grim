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
