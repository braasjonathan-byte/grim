import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Globe, Lock, Loader2 } from "lucide-react";
import FoodPickerDialog, { PickedItem } from "./FoodPickerDialog";
import { useToast } from "@/hooks/use-toast";
import { RECIPE_CATEGORIES } from "@/data/curatedRecipes";

interface RecipeEditorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onSaved: () => void;
  initialRecipeId?: string | null;
}

type Ingredient = PickedItem;

const EMPTY = { name: "", servings: "4", instructions: "", ingredients: [] as Ingredient[], visibility: "private" as "private" | "public", category: "middag" };

export default function RecipeEditor({ open, onOpenChange, userId, onSaved, initialRecipeId }: RecipeEditorProps) {
  const [name, setName] = useState(EMPTY.name);
  const [servings, setServings] = useState(EMPTY.servings);
  const [instructions, setInstructions] = useState(EMPTY.instructions);
  const [ingredients, setIngredients] = useState<Ingredient[]>(EMPTY.ingredients);
  const [visibility, setVisibility] = useState<"private" | "public">(EMPTY.visibility);
  const [category, setCategory] = useState<string>(EMPTY.category);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEditing = !!initialRecipeId;

  function reset() {
    setName(EMPTY.name); setServings(EMPTY.servings); setInstructions(EMPTY.instructions);
    setIngredients(EMPTY.ingredients); setVisibility(EMPTY.visibility); setCategory(EMPTY.category);
  }

  // Load existing recipe when editing
  useEffect(() => {
    if (!open) return;
    if (!initialRecipeId) { reset(); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("recipes")
      .select("name,servings,instructions,visibility,category,ingredients")
      .eq("id", initialRecipeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error || !data) {
          toast({ title: "Kunde inte ladda receptet", description: error?.message, variant: "destructive" });
          return;
        }
        setName((data as any).name || "");
        setServings(String((data as any).servings ?? "1"));
        setInstructions((data as any).instructions || "");
        setVisibility(((data as any).visibility as any) || "private");
        setCategory((data as any).category || "middag");
        setIngredients(Array.isArray((data as any).ingredients) ? ((data as any).ingredients as Ingredient[]) : []);
      });
    return () => { cancelled = true; };
  }, [open, initialRecipeId]);

  const totalKcal = ingredients.reduce((s, i) => s + i.kcal, 0);
  const totalProtein = ingredients.reduce((s, i) => s + i.protein_g, 0);
  const totalFat = ingredients.reduce((s, i) => s + i.fat_g, 0);
  const totalCarbs = ingredients.reduce((s, i) => s + i.carbs_g, 0);
  const portions = Math.max(1, parseFloat(servings.replace(",", ".")) || 1);

  /** Scale an ingredient's nutrition values when its amount changes. */
  function updateIngredientAmount(idx: number, raw: string) {
    setIngredients((arr) => arr.map((ing, i) => {
      if (i !== idx) return ing;
      const newAmt = parseFloat(raw.replace(",", ".")) || 0;
      const oldAmt = ing.amount || 0;
      if (oldAmt <= 0) {
        // Can't scale from zero — just store the raw amount and zero out macros.
        return { ...ing, amount: newAmt };
      }
      const f = newAmt / oldAmt;
      return {
        ...ing,
        amount: newAmt,
        kcal: ing.kcal * f,
        protein_g: ing.protein_g * f,
        fat_g: ing.fat_g * f,
        carbs_g: ing.carbs_g * f,
      };
    }));
  }

  async function save() {
    if (!name.trim() || ingredients.length === 0) {
      toast({ title: "Namn och minst en ingrediens krävs", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      name: name.trim(),
      servings: portions,
      instructions: instructions.trim() || null,
      visibility,
      category,
      kcal_per_serving: totalKcal / portions,
      fat_g_per_serving: totalFat / portions,
      protein_g_per_serving: totalProtein / portions,
      carbs_g_per_serving: totalCarbs / portions,
      ingredients: ingredients as any,
    } as any;
    const { error } = isEditing
      ? await supabase.from("recipes").update(payload).eq("id", initialRecipeId!).eq("user_id", userId)
      : await supabase.from("recipes").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" }); return; }
    toast({ title: isEditing ? "Recept uppdaterat" : "Recept sparat" });
    reset();
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="font-serif">{isEditing ? "Redigera recept" : "Nytt recept"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Namn</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Portioner</label>
              <Input value={servings} onChange={(e) => setServings(e.target.value)} inputMode="numeric" pattern="[0-9]*" className="rounded-none" />
            </div>
            <div>
              <label className="text-xs font-medium">Synlighet</label>
              <div className="flex gap-1">
                <button onClick={() => setVisibility("private")} className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium border ${visibility === "private" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>
                  <Lock className="w-3 h-3" /> Privat
                </button>
                <button onClick={() => setVisibility("public")} className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium border ${visibility === "public" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>
                  <Globe className="w-3 h-3" /> Publikt
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Kategori</label>
            <div className="flex gap-1 flex-wrap">
              {RECIPE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-2 py-1.5 text-[11px] font-medium border ${category === c ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>


          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Ingredienser</label>
              <button onClick={() => setPickerOpen(true)} className="flex items-center gap-1 text-xs font-bold text-primary"><Plus className="w-3 h-3" />Lägg till</button>
            </div>
            {ingredients.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Inga ingredienser ännu</p>
            ) : (
              <ul className="border border-border divide-y divide-border">
                {ingredients.map((ing, idx) => (
                  <li key={idx} className="py-2 px-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate flex-1">{ing.name}</p>
                      <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-destructive p-1" aria-label="Ta bort"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={String(ing.amount)}
                        onChange={(e) => updateIngredientAmount(idx, e.target.value)}
                        inputMode="decimal"
                        pattern="[0-9.,]*"
                        className="rounded-none h-7 w-20 text-xs"
                        aria-label="Mängd"
                      />
                      <span className="text-[11px] text-muted-foreground">{ing.unit}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{Math.round(ing.kcal)} kcal · P{ing.protein_g.toFixed(1)} F{ing.fat_g.toFixed(1)} K{ing.carbs_g.toFixed(1)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-muted/40 p-2 grid grid-cols-4 gap-1 text-center">
            <div><p className="text-[9px] text-muted-foreground">Kcal/p</p><p className="text-sm font-bold tabular-nums">{Math.round(totalKcal / portions)}</p></div>
            <div><p className="text-[9px] text-muted-foreground">Pro/p</p><p className="text-sm font-bold tabular-nums">{(totalProtein / portions).toFixed(1)}g</p></div>
            <div><p className="text-[9px] text-muted-foreground">Fett/p</p><p className="text-sm font-bold tabular-nums">{(totalFat / portions).toFixed(1)}g</p></div>
            <div><p className="text-[9px] text-muted-foreground">Kh/p</p><p className="text-sm font-bold tabular-nums">{(totalCarbs / portions).toFixed(1)}g</p></div>
          </div>

          <div>
            <label className="text-xs font-medium">Instruktioner (valfritt)</label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="rounded-none" rows={3} />
          </div>

          <button disabled={saving} onClick={save} className="w-full py-3 bg-primary text-primary-foreground font-bold disabled:opacity-50">
            {saving ? "Sparar…" : isEditing ? "Spara ändringar" : "Spara recept"}
          </button>
        </div>
        )}

        <FoodPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          userId={userId}
          hideRecipes
          onPick={(p) => { setIngredients((arr) => [...arr, p]); setPickerOpen(false); }}
        />
      </DialogContent>
    </Dialog>
  );
}
