import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ReadyWorkoutCategory } from "@/data/readyWorkouts";
import { readyWorkoutCategories } from "@/data/readyWorkouts";
import { resetReadyWorkouts, saveReadyWorkouts, useLiveContentReady, useReadyWorkouts } from "@/lib/liveContent";

const clone = (list: ReadyWorkoutCategory[]): ReadyWorkoutCategory[] =>
  list.map((c) => ({ ...c, workouts: c.workouts.map((w) => ({ ...w })) }));

export default function AdminReadyContent({ userId }: { userId: string }) {
  const live = useReadyWorkouts();
  const ready = useLiveContentReady();
  const [draft, setDraft] = useState<ReadyWorkoutCategory[] | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<{ c: number; w: number } | null>(null);
  const [catName, setCatName] = useState("");

  useEffect(() => { if (ready && !draft) setDraft(clone(live)); }, [ready, live, draft]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!draft) return [];
    return draft.flatMap((cat, c) => cat.workouts.map((w, wIndex) => ({ c, w: wIndex, cat: cat.label, name: w.name })))
      .filter((row) => !needle || `${row.cat} ${row.name}`.toLowerCase().includes(needle));
  }, [draft, q]);

  if (!draft) return null;
  const current = pick ? draft[pick.c]?.workouts[pick.w] : null;

  const update = (patch: Partial<{ name: string; details: string; tempo: string }>) => {
    if (!pick) return;
    setDraft((list) => list!.map((cat, ci) => ci !== pick.c ? cat : {
      ...cat,
      workouts: cat.workouts.map((w, wi) => wi === pick.w ? { ...w, ...patch } : w),
    }));
  };

  const save = async (next = draft) => {
    try {
      await saveReadyWorkouts(next, userId);
      toast.success("Färdiga pass är uppdaterade för alla");
    } catch (e: any) { toast.error(e?.message || "Kunde inte spara"); }
  };

  const remove = () => {
    if (!pick) return;
    const next = draft.map((cat, ci) => ci !== pick.c ? cat : { ...cat, workouts: cat.workouts.filter((_, wi) => wi !== pick.w) })
      .filter((cat) => cat.workouts.length);
    setDraft(next);
    setPick(null);
  };

  if (current && pick) {
    return (
      <div className="space-y-2 text-sm">
        <button type="button" className="text-xs font-semibold text-primary" onClick={() => setPick(null)}>Tillbaka</button>
        <Input value={current.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} />
        <Input value={current.tempo} maxLength={40} placeholder="Tempo, valfritt" onChange={(e) => update({ tempo: e.target.value })} />
        <p className="text-[11px] text-muted-foreground">En övning per rad, t.ex. Knäböj 4×8</p>
        <Textarea rows={10} value={current.details} onChange={(e) => update({ details: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => save()}>Spara för alla</Button>
          <Button size="sm" variant="outline" onClick={remove}>Ta bort passet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-[11px] text-muted-foreground">Ändra övningarna i biblioteket med färdiga pass. Syns när någon hämtar ett pass.</p>
      <Input value={q} placeholder="Sök pass" onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-border">
        {filtered.map((row) => (
          <li key={`${row.c}-${row.w}`}>
            <button type="button" className="w-full py-2 text-left" onClick={() => setPick({ c: row.c, w: row.w })}>
              <span className="block font-medium">{row.name}</span>
              <span className="block text-[11px] text-muted-foreground">{row.cat}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input value={catName} maxLength={40} placeholder="Ny kategori" onChange={(e) => setCatName(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => {
          const label = catName.trim();
          if (!label) return;
          setDraft([...draft, { label, emoji: "🏋️", workouts: [{ name: "Nytt pass", details: "", tempo: "" }] }]);
          setCatName("");
          setPick({ c: draft.length, w: 0 });
        }}>Lägg till</Button>
      </div>
      <Button size="sm" variant="outline" onClick={async () => {
        try {
          await resetReadyWorkouts();
          setDraft(clone(readyWorkoutCategories));
          toast.success("Återställt till originalet");
        } catch (e: any) { toast.error(e?.message || "Kunde inte återställa"); }
      }}>Återställ alla original</Button>
    </div>
  );
}
