import { useAccessLevel } from "@/hooks/useAccessLevel";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Plus, Loader2, ScanBarcode, Utensils, PencilLine, Sparkles, Pencil } from "lucide-react";
import { UNITS, gramsForFood, unitHint, pieceWeightFor, DEFAULT_PIECE_G, naturalUnitsFor } from "@/lib/nutritionCalc";

const LAST_AMOUNT_KEY = "grim_food_last_amount";
function readLastAmounts(): Record<string, { amount: string; unit: string }> {
  try { return JSON.parse(localStorage.getItem(LAST_AMOUNT_KEY) || "{}"); } catch { return {}; }
}
function saveLastAmount(key: string, amount: string, unit: string) {
  try {
    const all = readLastAmounts();
    all[key] = { amount, unit };
    const keys = Object.keys(all);
    if (keys.length > 300) delete all[keys[0]];
    localStorage.setItem(LAST_AMOUNT_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
import BarcodeScannerDialog from "./BarcodeScannerDialog";
import RestaurantSearchDialog from "./RestaurantSearchDialog";
import ManualFoodDialog from "./ManualFoodDialog";
import { MICRO_SELECT, microsFromOFF, pickMicros, scaleMicros, type Micros } from "@/lib/micronutrients";
import { rankFoods, usageKey, type UsageMap } from "@/lib/foodRanking";

export interface PickedItem {
  source: "food" | "custom_food" | "recipe";
  id: string;
  name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
  micros?: Micros;
}

interface FoodPickerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: PickedItem, opts?: { keepOpen?: boolean }) => void;
  userId: string;
  /** If true, recipes are hidden (used when building a recipe) */
  hideRecipes?: boolean;
  /** Optional: called when the user taps the edit pencil on one of their own recipes */
  onEditRecipe?: (recipeId: string) => void;
}

type FoodRow = { id: string; name: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number | null; piece_g?: number | null; group_name?: string | null; source: "food" | "custom_food" | "recipe" | "off"; servings?: number; brand?: string; owner_id?: string | null; [k: string]: any };

function recipeRow(r: any): FoodRow {
  return {
    id: r.id, name: r.name, source: "recipe",
    kcal: Number(r.kcal_per_serving) || 0,
    protein_g: Number(r.protein_g_per_serving) || 0,
    fat_g: Number(r.fat_g_per_serving) || 0,
    carbs_g: Number(r.carbs_g_per_serving) || 0,
    servings: Number(r.servings) || 1,
    owner_id: r.user_id || null,
  };
}

export default function FoodPickerDialog({ open, onOpenChange, onPick, userId, hideRecipes, onEditRecipe }: FoodPickerDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoodRow | null>(null);
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<string>("g");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [restaurantOpen, setRestaurantOpen] = useState(false);
  const { isHonorary } = useAccessLevel();
  const [addedCount, setAddedCount] = useState(0);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  useEffect(() => { if (!open) { setAddedCount(0); setLastAdded(null); } }, [open]);


  const [usage, setUsage] = useState<UsageMap>(new Map());
  const [personal, setPersonal] = useState<FoodRow[]>([]);

  // Load personal usage stats + build "Dina vanliga" list
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("food_usage_stats")
        .select("food_source,food_id,use_count,last_used_at")
        .eq("user_id", userId)
        .order("last_used_at", { ascending: false })
        .limit(300);
      if (cancelled || !data) return;
      const map: UsageMap = new Map();
      for (const u of data) map.set(usageKey(u.food_source, u.food_id), { count: u.use_count, last: new Date(u.last_used_at).getTime() });
      setUsage(map);

      // 10 most recent + 10 most frequent (deduped)
      const recent = data.slice(0, 10);
      const frequent = [...data].sort((a, b) => b.use_count - a.use_count).filter((u) => !recent.includes(u)).slice(0, 10);
      const picks = [...recent, ...frequent].filter((u) => !(hideRecipes && u.food_source === "recipe"));
      const ids = (s: string) => picks.filter((p) => p.food_source === s).map((p) => p.food_id);
      const [fR, cR, rR] = await Promise.all([
        ids("food").length ? supabase.from("foods").select(`id,name,kcal,protein_g,fat_g,carbs_g,fiber_g,default_piece_weight_g,group_name,${MICRO_SELECT}`).in("id", ids("food")) : Promise.resolve({ data: [] as any[] }),
        ids("custom_food").length ? supabase.from("custom_foods").select(`id,name,kcal,protein_g,fat_g,carbs_g,fiber_g,${MICRO_SELECT}`).in("id", ids("custom_food")) : Promise.resolve({ data: [] as any[] }),
        ids("recipe").length ? supabase.from("recipes").select("id,name,kcal_per_serving,protein_g_per_serving,fat_g_per_serving,carbs_g_per_serving,user_id,servings").in("id", ids("recipe")) : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancelled) return;
      const byKey = new Map<string, FoodRow>();
      for (const f of (fR.data || []) as any[]) byKey.set(usageKey("food", f.id), { ...f, piece_g: f.default_piece_weight_g, source: "food" });
      for (const c of (cR.data || []) as any[]) byKey.set(usageKey("custom_food", c.id), { ...c, source: "custom_food" });
      for (const r of (rR.data || []) as any[]) byKey.set(usageKey("recipe", r.id), recipeRow(r));
      setPersonal(picks.map((p) => byKey.get(usageKey(p.food_source, p.food_id))).filter(Boolean) as FoodRow[]);
    })();
    return () => { cancelled = true; };
  }, [open, userId, hideRecipes]);

  // search
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const term = query.trim();
    setLoading(true);
    (async () => {
      const foodsQ = term
        ? supabase.from("foods").select(`id,name,kcal,protein_g,fat_g,carbs_g,fiber_g,default_piece_weight_g,group_name,${MICRO_SELECT}`).ilike("name", `%${term}%`).order("name").limit(40)
        : supabase.from("foods").select(`id,name,kcal,protein_g,fat_g,carbs_g,fiber_g,default_piece_weight_g,group_name,${MICRO_SELECT}`).order("name").limit(40);
      let customQ = supabase.from("custom_foods").select(`id,name,kcal,protein_g,fat_g,carbs_g,fiber_g,${MICRO_SELECT}`).eq("user_id", userId);
      if (term) customQ = customQ.ilike("name", `%${term}%`);
      const recipesQ = hideRecipes ? null : supabase
        .from("recipes")
        .select("id,name,kcal_per_serving,protein_g_per_serving,fat_g_per_serving,carbs_g_per_serving,user_id,visibility,servings")
        .or(`user_id.eq.${userId},visibility.eq.public`)
        .order("created_at", { ascending: false })
        .limit(50);

      const [foodsR, customR, recipesR] = await Promise.all([foodsQ, customQ.order("created_at", { ascending: false }).limit(30), recipesQ as any]);
      if (cancelled) return;
      if ((recipesR as any)?.error) console.error("recipes query error", (recipesR as any).error);

      const list: FoodRow[] = [];
      for (const r of (recipesR?.data || []) as any[]) {
        if (term && !r.name.toLowerCase().includes(term.toLowerCase())) continue;
        list.push(recipeRow(r));
      }
      for (const c of customR.data || []) list.push({ ...(c as any), source: "custom_food" });
      for (const f of foodsR.data || []) list.push({ ...(f as any), piece_g: (f as any).default_piece_weight_g, source: "food" });
      setResults(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, query, userId, hideRecipes]);

  // Open Food Facts search (debounced)
  const [offResults, setOffResults] = useState<FoodRow[]>([]);
  const [offLoading, setOffLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) { setOffResults([]); return; }
    let cancelled = false;
    setOffLoading(true);
    const t = setTimeout(async () => {
      try {
        const fields = "code,product_name,product_name_sv,brands,nutriments";
        // Two parallel queries: free text + brand tag (so svenska varumärken som "Tyngre" hittas)
        const url1 = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=50&sort_by=popularity_key&fields=${fields}`;
        const url2 = `https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&page_size=50&sort_by=popularity_key&tagtype_0=brands&tag_contains_0=contains&tag_0=${encodeURIComponent(term)}&fields=${fields}`;
        const [r1, r2] = await Promise.all([
          fetch(url1).then(r => r.json()).catch(() => ({})),
          fetch(url2).then(r => r.json()).catch(() => ({})),
        ]);
        if (cancelled) return;
        const seenCodes = new Set<string>();
        const rows: FoodRow[] = [];
        for (const p of [...(r1?.products || []), ...(r2?.products || [])]) {
          if (!p?.code || seenCodes.has(p.code)) continue;
          seenCodes.add(p.code);
          const name = p.product_name_sv || p.product_name;
          if (!name) continue;
          const n = p.nutriments || {};
          const kcal = Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0);
          if (!kcal) continue;
          const brand = (p.brands || "").split(",")[0]?.trim() || "";
          rows.push({
            id: `off-${p.code}`,
            name: brand ? `${name} (${brand})` : name,
            brand,
            source: "off",
            kcal,
            protein_g: Number(n.proteins_100g) || 0,
            fat_g: Number(n.fat_100g) || 0,
            carbs_g: Number(n.carbohydrates_100g) || 0,
            fiber_g: Number(n.fiber_100g) || 0,
            ...microsFromOFF(n),
          });
        }
        setOffResults(rows);
      } catch {
        if (!cancelled) setOffResults([]);
      } finally {
        if (!cancelled) setOffLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, query]);

  const combinedResults = useMemo(() => {
    const term = query.trim();
    if (!term) {
      const shown = new Set(personal.map((p) => usageKey(p.source, p.id)));
      return results.filter((r) => !shown.has(usageKey(r.source, r.id)));
    }
    const seen = new Set(results.map(r => r.name.toLowerCase()));
    const extras = offResults.filter(r => !seen.has(r.name.toLowerCase()));
    return rankFoods([...results, ...extras], term, usage);
  }, [results, offResults, query, usage, personal]);

  const showPersonal = !query.trim() && personal.length > 0;

  function pick(row: FoodRow) {
    setSelected(row);
    if (row.source === "recipe") { setAmount("1"); setUnit("portion"); return; }
    // 1) Remember what the user logged last time for this food
    const last = readLastAmounts()[`${row.source}:${row.name.toLowerCase()}`];
    if (last) { setAmount(last.amount); setUnit(last.unit); return; }
    // 2) Foods normally eaten by the piece default to 1 st
    // 2b) Natural portions (bröd → skiva, nötter → näve, kyckling → filé)
    const nat = naturalUnitsFor(row.name);
    if (nat.length) { setAmount("1"); setUnit(nat[0]); return; }
    const isPiece = (row.piece_g && row.piece_g > 0) || pieceWeightFor(row.name) !== DEFAULT_PIECE_G;
    setAmount(isPiece ? "1" : "100");
    setUnit(isPiece ? "st" : "g");
  }

  const quickAmounts = unit === "g" ? ["50", "100", "150", "200", "300"]
    : unit === "st" ? ["1", "2", "3", "4"]
    : ["dl", "msk", "tsk"].includes(unit) ? ["0.5", "1", "2", "3"]
    : ["skiva", "näve", "filé"].includes(unit) ? ["1", "2", "3"] : [];
  const unitOptions = selected ? [...UNITS, ...naturalUnitsFor(selected.name)] : [...UNITS];

  // När enheten byts: räkna om mängden så samma gramvikt behålls (100 g havregryn → ~3 dl)
  function onUnitChange(newUnit: string) {
    if (!selected || newUnit === unit) { setUnit(newUnit); return; }
    const a = parseFloat(amount.replace(",", ".")) || 0;
    const grams = gramsForFood(a, unit, selected.name, selected.piece_g);
    const perNew = gramsForFood(1, newUnit, selected.name, selected.piece_g);
    let v = perNew > 0 ? grams / perNew : a;
    // Rimlig avrundning: volym/st → max 1 decimal, gram → heltal
    v = newUnit === "g" ? Math.round(v) : Math.round(v * 10) / 10;
    if (v > 0) setAmount(String(v).replace(".", ","));
    setUnit(newUnit);
  }

  const computed = useMemo(() => {
    if (!selected) return null;
    const a = parseFloat(amount.replace(",", ".")) || 0;
    let factor: number;
    if (selected.source === "recipe") {
      // recipe stored per portion; amount is number of portions
      factor = a;
    } else {
      // per 100g
      const grams = gramsForFood(a, unit, selected.name, selected.piece_g);
      factor = grams / 100;
    }
    return {
      kcal: selected.kcal * factor,
      protein_g: selected.protein_g * factor,
      fat_g: selected.fat_g * factor,
      carbs_g: selected.carbs_g * factor,
      fiber_g: (Number(selected.fiber_g) || 0) * factor,
      micros: scaleMicros(pickMicros(selected), factor),
    };
  }, [selected, amount, unit]);

  async function confirm(keepOpen = false) {
    if (!selected || !computed) return;
    const a = parseFloat(amount.replace(",", ".")) || 0;

    // If picked from Open Food Facts, save to custom_foods first
    let outSource: PickedItem["source"] = selected.source === "off" ? "custom_food" : selected.source;
    let outId = selected.id;
    if (selected.source === "off") {
      try {
        const { data, error } = await supabase.from("custom_foods").insert({
          user_id: userId,
          name: selected.name,
          kcal: selected.kcal,
          protein_g: selected.protein_g,
          fat_g: selected.fat_g,
          carbs_g: selected.carbs_g,
          fiber_g: Number(selected.fiber_g) || 0,
          ...pickMicros(selected),
        } as any).select("id").single();
        if (error) throw error;
        outId = data!.id;
      } catch (e) {
        console.error("Failed to save OFF item to bank", e);
      }
    }

    if (selected.source !== "recipe") saveLastAmount(`${selected.source}:${selected.name.toLowerCase()}`, amount, unit);
    onPick({
      source: outSource,
      id: outId,
      name: selected.name,
      amount: a,
      unit: selected.source === "recipe" ? "portion" : unit,
      kcal: computed.kcal,
      protein_g: computed.protein_g,
      fat_g: computed.fat_g,
      carbs_g: computed.carbs_g,
      fiber_g: computed.fiber_g,
      micros: computed.micros,
    }, { keepOpen });
    if (keepOpen) { setAddedCount((c) => c + 1); setLastAdded(selected.name); }
    // Track personal usage so ranking improves over time (fire-and-forget)
    if (outId && !outId.startsWith("off-")) {
      const key = usageKey(outSource, outId);
      setUsage((m) => {
        const n = new Map(m);
        n.set(key, { count: (m.get(key)?.count || 0) + 1, last: Date.now() });
        return n;
      });
      supabase.rpc("bump_food_usage", { p_source: outSource, p_food_id: outId }).then(({ error }) => {
        if (error) console.error("bump_food_usage failed", error);
      });
    }
    setSelected(null);
    setQuery("");
  }

  const renderRow = (r: FoodRow) => (
    <li key={`${r.source}-${r.id}`} className="flex items-stretch">
      <button onClick={() => pick(r)} className="flex-1 text-left py-2.5 px-1 hover:bg-accent flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {r.source === "recipe" ? "Recept" : r.source === "custom_food" ? "Eget" : r.source === "off" ? "Open Food Facts" : r.group_name || "Livsmedel"} · {Math.round(r.kcal)} kcal / {r.source === "recipe" ? "portion" : "100 g"}
          </p>
        </div>
        <Plus className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
      </button>
      {r.source === "recipe" && r.owner_id === userId && onEditRecipe && (
        <button
          onClick={(e) => { e.stopPropagation(); onEditRecipe(r.id); }}
          className="px-2 text-muted-foreground hover:text-primary"
          aria-label="Redigera recept"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelected(null); setQuery(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="font-serif">{selected ? selected.name : "Välj livsmedel"}</DialogTitle>
        </DialogHeader>

        {!selected && addedCount > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-primary/10 text-primary px-3 py-2 text-xs font-semibold">
            <span className="truncate">✓ {addedCount} tillagda{lastAdded ? ` · senast ${lastAdded}` : ""}</span>
            <button onClick={() => onOpenChange(false)} className="pill-btn-primary px-3 py-1 text-xs flex-shrink-0">Klar</button>
          </div>
        )}
        {!selected && (
          <>
            <div className={`grid ${isHonorary ? "grid-cols-4" : "grid-cols-3"} gap-2`}>
              <button onClick={() => setManualOpen(true)} className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl bg-secondary shadow-soft text-[11px] font-semibold transition-colors hover:bg-muted">
                <PencilLine className="w-4 h-4" /> Eget
              </button>
              <button onClick={() => setBarcodeOpen(true)} className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl bg-secondary shadow-soft text-[11px] font-semibold transition-colors hover:bg-muted">
                <ScanBarcode className="w-4 h-4" /> Streckkod
              </button>
              <button onClick={() => setRestaurantOpen(true)} className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl bg-secondary shadow-soft text-[11px] font-semibold transition-colors hover:bg-muted">
                <Utensils className="w-4 h-4" /> Restaurang
              </button>
              {isHonorary && (
                <button onClick={() => setManualOpen(true)} className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl bg-primary/10 text-primary shadow-soft text-[11px] font-semibold transition-colors hover:bg-primary/20">
                  <Sparkles className="w-4 h-4" /> AI-skanna
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök livsmedel eller recept…" className="pl-9 rounded-xl bg-muted/50 border-transparent" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto -mx-4 px-4">
              {showPersonal && (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground pt-1 pb-1">Senaste & dina vanliga</p>
                  <ul className="divide-y divide-border mb-3">{personal.map(renderRow)}</ul>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground pb-1">Alla livsmedel</p>
                </>
              )}
              {loading && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
              {!loading && combinedResults.length === 0 && !showPersonal && <p className="text-sm text-muted-foreground text-center py-6">Inga träffar</p>}
              <ul className="divide-y divide-border">
                {combinedResults.map(renderRow)}
                {offLoading && <li className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></li>}
              </ul>
            </div>
          </>
        )}

        {selected && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {selected.source === "recipe" ? "Antal portioner" : "Mängd"}
              </label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={amount}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  className="rounded-xl bg-muted/50 border-transparent flex-1"
                />
                {selected.source !== "recipe" ? (
                  <select value={unit} onChange={(e) => onUnitChange(e.target.value)} className="input-soft px-2">
                    {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : (
                  <div className="px-3 flex items-center text-sm rounded-xl bg-muted">portion(er)</div>
                )}
              </div>
              {selected.source !== "recipe" && quickAmounts.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {quickAmounts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(p)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-colors ${amount.replace(",", ".") === p ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}
                    >
                      {p.replace(".", ",")} {unit}
                    </button>
                  ))}
                </div>
              )}
              {selected.source !== "recipe" && unitHint(unit, selected.name, selected.piece_g) && (
                <p className="text-[10px] text-muted-foreground mt-1">{unitHint(unit, selected.name, selected.piece_g)}</p>
              )}
              {selected.source === "recipe" && (
                <>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Receptet ger {selected.servings || 1} portion(er) totalt · {Math.round(selected.kcal)} kcal/portion
                  </p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {["0.5", "1", "1.5", "2", "3"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAmount(p)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-colors ${amount === p ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}
                      >
                        {p.replace(".", ",")}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {computed && (
              <div className={`grid ${computed.fiber_g > 0 ? "grid-cols-5" : "grid-cols-4"} gap-2 text-center bg-muted/40 rounded-2xl p-2`}>
                <div><p className="text-[10px] text-muted-foreground">Kcal</p><p className="font-bold tabular-nums">{Math.round(computed.kcal)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Protein</p><p className="font-bold tabular-nums">{computed.protein_g.toFixed(1)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">Fett</p><p className="font-bold tabular-nums">{computed.fat_g.toFixed(1)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">Kolhydrater</p><p className="font-bold tabular-nums">{computed.carbs_g.toFixed(1)}g</p></div>
                {computed.fiber_g > 0 && <div><p className="text-[10px] text-muted-foreground">Fiber</p><p className="font-bold tabular-nums">{computed.fiber_g.toFixed(1)}g</p></div>}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="flex-1 pill-btn-ghost py-2.5 text-sm">Tillbaka</button>
              <button onClick={() => confirm()} className="flex-1 pill-btn-primary py-2.5 text-sm">Lägg till</button>
            </div>
            <button onClick={() => confirm(true)} className="w-full pill-btn-soft py-2.5 text-sm">
              <Plus className="w-4 h-4" /> Lägg till & sök vidare
            </button>
          </div>
        )}
      </DialogContent>

      <BarcodeScannerDialog open={barcodeOpen} onOpenChange={setBarcodeOpen} onPick={(item, opts) => {
        if (opts?.keepScanning) { onPick(item, { keepOpen: true }); setAddedCount((c) => c + 1); setLastAdded(item.name); }
        else { setBarcodeOpen(false); onPick(item); }
      }} />
      <ManualFoodDialog open={manualOpen} onOpenChange={setManualOpen} userId={userId} isHonorary={isHonorary} onPick={(item) => { setManualOpen(false); onPick(item); }} />
      <RestaurantSearchDialog open={restaurantOpen} onOpenChange={setRestaurantOpen} onPick={(item) => { setRestaurantOpen(false); onPick(item); }} />
    </Dialog>
  );
}
