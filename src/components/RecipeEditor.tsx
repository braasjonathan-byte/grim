import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Globe, Lock, Loader2, Link2, AlertTriangle } from "lucide-react";
import { aiItemToPicked, type AiFoodItem } from "@/lib/aiFood";
import FoodPickerDialog, { PickedItem } from "./FoodPickerDialog";
import { useToast } from "@/hooks/use-toast";
import { RECIPE_CATEGORIES, type CuratedRecipe } from "@/data/curatedRecipes";
import { gramsForFood } from "@/lib/nutritionCalc";
import { convertedIngredient, ingredientUnitOptions, type FoodMeasure } from "@/lib/recipeIngredientUnits";

interface RecipeEditorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onSaved: () => void;
  initialRecipeId?: string | null;
  /** Färdigt recept att utgå från — sparas alltid som en egen kopia. */
  templateRecipe?: CuratedRecipe | null;
}

type Ingredient = PickedItem;

const EMPTY = { name: "", servings: "4", instructions: "", ingredients: [] as Ingredient[], visibility: "private" as "private" | "public", category: "middag" };

export default function RecipeEditor({ open, onOpenChange, userId, onSaved, initialRecipeId, templateRecipe }: RecipeEditorProps) {
  const [name, setName] = useState(EMPTY.name);
  const [servings, setServings] = useState(EMPTY.servings);
  const [instructions, setInstructions] = useState(EMPTY.instructions);
  const [ingredients, setIngredients] = useState<Ingredient[]>(EMPTY.ingredients);
  const [visibility, setVisibility] = useState<"private" | "public">(EMPTY.visibility);
  const [category, setCategory] = useState<string>(EMPTY.category);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [measureFoods, setMeasureFoods] = useState<Array<FoodMeasure & { id: string; name: string }>>([]);
  const { toast } = useToast();

  const isEditing = !!initialRecipeId;

  function reset() {
    setName(EMPTY.name); setServings(EMPTY.servings); setInstructions(EMPTY.instructions);
    setIngredients(EMPTY.ingredients); setVisibility(EMPTY.visibility); setCategory(EMPTY.category);
    setImportUrl(""); setImported(false); setReviewed(false);
  }

  // Load existing recipe when editing
  useEffect(() => {
    if (!open) return;
    if (templateRecipe) {
      setName(`${templateRecipe.name} (egen)`);
      setServings(String(templateRecipe.servings || 1));
      setInstructions(templateRecipe.instructions || "");
      setVisibility("private");
      const c = (templateRecipe.category || "").toLowerCase();
      setCategory((RECIPE_CATEGORIES as readonly string[]).includes(c) ? c : "middag");
      setIngredients(templateRecipe.ingredients.map((i) => ({ ...(i as any), source: (i as any).source || "egen" })) as Ingredient[]);
      setImported(false); setReviewed(false);
      return;
    }
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
  }, [open, initialRecipeId, templateRecipe]);

  // Hämta måttuppgifter (styckvikt, densitet, lämpliga enheter) för ingrediensernas livsmedel.
  const ingredientKey = useMemo(
    () => ingredients.map((i) => ((i as any).source === "food" && (i as any).id) ? String((i as any).id) : i.name).join("|"),
    [ingredients]
  );
  useEffect(() => {
    if (!open) { setMeasureFoods([]); return; }
    const parts = ingredientKey.split("|").filter(Boolean);
    const ids = parts.filter((p) => /^[0-9a-f-]{36}$/i.test(p));
    const names = parts.filter((p) => !/^[0-9a-f-]{36}$/i.test(p));
    let cancelled = false;
    const columns = "id,name,default_piece_weight_g,density_g_per_dl,suitable_units";
    Promise.all([
      ids.length ? supabase.from("foods").select(columns).in("id", ids) : Promise.resolve({ data: [] as any[], error: null }),
      names.length ? supabase.from("foods").select(columns).in("name", names) : Promise.resolve({ data: [] as any[], error: null }),
    ]).then((results) => {
      if (cancelled) return;
      setMeasureFoods(results.flatMap((r) => (r as any).data || []));
    });
    return () => { cancelled = true; };
  }, [open, ingredientKey]);

  const totalKcal = ingredients.reduce((s, i) => s + i.kcal, 0);
  const totalProtein = ingredients.reduce((s, i) => s + i.protein_g, 0);
  const totalFat = ingredients.reduce((s, i) => s + i.fat_g, 0);
  const totalCarbs = ingredients.reduce((s, i) => s + i.carbs_g, 0);
  const servingsNum = parseFloat(servings.replace(",", "."));
  const servingsError = !isFinite(servingsNum) || servingsNum < 1 || servingsNum > 50 ? "Portioner måste vara mellan 1 och 50" : null;
  const portions = Math.max(1, servingsNum || 1);

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

  /** Byt enhet på en ingrediens: mängden räknas om så totala grammen (och näringen) är oförändrade. */
  function changeIngredientUnit(idx: number, newUnit: string) {
    setIngredients((arr) => arr.map((ing, i) => {
      if (i !== idx) return ing;
      const linked = ing as any;
      const food = measureFoods.find((f) => linked.id ? f.id === linked.id : f.name === ing.name);
      return convertedIngredient(ing, newUnit, food);
    }));
  }

  async function importFromUrl() {
    const u = importUrl.trim();
    if (!/^https?:\/\//i.test(u)) { toast({ title: "Klistra in en länk som börjar med https://", variant: "destructive" }); return; }
    setImporting(true);
    const { data, error } = await supabase.functions.invoke("recipe-import", { body: { url: u } });
    setImporting(false);
    if (error || !data || data.error) {
      let msg = data?.error;
      try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      toast({ title: "Kunde inte importera receptet", description: msg || "Försök med en annan länk.", variant: "destructive" });
      return;
    }
    if (data.name) setName(data.name);
    if (data.servings > 0) setServings(String(Math.round(data.servings)));
    if (data.instructions) setInstructions(data.instructions);
    setIngredients(((data.ingredients || []) as AiFoodItem[]).map(aiItemToPicked));
    setImported(true); setReviewed(false);
  }

  async function save(asCopy = false) {
    if (imported && !reviewed) {
      toast({ title: "Granska receptet först", description: "Bekräfta att ingredienser och mängder stämmer.", variant: "destructive" });
      return;
    }
    if (!name.trim() || ingredients.length === 0) {
      toast({ title: "Namn och minst en ingrediens krävs", variant: "destructive" });
      return;
    }
    if (servingsError) { toast({ title: servingsError, variant: "destructive" }); return; }
    let finalName = name.trim();
    if (asCopy) {
      const chosen = window.prompt("Namn på kopian", `${finalName} (kopia)`);
      if (chosen === null) return;
      finalName = chosen.trim();
      if (!finalName) { toast({ title: "Ange ett namn", variant: "destructive" }); return; }
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      name: finalName.slice(0, 120),
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
    const { error } = isEditing && !asCopy
      ? await supabase.from("recipes").update(payload).eq("id", initialRecipeId!).eq("user_id", userId)
      : await supabase.from("recipes").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" }); return; }
    toast({ title: asCopy ? "Kopia sparad under Mina recept" : isEditing ? "Recept uppdaterat" : templateRecipe ? "Sparat som eget recept under Mina recept" : "Recept sparat" });
    reset();
    onSaved();
    onOpenChange(false);
  }

  async function deleteRecipe() {
    if (!initialRecipeId) return;
    if (!window.confirm(`Radera receptet "${name.trim() || "utan namn"}"? Det går inte att ångra. Redan loggade måltider ligger kvar.`)) return;
    setSaving(true);
    const { error } = await supabase.from("recipes").delete().eq("id", initialRecipeId).eq("user_id", userId);
    setSaving(false);
    if (error) { toast({ title: "Kunde inte radera receptet", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Receptet raderat" });
    reset();
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="font-serif">{isEditing ? "Redigera recept" : templateRecipe ? "Redigera som eget recept" : "Nytt recept"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
        <div className="space-y-3">
          {!isEditing && (
            <div>
              <label className="text-xs font-medium">Importera från länk</label>
              <div className="flex gap-2">
                <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://matblogg.se/recept…" inputMode="url" className="rounded-xl bg-muted/50 border-transparent" />
                <button onClick={importFromUrl} disabled={importing || !importUrl.trim()} className="pill-btn-soft px-3 text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Hämta
                </button>
              </div>
            </div>
          )}
          {imported && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 space-y-2">
              <p className="text-sm font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-warning" /> Granska innan du sparar</p>
              <p className="text-xs text-muted-foreground">Receptet tolkades av AI och kan innehålla fel. Kontrollera namn, portioner, ingredienser och gram nedan – ändra eller ta bort det som inte stämmer.</p>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="accent-primary w-4 h-4" />
                Jag har granskat ingredienserna och mängderna
              </label>
            </div>
          )}
          <div>
            <label className="text-xs font-medium">Namn</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl bg-muted/50 border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Portioner</label>
              <Input value={servings} onChange={(e) => setServings(e.target.value)} inputMode="numeric" pattern="[0-9]*" aria-invalid={!!servingsError || undefined} className="rounded-xl bg-muted/50 border-transparent" />
              {servingsError && <p className="text-[11px] text-destructive mt-0.5">{servingsError}</p>}
            </div>
            <div>
              <label className="text-xs font-medium">Synlighet</label>
              <div className="flex gap-1">
                <button onClick={() => setVisibility("private")} className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-full transition-colors ${visibility === "private" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}>
                  <Lock className="w-3 h-3" /> Privat
                </button>
                <button onClick={() => setVisibility("public")} className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-full transition-colors ${visibility === "public" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}>
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
                  className={`px-2 py-1.5 text-[11px] font-medium rounded-full transition-colors ${category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}
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
              <ul className="rounded-2xl bg-muted/30 overflow-hidden divide-y divide-border/40">
                {ingredients.map((ing, idx) => (
                  <li key={idx} className="py-2 px-2">
                    <div className="flex items-center justify-between gap-2">
                      {imported ? (
                        <Input value={ing.name} onChange={(e) => setIngredients((arr) => arr.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                          className="h-7 text-sm rounded-lg bg-muted/50 border-transparent flex-1" aria-label="Ingrediensnamn" />
                      ) : (
                        <p className="text-sm font-medium truncate flex-1">{ing.name}</p>
                      )}
                      <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-destructive p-1" aria-label="Ta bort"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={String(ing.amount)}
                        onChange={(e) => updateIngredientAmount(idx, e.target.value)}
                        inputMode="decimal"
                        pattern="[0-9.,]*"
                        className="rounded-xl bg-muted/50 border-transparent h-7 w-20 text-xs"
                        aria-label="Mängd"
                      />
                      {(() => {
                        const linked = ing as any;
                        const food = measureFoods.find((f) => linked.id ? f.id === linked.id : f.name === ing.name);
                        const options = ingredientUnitOptions(ing, food);
                        return options.length > 1 ? (
                          <Select value={ing.unit} onValueChange={(v) => changeIngredientUnit(idx, v)}>
                            <SelectTrigger aria-label={`Enhet för ${ing.name}`} className="h-7 w-16 rounded-lg px-2 text-xs bg-muted/50 border-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>{options.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : <span className="text-[11px] text-muted-foreground">{ing.unit}</span>;
                      })()}
                      <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{Math.round(ing.kcal)} kcal · P{ing.protein_g.toFixed(1)} F{ing.fat_g.toFixed(1)} K{ing.carbs_g.toFixed(1)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-muted/40 rounded-2xl p-2 grid grid-cols-4 gap-1 text-center">
            <div><p className="text-[9px] text-muted-foreground">Kcal/port.</p><p className="text-sm font-bold tabular-nums">{Math.round(totalKcal / portions)}</p></div>
            <div><p className="text-[9px] text-muted-foreground">Protein/port.</p><p className="text-sm font-bold tabular-nums">{(totalProtein / portions).toFixed(1)}g</p></div>
            <div><p className="text-[9px] text-muted-foreground">Fett/port.</p><p className="text-sm font-bold tabular-nums">{(totalFat / portions).toFixed(1)}g</p></div>
            <div><p className="text-[9px] text-muted-foreground">Kolh./port.</p><p className="text-sm font-bold tabular-nums">{(totalCarbs / portions).toFixed(1)}g</p></div>
          </div>

          <div>
            <label className="text-xs font-medium">Instruktioner (valfritt)</label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="rounded-xl bg-muted/50 border-transparent" rows={3} />
          </div>

          {templateRecipe && (
            <p className="text-[11px] text-muted-foreground">Det färdiga receptet ändras inte — dina ändringar sparas som en kopia med namnet ovan under Mina recept.</p>
          )}
          <button disabled={saving || (imported && !reviewed)} onClick={() => save(false)} className="w-full pill-btn-primary py-3 disabled:opacity-50">
            {saving ? "Sparar…" : isEditing ? "Spara ändringar" : templateRecipe ? "Spara som eget recept" : "Spara recept"}
          </button>
          {isEditing && (
            <button disabled={saving || (imported && !reviewed)} onClick={() => save(true)} className="w-full pill-btn-soft py-3 disabled:opacity-50">
              Spara som kopia…
            </button>
          )}
          {isEditing && (
            <button disabled={saving} onClick={deleteRecipe} className="w-full py-2 text-xs font-bold text-destructive">
              Radera recept
            </button>
          )}
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
