import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Lock, Search, ChefHat, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { RECIPE_CATEGORIES, CuratedRecipe } from "@/data/curatedRecipes";
import { useCuratedRecipes } from "@/lib/curatedRecipesLive";
import { PickedItem } from "./FoodPickerDialog";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isHonorary: boolean;
  userId?: string;
  onPick?: (item: PickedItem) => void;
  onCreateOwn?: () => void;
  /** Redigera eget recept (id) eller ett färdigt recept som kopia (recipe). */
  onEdit?: (target: { ownId: string } | { template: CuratedRecipe }) => void;
}

export default function CuratedRecipesDialog({ open, onOpenChange, isHonorary, userId, onPick, onCreateOwn, onEdit }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>(isHonorary ? "alla" : "mina");
  const [selected, setSelected] = useState<CuratedRecipe | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [portions, setPortions] = useState("1");
  const [myRecipes, setMyRecipes] = useState<CuratedRecipe[]>([]);

  // Hämta användarens egna recept så de syns under "Mina recept".
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id,name,servings,instructions,kcal_per_serving,protein_g_per_serving,fat_g_per_serving,carbs_g_per_serving,ingredients,category")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) { console.error("my recipes error", error); return; }
      setMyRecipes(((data || []) as any[]).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category || "Övrigt",
        servings: Number(r.servings) || 1,
        kcal_per_serving: Math.round(Number(r.kcal_per_serving) || 0),
        protein_g_per_serving: Math.round(Number(r.protein_g_per_serving) || 0),
        fat_g_per_serving: Math.round(Number(r.fat_g_per_serving) || 0),
        carbs_g_per_serving: Math.round(Number(r.carbs_g_per_serving) || 0),
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        instructions: r.instructions || "",
      })));
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = cat === "mina" ? myRecipes : curated;
    return source.filter((r) => (cat === "alla" || cat === "mina" || r.category === cat) && (q === "" || r.name.toLowerCase().includes(q)));
  }, [query, cat, myRecipes, curated]);

  function pick(r: CuratedRecipe) {
    const idx = filtered.findIndex((x) => x.id === r.id);
    setSelected(r);
    setSelectedIndex(idx >= 0 ? idx : 0);
    setPortions("1");
  }

  function goPrev() {
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : filtered.length - 1;
    setSelectedIndex(newIndex);
    setSelected(filtered[newIndex]);
  }

  function goNext() {
    const newIndex = selectedIndex < filtered.length - 1 ? selectedIndex + 1 : 0;
    setSelectedIndex(newIndex);
    setSelected(filtered[newIndex]);
  }

  function confirmAdd() {
    if (!selected || !onPick) return;
    const p = Math.max(0.1, parseFloat(portions.replace(",", ".")) || 1);
    onPick({
      source: "recipe",
      id: cat === "mina" || myRecipes.some((r) => r.id === selected.id) ? selected.id : `curated:${selected.id}`,
      name: selected.name,
      amount: p,
      unit: "portion",
      kcal: selected.kcal_per_serving * p,
      protein_g: selected.protein_g_per_serving * p,
      fat_g: selected.fat_g_per_serving * p,
      carbs_g: selected.carbs_g_per_serving * p,
    });
    setSelected(null);
    setQuery("");
  }

  // Egna recept är öppna för alla; de färdiga recepten är låsta till hedersmedlemmar.
  const curatedLocked = !isHonorary;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelected(null); setQuery(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            {selected ? selected.name : "Recept"}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            {onCreateOwn && (
              <button
                onClick={() => { onOpenChange(false); onCreateOwn(); }}
                className="w-full flex items-center justify-center gap-2 pill-btn-ghost py-2 text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Skapa eget recept
              </button>
            )}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök recept…" className="pl-9 rounded-xl bg-muted/50 border-transparent" />
            </div>
            <div className="flex flex-wrap gap-1 pb-1">
              <button
                onClick={() => setCat("alla")}
                className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-full transition-colors ${cat === "alla" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}
              >
                Alla
              </button>
              {userId && (
                <button
                  onClick={() => setCat("mina")}
                  className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-full transition-colors ${cat === "mina" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}
                >
                  Mina recept{myRecipes.length > 0 ? ` (${myRecipes.length})` : ""}
                </button>
              )}
              {RECIPE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-full transition-colors ${cat === c ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            {curatedLocked && cat !== "mina" ? (
              <div className="flex-1 border border-border rounded-2xl p-4 text-center space-y-2 flex flex-col items-center justify-center">
                <p className="text-xs font-bold flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> Färdiga recept – hedersmedlemmar</p>
                <p className="text-xs text-muted-foreground">
                  Lås upp 200+ träningsanpassade recept med svenska livsmedel som hedersmedlem. Dina egna recept hittar du under Mina recept.
                </p>
              </div>
            ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-border border border-border">
              {filtered.length === 0 ? (
                <li className="p-3 text-xs text-muted-foreground text-center">{cat === "mina" ? "Du har inga egna recept än – skapa ett ovan!" : "Inga recept"}</li>
              ) : filtered.map((r) => (
                <li key={r.id}>
                  <button onClick={() => pick(r)} className="w-full text-left p-3 hover:bg-accent flex justify-between gap-2 items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.servings} port · {r.kcal_per_serving} kcal · {r.protein_g_per_serving}g protein</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">›</span>
                  </button>
                </li>
               ))}
            </ul>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setSelected(null)} className="text-xs font-bold text-primary">‹ Tillbaka</button>
              <div className="flex items-center gap-1">
                <button onClick={goPrev} className="p-1.5 hover:bg-accent border border-border" title="Föregående recept">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] text-muted-foreground px-1 tabular-nums">{selectedIndex + 1} / {filtered.length}</span>
                <button onClick={goNext} className="p-1.5 hover:bg-accent border border-border" title="Nästa recept">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-muted/40 rounded-2xl p-2 grid grid-cols-4 gap-1 text-center">
              <div><p className="text-[9px] text-muted-foreground">Kcal/p</p><p className="text-sm font-bold tabular-nums">{selected.kcal_per_serving}</p></div>
              <div><p className="text-[9px] text-muted-foreground">Protein</p><p className="text-sm font-bold tabular-nums">{selected.protein_g_per_serving}g</p></div>
              <div><p className="text-[9px] text-muted-foreground">Fett</p><p className="text-sm font-bold tabular-nums">{selected.fat_g_per_serving}g</p></div>
              <div><p className="text-[9px] text-muted-foreground">Kolhydrat</p><p className="text-sm font-bold tabular-nums">{selected.carbs_g_per_serving}g</p></div>
            </div>
            <div>
              <p className="text-xs font-bold mb-1">Ingredienser ({selected.servings} port)</p>
              <ul className="rounded-2xl bg-muted/30 overflow-hidden divide-y divide-border/40 text-xs">
                {selected.ingredients.map((i, idx) => (
                  <li key={idx} className="p-2 flex justify-between">
                    <span>{i.name}</span>
                    <span className="text-muted-foreground">{i.amount} {i.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold mb-1">Instruktioner</p>
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{selected.instructions}</p>
            </div>
            {onEdit && (
              <button
                onClick={() => {
                  const own = myRecipes.some((r) => r.id === selected.id);
                  onEdit(own ? { ownId: selected.id } : { template: selected });
                  setSelected(null);
                  onOpenChange(false);
                }}
                className="w-full pill-btn-soft py-2.5 text-sm"
              >
                {myRecipes.some((r) => r.id === selected.id) ? "Redigera recept" : "Redigera och spara som eget"}
              </button>
            )}
            {onPick && (
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-medium">Antal portioner</label>
                <Input value={portions} onChange={(e) => setPortions(e.target.value)} inputMode="decimal" className="rounded-xl bg-muted/50 border-transparent" />
                <button onClick={confirmAdd} className="w-full pill-btn-primary py-3">
                  Lägg till i måltid
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
