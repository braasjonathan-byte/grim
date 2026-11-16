import { compareSparring, readSparring, sparringSet } from "@/lib/workoutSparring";
import { summarizeCompletion, formatCardioDistance } from "@/lib/workoutSummary";

export function SparringSetNote({ reference, name, index }: { reference: unknown; name: string; index: number }) {
  const r = readSparring(reference), row = sparringSet(r?.logged_weights ?? null, name, index);
  return row ? <p className="text-xs text-muted-foreground py-1">Kompisens facit: {row.kg} kg × {row.reps}</p> : null;
}
export default function SparringSummary({ reference, weights, details, done }: { reference: unknown; weights: unknown; details: string; done: boolean }) {
  const r = readSparring(reference);
  if (!r) return null;
  const result = compareSparring(r, weights && typeof weights === "object" ? weights as Record<string, unknown> : {}, details);
  const cardio = summarizeCompletion(r.logged_weights).cardio;
  return <section aria-label="Kompisens facit" className="border-y border-border py-3 space-y-1">
    <h4 className="font-semibold text-sm">Mot {r.nickname || "kompisens pass"}</h4>
    {cardio && <p className="text-xs text-muted-foreground">Facit: {cardio.primaryName} · {formatCardioDistance(cardio.distanceKm, cardio.primaryName)} · {cardio.minutes.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} min</p>}
    {done && <><p className="text-sm">{result.higher} set med högre vikt · {result.matched} matchade · {result.compared} jämförbara</p><p className="text-xs text-muted-foreground">Samma övning, setposition och reps. Ändrade reps och kroppsvikts-/tidsövningar poängsätts inte.</p>{result.cardio && <p className="text-sm">{result.cardio}</p>}</>}
  </section>;
}