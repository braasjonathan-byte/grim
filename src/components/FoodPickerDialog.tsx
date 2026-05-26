import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Plus, Loader2, ScanBarcode, Utensils, PencilLine, Sparkles } from "lucide-react";
import { UNITS, toGrams } from "@/lib/nutritionCalc";
import BarcodeScannerDialog from "./BarcodeScannerDialog";
import RestaurantSearchDialog from "./RestaurantSearchDialog";
import ManualFoodDialog from "./ManualFoodDialog";

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
}

interface FoodPickerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: PickedItem) => void;
  userId: string;
  /** If true, recipes are hidden (used when building a recipe) */
  hideRecipes?: boolean;
}

type FoodRow = { id: string; name: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number; group_name?: string | null; source: "food" | "custom_food" | "recipe" | "off"; servings?: number; brand?: string };

export default function FoodPickerDialog({ open, onOpenChange, onPick, userId, hideRecipes }: FoodPickerDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoodRow | null>(null);
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<string>("g");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [restaurantOpen, setRestaurantOpen] = useState(false);
  const [isHonorary, setIsHonorary] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("is_honorary").eq("user_id", userId).maybeSingle().then(({ data }) => {
      setIsHonorary(!!data?.is_honorary);
    });
  }, [open, userId]);

  // search
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const term = query.trim();
    setLoading(true);
    (async () => {
      // foods (global)
      const foodsQ = term
        ? supabase.from("foods").select("id,name,kcal,protein_g,fat_g,carbs_g,group_name").ilike("name", `%${term}%`).order("name").limit(40)
        : supabase.from("foods").select("id,name,kcal,protein_g,fat_g,carbs_g,group_name").order("name").limit(40);
      // custom foods (own)
      const customQ = supabase.from("custom_foods").select("id,name,kcal,protein_g,fat_g,carbs_g").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      // recipes (own + public)
      const recipesQ = hideRecipes ? null : supabase
        .from("recipes")
        .select("id,name,kcal_per_serving,protein_g_per_serving,fat_g_per_serving,carbs_g_per_serving,user_id,visibility,servings")
        .or(`user_id.eq.${userId},visibility.eq.public`)
        .order("created_at", { ascending: false })
        .limit(50);

      const [foodsR, customR, recipesR] = await Promise.all([foodsQ, customQ, recipesQ as any]);
      if (cancelled) return;
      if ((recipesR as any)?.error) console.error("recipes query error", (recipesR as any).error);

      const list: FoodRow[] = [];
      if (recipesR?.data) {
        for (const r of recipesR.data as any[]) {
          if (term && !r.name.toLowerCase().includes(term.toLowerCase())) continue;
          list.push({
            id: r.id, name: r.name, source: "recipe",
            kcal: Number(r.kcal_per_serving) || 0,
            protein_g: Number(r.protein_g_per_serving) || 0,
            fat_g: Number(r.fat_g_per_serving) || 0,
            carbs_g: Number(r.carbs_g_per_serving) || 0,
            servings: Number(r.servings) || 1,
          });
        }
      }
      for (const c of customR.data || []) list.push({ ...(c as any), source: "custom_food" });
      for (const f of foodsR.data || []) list.push({ ...(f as any), source: "food" });
      // Sort so names starting with the search term appear first
      if (term) {
        const lowerTerm = term.toLowerCase();
        list.sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(lowerTerm);
          const bStarts = b.name.toLowerCase().startsWith(lowerTerm);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.name.localeCompare(b.name, "sv");
        });
      }
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
    if (term.length < 3) { setOffResults([]); return; }
    let cancelled = false;
    setOffLoading(true);
    const t = setTimeout(async () => {
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,product_name_sv,brands,nutriments`;
        const res = await fetch(url);
        const json = await res.json();
        if (cancelled) return;
        const rows: FoodRow[] = [];
        for (const p of json?.products || []) {
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
    if (!query.trim()) return results;
    const seen = new Set(results.map(r => r.name.toLowerCase()));
    const extras = offResults.filter(r => !seen.has(r.name.toLowerCase()));
    return [...results, ...extras];
  }, [results, offResults, query]);

  function pick(row: FoodRow) {
    setSelected(row);
    setAmount(row.source === "recipe" ? "1" : "100");
    setUnit(row.source === "recipe" ? "portion" : "g");
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
      const grams = toGrams(a, unit);
      factor = grams / 100;
    }
    return {
      kcal: selected.kcal * factor,
      protein_g: selected.protein_g * factor,
      fat_g: selected.fat_g * factor,
      carbs_g: selected.carbs_g * factor,
    };
  }, [selected, amount, unit]);

  function confirm() {
    if (!selected || !computed) return;
    onPick({
      source: selected.source,
      id: selected.id,
      name: selected.name,
      amount: parseFloat(amount.replace(",", ".")) || 0,
      unit: selected.source === "recipe" ? "portion" : unit,
      kcal: computed.kcal,
      protein_g: computed.protein_g,
      fat_g: computed.fat_g,
      carbs_g: computed.carbs_g,
    });
    setSelected(null);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelected(null); setQuery(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="font-serif">{selected ? selected.name : "Välj livsmedel"}</DialogTitle>
        </DialogHeader>

        {!selected && (
          <>
            <div className={`grid ${isHonorary ? "grid-cols-4" : "grid-cols-3"} gap-2`}>
              <button onClick={() => setManualOpen(true)} className="flex flex-col items-center justify-center gap-1 py-2 border border-input text-[11px] font-bold">
                <PencilLine className="w-4 h-4" /> Eget
              </button>
              <button onClick={() => setBarcodeOpen(true)} className="flex flex-col items-center justify-center gap-1 py-2 border border-input text-[11px] font-bold">
                <ScanBarcode className="w-4 h-4" /> Streckkod
              </button>
              <button onClick={() => setRestaurantOpen(true)} className="flex flex-col items-center justify-center gap-1 py-2 border border-input text-[11px] font-bold">
                <Utensils className="w-4 h-4" /> Restaurang
              </button>
              {isHonorary && (
                <button onClick={() => setManualOpen(true)} className="flex flex-col items-center justify-center gap-1 py-2 border border-primary text-primary text-[11px] font-bold">
                  <Sparkles className="w-4 h-4" /> AI-skanna
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök livsmedel eller recept…" className="pl-9 rounded-none" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto -mx-4 px-4">
              {loading && <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
              {!loading && results.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Inga träffar</p>}
              <ul className="divide-y divide-border">
                {results.map((r) => (
                  <li key={`${r.source}-${r.id}`}>
                    <button onClick={() => pick(r)} className="w-full text-left py-2.5 px-1 hover:bg-accent flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.source === "recipe" ? "Recept" : r.source === "custom_food" ? "Eget" : r.group_name || "Livsmedel"} · {Math.round(r.kcal)} kcal / {r.source === "recipe" ? "portion" : "100 g"}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                    </button>
                  </li>
                ))}
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
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  className="rounded-none flex-1"
                />
                {selected.source !== "recipe" ? (
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border border-input bg-background px-2 text-sm">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : (
                  <div className="px-3 flex items-center text-sm border border-input bg-muted">portion(er)</div>
                )}
              </div>
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
                        className={`px-2.5 py-1 text-[11px] font-bold border ${amount === p ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background"}`}
                      >
                        {p.replace(".", ",")}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {computed && (
              <div className="grid grid-cols-4 gap-2 text-center bg-muted/40 p-2">
                <div><p className="text-[10px] text-muted-foreground">Kcal</p><p className="font-bold tabular-nums">{Math.round(computed.kcal)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Protein</p><p className="font-bold tabular-nums">{computed.protein_g.toFixed(1)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">Fett</p><p className="font-bold tabular-nums">{computed.fat_g.toFixed(1)}g</p></div>
                <div><p className="text-[10px] text-muted-foreground">Kolhydrater</p><p className="font-bold tabular-nums">{computed.carbs_g.toFixed(1)}g</p></div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 border border-input text-sm font-medium">Tillbaka</button>
              <button onClick={confirm} className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold">Lägg till</button>
            </div>
          </div>
        )}
      </DialogContent>

      <BarcodeScannerDialog open={barcodeOpen} onOpenChange={setBarcodeOpen} onPick={(item) => { setBarcodeOpen(false); onPick(item); }} />
      <ManualFoodDialog open={manualOpen} onOpenChange={setManualOpen} userId={userId} isHonorary={isHonorary} onPick={(item) => { setManualOpen(false); onPick(item); }} />
      <RestaurantSearchDialog open={restaurantOpen} onOpenChange={setRestaurantOpen} onPick={(item) => { setRestaurantOpen(false); onPick(item); }} />
    </Dialog>
  );
}
