import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Merge, AlertTriangle } from "lucide-react";

type NameRow = { name: string; sources: string[]; count: number };

const ExerciseMergeManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<NameRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [targetName, setTargetName] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const loadNames = async () => {
    setLoading(true);
    const map = new Map<string, NameRow>();
    const add = (name: string, source: string) => {
      const trimmed = (name || "").trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.sources.includes(source)) existing.sources.push(source);
      } else {
        map.set(key, { name: trimmed, sources: [source], count: 1 });
      }
    };

    const [ce, pro, emo, egm, wc] = await Promise.all([
      supabase.from("custom_exercises").select("name"),
      supabase.from("pr_overrides").select("exercise"),
      supabase.from("exercise_muscle_overrides").select("exercise_name"),
      supabase.from("exercise_gif_mappings").select("exercise_name"),
      supabase.from("workout_completions").select("logged_weights").not("logged_weights", "is", null).limit(5000),
    ]);

    (ce.data || []).forEach((r: any) => add(r.name, "Custom"));
    (pro.data || []).forEach((r: any) => add(r.exercise, "PR"));
    (emo.data || []).forEach((r: any) => add(r.exercise_name, "Muskler"));
    (egm.data || []).forEach((r: any) => add(r.exercise_name, "Gif"));
    (wc.data || []).forEach((r: any) => {
      const lw = r.logged_weights;
      if (lw && typeof lw === "object") {
        Object.keys(lw).forEach((k) => add(k, "Loggat"));
      }
    });

    const arr = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "sv"));
    setNames(arr);
    setLoading(false);
  };

  useEffect(() => {
    loadNames();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return names;
    return names.filter((n) => n.name.toLowerCase().includes(q));
  }, [names, search]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const exists = prev.includes(name);
      const next = exists ? prev.filter((n) => n !== name) : [...prev, name];
      if (!exists && !targetName && !customTarget) setTargetName(name);
      if (exists && targetName === name) setTargetName(next[0] || "");
      return next;
    });
  };

  const effectiveTarget = (customTarget.trim() || targetName).trim();

  const handleMerge = async () => {
    if (selected.length < 2) {
      toast({ title: "Välj minst två övningar", variant: "destructive" });
      return;
    }
    if (!effectiveTarget) {
      toast({ title: "Välj eller skriv ett målnamn", variant: "destructive" });
      return;
    }
    if (!confirm(`Slå ihop ${selected.length} övningar till «${effectiveTarget}»?\n\nDetta kan inte ångras.`)) return;
    setRunning(true);
    const { data, error } = await supabase.rpc("admin_merge_exercises" as any, {
      p_from: selected,
      p_to: effectiveTarget,
    });
    setRunning(false);
    if (error) {
      toast({ title: "Fel vid sammanslagning", description: error.message, variant: "destructive" });
      return;
    }
    setLastResult(data);
    toast({ title: "Övningar sammanslagna", description: `Resultat: ${JSON.stringify(data)}` });
    setSelected([]);
    setTargetName("");
    setCustomTarget("");
    await loadNames();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 text-warning-foreground text-xs">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
        <div>
          <strong>Slå ihop dubblettövningar.</strong> All loggad data flyttas och summeras under det valda målnamnet. Detta går inte att ångra.
        </div>
      </div>

      <Input
        placeholder="Sök övning…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar övningar…
        </div>
      ) : (
        <div className="border border-border max-h-80 overflow-y-auto divide-y divide-border">
          {filtered.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Inga övningar matchar.</div>
          )}
          {filtered.map((row) => {
            const isSel = selected.includes(row.name);
            return (
              <label
                key={row.name}
                className={`flex items-center gap-3 p-2.5 cursor-pointer text-sm ${isSel ? "bg-primary/10" : "hover:bg-secondary/60"}`}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(row.name)}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{row.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {row.count}× · {row.sources.join(", ")}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="space-y-3 p-3 border border-border bg-secondary/30">
          <div className="text-xs font-semibold text-muted-foreground uppercase">
            Valda ({selected.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((n) => (
              <span key={n} className="text-xs px-2 py-1 bg-primary/15 text-primary">
                {n}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold">Välj målnamn:</div>
            {selected.map((n) => (
              <label key={n} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  checked={!customTarget && targetName === n}
                  onChange={() => {
                    setTargetName(n);
                    setCustomTarget("");
                  }}
                />
                <span>{n}</span>
              </label>
            ))}
            <div className="pt-1">
              <Input
                placeholder="…eller skriv ett nytt namn"
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleMerge} disabled={running || !effectiveTarget} className="w-full">
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Merge className="h-4 w-4 mr-2" />}
            Slå ihop till «{effectiveTarget || "—"}»
          </Button>
        </div>
      )}

      {lastResult && (
        <pre className="text-[11px] bg-secondary/50 p-2 overflow-x-auto">
          {JSON.stringify(lastResult, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default ExerciseMergeManager;
