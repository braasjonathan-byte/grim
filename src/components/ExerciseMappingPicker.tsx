import { useState } from "react";
import { Loader2, Search, X, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Result { name: string; gifUrl: string | null }

interface Props {
  exerciseName: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Sökbar lista över övningsdatabasens engelska namn med förhandsbild, plus "Ingen koppling". */
export default function ExerciseMappingPicker({ exerciseName, onClose, onSaved }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const search = async () => {
    if (q.trim().length < 2) return;
    setSearching(true);
    const { data, error } = await supabase.functions.invoke("search-exercisedb", { body: { query: q.trim() } });
    setSearching(false);
    if (error) { toast.error("Sökningen misslyckades"); return; }
    setResults((data?.results || []) as Result[]);
  };

  const save = async (r: Result | null) => {
    setSaving(true);
    const { error } = await supabase.functions.invoke("exercise-gif", {
      body: { exerciseName, action: "set_mapping", exercisedbName: r?.name ?? null, gifUrl: r?.gifUrl ?? null },
    });
    setSaving(false);
    if (error) { toast.error("Kunde inte spara kopplingen"); return; }
    toast.success(r ? `Kopplad till ${r.name}` : "Kopplingen togs bort");
    onSaved();
  };

  return (
    <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold">Ändra koppling</h4>
        <button onClick={onClose} aria-label="Stäng" className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder="Sök engelskt namn, t.ex. trap bar deadlift"
          className="flex-1 bg-secondary text-sm p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary"
        />
        <button onClick={search} disabled={searching} className="px-3 rounded-lg bg-primary text-primary-foreground" aria-label="Sök">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>
      <button
        onClick={() => save(null)}
        disabled={saving}
        className="w-full flex items-center gap-2 p-2 rounded-lg bg-secondary text-sm font-medium disabled:opacity-50"
      >
        <Ban className="w-4 h-4 text-muted-foreground" /> Ingen koppling
      </button>
      <ul className="max-h-72 overflow-y-auto divide-y divide-border">
        {results.map((r) => (
          <li key={r.name}>
            <button onClick={() => save(r)} disabled={saving} className="w-full flex items-center gap-3 py-2 text-left disabled:opacity-50">
              {r.gifUrl
                ? <img src={r.gifUrl} alt="" className="w-12 h-12 rounded-md object-cover bg-secondary flex-shrink-0" loading="lazy" />
                : <div className="w-12 h-12 rounded-md bg-secondary flex-shrink-0" />}
              <span className="text-sm capitalize">{r.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
