import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Lock, Search, ChefHat, X } from "lucide-react";
import { CURATED_RECIPES, RECIPE_CATEGORIES, CuratedRecipe } from "@/data/curatedRecipes";
import { PickedItem } from "./FoodPickerDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isHonorary: boolean;
  onPick?: (item: PickedItem) => void;
}

export default function CuratedRecipesDialog({ open, onOpenChange, isHonorary, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("frukost");
  const [selected, setSelected] = useState<CuratedRecipe | null>(null);
  const [portions, setPortions] = useState("1");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CURATED_RECIPES.filter((r) => r.category === cat && (q === "" || r.name.toLowerCase().includes(q)));
  }, [query, cat]);

  function pick(r: CuratedRecipe) {
    setSelected(r);
    setPortions("1");
  }

  function confirmAdd() {
    if (!selected || !onPick) return;
    const p = Math.max(0.1, parseFloat(portions.replace(",", ".")) || 1);
    onPick({
      source: "recipe",
      id: `curated:${selected.id}`,
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

  if (!isHonorary) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-6 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center justify-center gap-2"><Lock className="w-5 h-5" /> Endast hedersmedlemmar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            De färdiga träningsanpassade recepten är låsta. Bli hedersmedlem för att låsa upp 100+ recept anpassade för svenska livsmedel.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelected(null); setQuery(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            {selected ? selected.name : "Färdiga recept"}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök recept…" className="pl-9 rounded-none" />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
              {RECIPE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap border ${cat === c ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <ul className="flex-1 overflow-y-auto divide-y divide-border border border-border">
              {filtered.length === 0 ? (
                <li className="p-3 text-xs text-muted-foreground text-center">Inga recept</li>
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
          </>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <button onClick={() => setSelected(null)} className="text-xs font-bold text-primary">‹ Tillbaka</button>
            <div className="bg-muted/40 p-2 grid grid-cols-4 gap-1 text-center">
              <div><p className="text-[9px] text-muted-foreground">Kcal/p</p><p className="text-sm font-bold tabular-nums">{selected.kcal_per_serving}</p></div>
              <div><p className="text-[9px] text-muted-foreground">Protein</p><p className="text-sm font-bold tabular-nums">{selected.protein_g_per_serving}g</p></div>
              <div><p className="text-[9px] text-muted-foreground">Fett</p><p className="text-sm font-bold tabular-nums">{selected.fat_g_per_serving}g</p></div>
              <div><p className="text-[9px] text-muted-foreground">Kolhydrat</p><p className="text-sm font-bold tabular-nums">{selected.carbs_g_per_serving}g</p></div>
            </div>
            <div>
              <p className="text-xs font-bold mb-1">Ingredienser ({selected.servings} port)</p>
              <ul className="border border-border divide-y divide-border text-xs">
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
            {onPick && (
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-medium">Antal portioner</label>
                <Input value={portions} onChange={(e) => setPortions(e.target.value)} inputMode="decimal" className="rounded-none" />
                <button onClick={confirmAdd} className="w-full py-3 bg-primary text-primary-foreground font-bold">
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
