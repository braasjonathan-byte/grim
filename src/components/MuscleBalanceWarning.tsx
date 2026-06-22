import { useEffect, useState } from "react";
import { AlertTriangle, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";

interface Props {
  userId: string;
}

type Category = "push" | "pull" | "ben";

const PUSH_GROUPS = new Set(["Bröst", "Axlar", "Triceps"]);
const PULL_GROUPS = new Set(["Rygg", "Biceps"]);
const LEG_GROUPS = new Set(["Ben", "Vader", "Säte"]);

const labelMap: Record<Category, string> = {
  push: "Tryck (bröst/axlar/triceps)",
  pull: "Drag (rygg/biceps)",
  ben: "Ben",
};

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

const safelyParseSets = (value: any): Array<any> => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalize = (s: string) => s.trim().toLowerCase();

const MuscleBalanceWarning = ({ userId }: Props) => {
  const [counts, setCounts] = useState<Record<Category, number>>({ push: 0, pull: 0, ben: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const groupToCat = (group?: string | null): Category | null => {
        if (!group) return null;
        if (PUSH_GROUPS.has(group)) return "push";
        if (PULL_GROUPS.has(group)) return "pull";
        if (LEG_GROUPS.has(group)) return "ben";
        return null;
      };

      // Build exercise -> category map from library
      const exToCat = new Map<string, Category>();
      for (const e of exerciseLibrary) {
        const cat = groupToCat((e as any).muscleGroup);
        if (cat) exToCat.set(normalize(e.name), cat);
      }

      // Add user's custom exercises so they aren't ignored
      const { data: customs } = await supabase
        .from("custom_exercises")
        .select("name, muscle_group");
      for (const c of customs || []) {
        const cat = groupToCat((c as any).muscle_group);
        if (cat) exToCat.set(normalize((c as any).name), cat);
      }

      const cutoff = new Date(Date.now() - FOUR_WEEKS_MS).toISOString();
      const { data } = await supabase
        .from("workout_completions")
        .select("logged_weights, updated_at")
        .eq("user_id", userId)
        .eq("done", true)
        .gte("updated_at", cutoff)
        .limit(500);

      const tally: Record<Category, number> = { push: 0, pull: 0, ben: 0 };
      for (const row of data || []) {
        const weights = row.logged_weights as Record<string, any> | null;
        if (!weights || typeof weights !== "object") continue;
        for (const [key, value] of Object.entries(weights)) {
          if (!key.startsWith("__setdata__")) continue;
          const name = key.replace(/^__setdata__/, "");
          const cat = exToCat.get(normalize(name));
          if (!cat) continue;
          const sets = safelyParseSets(value);
          // Prefer __sets__ marker string ("1"/"0" per set) when present.
          const marker = weights[`__sets__${name}`];
          const markerStr = typeof marker === "string" ? marker : "";
          let done = 0;
          if (markerStr) {
            for (let i = 0; i < sets.length; i++) {
              if (markerStr[i] === "1") done += 1;
            }
          } else {
            for (const s of sets) {
              if ((Number(s?.reps) || 0) > 0 || (Number(s?.kg) || 0) > 0) done += 1;
            }
          }
          tally[cat] += done;
        }
      }
      if (!cancelled) {
        setCounts(tally);
        setLoaded(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!loaded) return null;

  const total = counts.push + counts.pull + counts.ben;
  if (total < 10) return null; // not enough data

  // Find the lowest category and check if it's >30% below the avg of the others
  const entries = (Object.keys(counts) as Category[]).map((k) => ({ cat: k, value: counts[k] }));
  entries.sort((a, b) => a.value - b.value);
  const lowest = entries[0];
  const others = entries.slice(1);
  const othersAvg = others.reduce((s, e) => s + e.value, 0) / others.length;
  if (othersAvg === 0) return null;

  const ratio = lowest.value / othersAvg;
  if (ratio >= 0.7) return null; // within 30% — balanced

  const percentBelow = Math.round((1 - ratio) * 100);

  return (
    <div className="border-2 border-amber-500 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-amber-700 dark:text-amber-300">Obalans senaste 4 veckorna</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            <span className="font-bold text-foreground">{labelMap[lowest.cat]}</span> ligger {percentBelow}% under snittet för dina andra kategorier.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <Scale className="w-3 h-3 text-muted-foreground" />
        <span>Tryck: <span className="font-bold">{counts.push}</span></span>
        <span>·</span>
        <span>Drag: <span className="font-bold">{counts.pull}</span></span>
        <span>·</span>
        <span>Ben: <span className="font-bold">{counts.ben}</span></span>
        <span className="text-muted-foreground">set</span>
      </div>
    </div>
  );
};

export default MuscleBalanceWarning;
