import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Globe, Lock } from "lucide-react";
import FoodPickerDialog, { PickedItem } from "./FoodPickerDialog";
import { useToast } from "@/hooks/use-toast";
import { RECIPE_CATEGORIES } from "@/data/curatedRecipes";

interface RecipeEditorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onSaved: () => void;
  initialRecipeId?: string;
}

type Ingredient = PickedItem;

export default function RecipeEditor({ open, onOpenChange, userId, onSaved }: RecipeEditorProps) {
  const [name, setName] = useState("");
  const [servings, setServings] = useState("4");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [category, setCategory] = useState<string>("middag");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function reset() {
    setName(""); setServings("4"); setInstructions(""); setIngredients([]); setVisibility("private"); setCategory("middag");
  }

  const totalKcal = ingredients.reduce((s, i) => s + i.kcal, 0);
  const totalProtein = ingredients.reduce((s, i) => s + i.protein_g, 0);
  const totalFat = ingredients.reduce((s, i) => s + i.fat_g, 0);
  const totalCarbs = ingredients.reduce((s, i) => s + i.carbs_g, 0);
  const portions = Math.max(1, parseFloat(servings.replace(",", ".")) || 1);

  async function save() {
    if (!name.trim() || ingredients.length === 0) {
      toast({ title: "Namn och minst en ingrediens krävs", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("recipes").insert({
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
    } as any);
    setSaving(false);
    if (error) { toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Recept sparat" });
    reset();
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="font-serif">Nytt recept</DialogTitle>
        </DialogHeader>
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Ingredienser</label>
              <button onClick={() => setPickerOpen(true)} className="flex items-center gap-1 text-xs font-bold text-primary"><Plus className="w-3 h-3" />Lägg till</button>
            </div>
            {ingredients.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Inga ingredienser ännu</p>
            ) : (
              <ul className="border border-border divide-y divide-border">
                {ingredients.map((ing, idx) => (
                  <li key={idx} className="flex items-center justify-between py-2 px-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ing.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ing.amount} {ing.unit} · {Math.round(ing.kcal)} kcal</p>
                    </div>
                    <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
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
            {saving ? "Sparar…" : "Spara recept"}
          </button>
        </div>

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
