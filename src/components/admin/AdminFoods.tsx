import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { gramsForFood } from "@/lib/nutritionCalc";

type Food = { id: string; name: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number; sugar_g: number | null; suitable_units: string[] | null; density_g_per_dl: number | null; default_piece_weight_g: number | null };
const ALL_UNITS = ["g", "kg", "dl", "ml", "msk", "tsk", "st", "portion", "skiva", "näve", "filé"];
type Fix = Omit<Food, "name"> & { confidence: string; comment: string };
const FIELDS: [keyof Food, string][] = [["kcal", "kcal"], ["protein_g", "Prot."], ["fat_g", "Fett"], ["carbs_g", "Kolh."], ["fiber_g", "Fiber"]];

/** Energy that the macros imply, per 100 g. */
const macroKcal = (f: Food) => 4 * f.protein_g + 9 * f.fat_g + 4 * f.carbs_g + 2 * (f.fiber_g || 0);
const suspicious = (f: Food) => {
  const m = macroKcal(f);
  return f.kcal > 900 || f.protein_g + f.fat_g + f.carbs_g > 101 || Math.abs(f.kcal - m) > Math.max(25, f.kcal * 0.2);
};

export default function AdminFoods() {
  const [q, setQ] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixes, setFixes] = useState<Record<string, Fix>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<Food>>>({});

  const cols = "id,name,kcal,protein_g,fat_g,carbs_g,fiber_g,sugar_g,suitable_units,density_g_per_dl,default_piece_weight_g";
  const search = async () => {
    setLoading(true); setFixes({});
    const { data, error } = await supabase.from("foods").select(cols).ilike("name", `%${q.trim()}%`).or("group_name.is.null,group_name.neq.Rätter").order("name").limit(50);
    setLoading(false);
    if (error) return toast.error(error.message);
    setFoods((data || []) as Food[]);
  };
  const findSuspicious = async () => {
    setLoading(true); setFixes({});
    const all: Food[] = [];
    for (let from = 0; from < 6000; from += 1000) {
      const { data } = await supabase.from("foods").select(cols).or("group_name.is.null,group_name.neq.Rätter").range(from, from + 999);
      if (!data?.length) break;
      all.push(...(data as Food[]));
      if (data.length < 1000) break;
    }
    setLoading(false);
    const bad = all.filter(suspicious);
    setFoods(bad.slice(0, 100));
    toast(bad.length ? `${bad.length} livsmedel ser felaktiga ut${bad.length > 100 ? " (visar 100)" : ""}` : "Inga uppenbart felaktiga livsmedel");
  };

  const aiCheck = async () => {
    const batch = foods.slice(0, 25);
    if (!batch.length) return;
    setAiBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-food-fix", { body: { foods: batch } });
    setAiBusy(false);
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = (await error.context.json()).error || msg; } catch { /* ignore */ } }
      return toast.error(msg);
    }
    const map: Record<string, Fix> = {};
    for (const it of data?.items || []) map[it.id] = it;
    setFixes(map);
    toast.success(`AI granskade ${batch.length} livsmedel`);
  };

  const save = async (id: string, patch: Partial<Food>) => {
    const old = foods.find((f) => f.id === id);
    const { error } = await supabase.from("foods").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (old) {
      const next = { ...old, ...patch };
      const dl = (f: Food) => gramsForFood(1, "dl", f.name, f.default_piece_weight_g, f.density_g_per_dl);
      const st = (f: Food) => gramsForFood(1, "st", f.name, f.default_piece_weight_g, f.density_g_per_dl);
      const volRatio = dl(old) > 0 ? dl(next) / dl(old) : 1;
      const pieceRatio = st(old) > 0 ? st(next) / st(old) : 1;
      if (Math.abs(volRatio - 1) > 1e-6 || Math.abs(pieceRatio - 1) > 1e-6) {
        const { error: rErr } = await supabase.rpc("admin_rescale_recipe_food_units", { p_food_id: id, p_vol_ratio: volRatio, p_piece_ratio: pieceRatio });
        if (rErr) toast.error("Livsmedlet sparades, men recepten kunde inte räknas om: " + rErr.message);
      }
    }
    setFoods((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setFixes((m) => { const n = { ...m }; delete n[id]; return n; });
    setEdits((m) => { const n = { ...m }; delete n[id]; return n; });
    toast.success("Sparat för alla – recept med livsmedlet är uppdaterade");
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Sök livsmedel" />
        <Button size="sm" onClick={search} disabled={loading}>Sök</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={findSuspicious} disabled={loading}>Hitta felaktiga värden</Button>
        <Button size="sm" variant="outline" onClick={aiCheck} disabled={aiBusy || !foods.length}>
          {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Rätta med AI {foods.length > 25 ? "(25 första)" : ""}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Värden per 100 g. AI föreslår rättelser enligt Livsmedelsverket — inget sparas förrän du trycker Använd.</p>
      {loading && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
      <ul className="divide-y divide-border">
        {foods.map((f) => {
          const fix = fixes[f.id];
          const e = edits[f.id] || {};
          const cur = { ...f, ...e };
          return (
            <li key={f.id} className="py-2 space-y-1">
              <p className="font-medium">{f.name} {suspicious(cur) && <span className="text-[10px] text-destructive">· makrona ger {Math.round(macroKcal(cur))} kcal</span>}</p>
              <div className="grid grid-cols-5 gap-1">
                {FIELDS.map(([k, label]) => (
                  <label key={k} className="text-[10px] text-muted-foreground">{label}
                    <Input className="h-7 px-1 text-xs" inputMode="decimal" value={String(cur[k] ?? "")}
                      onChange={(ev) => setEdits((m) => ({ ...m, [f.id]: { ...m[f.id], [k]: Number(ev.target.value.replace(",", ".")) || 0 } }))} />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                <label className="text-[10px] text-muted-foreground">g per dl
                  <Input className="h-7 px-1 text-xs w-20 inline-block ml-1" inputMode="decimal" placeholder="auto"
                    value={cur.density_g_per_dl != null ? String(cur.density_g_per_dl) : ""}
                    onChange={(ev) => {
                      const raw = ev.target.value.trim().replace(",", ".");
                      const v = raw === "" ? null : Number(raw);
                      if (raw !== "" && (!Number.isFinite(v) || v! <= 0 || v! > 2000)) return toast.error("Ange gram per dl, t.ex. 40 för proteinpulver");
                      setEdits((m) => ({ ...m, [f.id]: { ...m[f.id], density_g_per_dl: v } }));
                    }} />
                </label>
                <label className="text-[10px] text-muted-foreground">g per st
                  <Input className="h-7 px-1 text-xs w-20 inline-block ml-1" inputMode="decimal" placeholder="auto"
                    value={cur.default_piece_weight_g != null ? String(cur.default_piece_weight_g) : ""}
                    onChange={(ev) => {
                      const raw = ev.target.value.trim().replace(",", ".");
                      const v = raw === "" ? null : Number(raw);
                      if (raw !== "" && (!Number.isFinite(v) || v! <= 0 || v! > 5000)) return toast.error("Ange gram per styck, t.ex. 55 för ett ägg");
                      setEdits((m) => ({ ...m, [f.id]: { ...m[f.id], default_piece_weight_g: v } }));
                    }} />
                </label>
                {(cur.density_g_per_dl == null || cur.default_piece_weight_g == null) && <span className="text-[9px] text-muted-foreground">(tomt = auto från namnet)</span>}
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                <span className="text-[10px] text-muted-foreground">Enheter:</span>
                {ALL_UNITS.map((u) => {
                  const active = cur.suitable_units ? cur.suitable_units.includes(u) : ["g", "kg", "dl", "ml", "msk", "tsk", "st", "portion"].includes(u);
                  return (
                    <button key={u} type="button"
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border ${active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                      onClick={() => {
                        const base = cur.suitable_units ?? ["g", "kg", "dl", "ml", "msk", "tsk", "st", "portion"];
                        const next = active ? base.filter((x) => x !== u) : [...base, u];
                        if (!next.length) return toast.error("Minst en enhet måste vara kvar");
                        setEdits((m) => ({ ...m, [f.id]: { ...m[f.id], suitable_units: next } }));
                      }}>
                      {u}
                    </button>
                  );
                })}
                {!cur.suitable_units && <span className="text-[9px] text-muted-foreground">(auto från namnet)</span>}
              </div>
              {Object.keys(e).length > 0 && <Button size="sm" onClick={() => save(f.id, e)}>Spara ändring</Button>}
              {fix && (
                <div className="rounded-xl bg-muted p-2 text-xs space-y-1">
                  <p>AI ({fix.confidence}): {Math.round(fix.kcal)} kcal · P {fix.protein_g} · F {fix.fat_g} · K {fix.carbs_g} · Fib {fix.fiber_g}</p>
                  <p className="text-muted-foreground">{fix.comment}</p>
                  {fix.comment.trim().toUpperCase() !== "OK" && (
                    <Button size="sm" onClick={() => save(f.id, { kcal: Math.round(fix.kcal), protein_g: fix.protein_g, fat_g: fix.fat_g, carbs_g: fix.carbs_g, fiber_g: fix.fiber_g, ...(fix.sugar_g != null ? { sugar_g: fix.sugar_g } : {}) })}>Använd</Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
