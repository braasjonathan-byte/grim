import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Lock, Search, ChefHat, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CURATED_RECIPES, RECIPE_CATEGORIES, CuratedRecipe } from "@/data/curatedRecipes";
import { PickedItem } from "./FoodPickerDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isHonorary: boolean;
  onPick?: (item: PickedItem) => void;
  onCreateOwn?: () => void;
}

export default function CuratedRecipesDialog({ open, onOpenChange, isHonorary, onPick, onCreateOwn }: Props) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("alla");
  const [selected, setSelected] = useState<CuratedRecipe | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [portions, setPortions] = useState("1");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CURATED_RECIPES.filter((r) => (cat === "alla" || r.category === cat) && (q === "" || r.name.toLowerCase().includes(q)));
  }, [query, cat]);

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
            <DialogTitle className="font-serif flex items-center justify-center gap-2"><ChefHat className="w-5 h-5" /> Recept</DialogTitle>
          </DialogHeader>
          {onCreateOwn && (
            <button
              onClick={() => { onOpenChange(false); onCreateOwn(); }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-bold"
            >
              <Plus className="w-4 h-4" /> Skapa eget recept
            </button>
          )}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs font-bold flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> Färdiga recept – hedersmedlemmar</p>
            <p className="text-xs text-muted-foreground">
              Lås upp 100+ träningsanpassade recept med svenska livsmedel som hedersmedlem.
            </p>
          </div>
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
            {selected ? selected.name : "Recept"}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            {onCreateOwn && (
              <button
                onClick={() => { onOpenChange(false); onCreateOwn(); }}
                className="w-full flex items-center justify-center gap-2 py-2 border border-input text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> Skapa eget recept
              </button>
            )}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök recept…" className="pl-9 rounded-none" />
            </div>
            <div className="flex flex-wrap gap-1 pb-1">
              <button
                onClick={() => setCat("alla")}
                className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap border ${cat === "alla" ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background"}`}
              >
                Alla
              </button>
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
