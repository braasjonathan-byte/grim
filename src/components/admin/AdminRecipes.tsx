import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { CURATED_RECIPES, RECIPE_CATEGORIES, type CuratedRecipe } from "@/data/curatedRecipes";
import { useCuratedRecipes, loadRecipeOverrides, getRecipeOverrideRows } from "@/lib/curatedRecipesLive";

const NUM_FIELDS: [keyof CuratedRecipe, string][] = [
  ["servings", "Portioner"], ["kcal_per_serving", "kcal/port."], ["protein_g_per_serving", "Protein/port."],
  ["fat_g_per_serving", "Fett/port."], ["carbs_g_per_serving", "Kolh./port."],
];

export default function AdminRecipes({ userId }: { userId: string }) {
  const live = useCuratedRecipes();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<CuratedRecipe | null>(null);
  const [busy, setBusy] = useState(false);
  const baseIds = useMemo(() => new Set(CURATED_RECIPES.map((r) => r.id)), []);
  const rows = getRecipeOverrideRows();
  const hiddenIds = new Set(rows.filter((r) => r.hidden).map((r) => r.recipe_id));
  const all = useMemo(() => {
    const hidden = CURATED_RECIPES.filter((r) => hiddenIds.has(r.id));
    return [...live, ...hidden];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, rows.length]);
  const list = all.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60);

  const upsert = async (id: string, patch: { data?: any; hidden?: boolean }) => {
    setBusy(true);
    const existing = rows.find((r) => r.recipe_id === id);
    const { error } = await supabase.from("curated_recipe_overrides").upsert({
      recipe_id: id, data: patch.data !== undefined ? patch.data : existing?.data ?? null,
      hidden: patch.hidden ?? existing?.hidden ?? false, updated_at: new Date().toISOString(), updated_by: userId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    await loadRecipeOverrides();
    return true;
  };

  const resetOriginal = async (id: string) => {
    const { error } = await supabase.from("curated_recipe_overrides").delete().eq("recipe_id", id);
    if (error) return toast.error(error.message);
    await loadRecipeOverrides(); setEdit(null); toast.success("Återställt till originalet");
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error("Receptet behöver ett namn");
    const { id, ...data } = edit;
    if (await upsert(id, { data })) { toast.success("Receptet är sparat för alla"); setEdit(null); }
  };

  const newRecipe = () => setEdit({
    id: `admin-${crypto.randomUUID().slice(0, 8)}`, name: "", category: RECIPE_CATEGORIES[0] as string, servings: 2,
    instructions: "", kcal_per_serving: 0, protein_g_per_serving: 0, fat_g_per_serving: 0, carbs_g_per_serving: 0, ingredients: [],
  });

  if (edit) {
    return (
      <div className="space-y-2 text-sm">
        <Input value={edit.name} maxLength={120} placeholder="Namn" onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
          {RECIPE_CATEGORIES.map((c: any) => <option key={String(c)} value={String(c)}>{String(c)}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          {NUM_FIELDS.map(([k, label]) => (
            <label key={k} className="text-[11px] text-muted-foreground">{label}
              <Input type="number" inputMode="decimal" value={String(edit[k] ?? "")} onChange={(e) => setEdit({ ...edit, [k]: Number(e.target.value.replace(",", ".")) || 0 })} />
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Ingredienser (en per rad: namn; mängd; enhet; kcal; protein; fett; kolh.)</p>
        <Textarea rows={6} defaultValue={edit.ingredients.map((i) => [i.name, i.amount, i.unit, i.kcal, i.protein_g, i.fat_g, i.carbs_g].join("; ")).join("\n")}
          onChange={(e) => setEdit({ ...edit, ingredients: e.target.value.split("\n").map((l) => l.split(";").map((x) => x.trim())).filter((p) => p[0]).map((p) => ({
            name: p[0], amount: Number(p[1]) || 0, unit: p[2] || "g", kcal: Number(p[3]) || 0, protein_g: Number(p[4]) || 0, fat_g: Number(p[5]) || 0, carbs_g: Number(p[6]) || 0,
          })) })} />
        <Textarea rows={4} value={edit.instructions} placeholder="Instruktioner" onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={saveEdit}>Spara</Button>
          <Button size="sm" variant="outline" onClick={() => setEdit(null)}>Avbryt</Button>
          {baseIds.has(edit.id) && rows.some((r) => r.recipe_id === edit.id) && <Button size="sm" variant="outline" onClick={() => resetOriginal(edit.id)}>Återställ original</Button>}
          {!baseIds.has(edit.id) && rows.some((r) => r.recipe_id === edit.id) && <Button size="sm" variant="destructive" onClick={() => resetOriginal(edit.id)}>Radera</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök recept" />
        <Button size="sm" onClick={newRecipe}>Nytt</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{live.length} recept visas för användarna{hiddenIds.size ? `, ${hiddenIds.size} dolda` : ""}.</p>
      <ul className="divide-y divide-border">
        {list.map((r) => {
          const hidden = hiddenIds.has(r.id);
          const changed = rows.some((x) => x.recipe_id === r.id && x.data);
          return (
            <li key={r.id} className="flex items-center gap-2 py-1.5">
              <button className="flex-1 text-left" onClick={() => setEdit({ ...r })}>
                <span className={hidden ? "line-through text-muted-foreground" : ""}>{r.name}</span>
                <span className="block text-[11px] text-muted-foreground">{r.category} · {r.kcal_per_serving} kcal/port.{changed ? " · ändrad" : ""}{!baseIds.has(r.id) ? " · ny" : ""}</span>
              </button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => upsert(r.id, { hidden: !hidden })}>{hidden ? "Visa" : "Dölj"}</Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
