import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChefHat } from "lucide-react";
import { useCuratedRecipes } from "@/lib/curatedRecipesLive";
import type { CuratedRecipe } from "@/data/curatedRecipes";
import { GOAL_LABEL, type GoalType } from "@/lib/nutritionCalc";
import { toLocalDateKey } from "@/lib/dateUtils";
import CuratedRecipesDialog from "@/components/CuratedRecipesDialog";
import type { PickedItem } from "@/components/FoodPickerDialog";
import { useToast } from "@/hooks/use-toast";
import { SocialImage } from "@/components/SocialImage";

type R = CuratedRecipe & { own?: boolean };

// Vilka recept passar målet? Bara befintliga recept – inget hittas på.
const FITS: Record<string, (r: R) => boolean> = {
  lose_fast: (r) => r.kcal_per_serving <= 450 && r.protein_g_per_serving >= 15,
  lose_slow: (r) => r.kcal_per_serving <= 550 && r.protein_g_per_serving >= 12,
  recomp: (r) => r.protein_g_per_serving >= 25 && r.kcal_per_serving <= 650,
  maintain: () => true,
  lean_bulk: (r) => r.protein_g_per_serving >= 25 && r.kcal_per_serving >= 400,
  bulk: (r) => r.kcal_per_serving >= 550,
  strength: (r) => r.protein_g_per_serving >= 25,
  power: (r) => r.protein_g_per_serving >= 20 && r.carbs_g_per_serving >= 30,
  endurance: (r) => r.carbs_g_per_serving >= 45,
  keto: (r) => r.carbs_g_per_serving <= 15,
  custom: () => true,
};
const WHY: Record<string, string> = {
  lose_fast: "Lågt i kalorier men mättande protein.", lose_slow: "Lagom kalorier och bra protein.",
  recomp: "Mycket protein utan för många kalorier.", maintain: "En balanserad måltid.",
  lean_bulk: "Proteinrik med lite extra energi.", bulk: "Energität för att bygga massa.",
  strength: "Proteinrikt för starkare muskler.", power: "Protein och kolhydrater för explosivitet.",
  endurance: "Kolhydrater som bränsle för uthållighet.", keto: "Låg andel kolhydrater.", custom: "Passar din dag.",
};
const slotNow = () => { const h = new Date().getHours(); return h < 10 ? "frukost" : h < 14 ? "lunch" : h < 17 ? "mellanmål" : "middag"; };
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

export default function DailyRecipeCard({ userId, isHonorary }: { userId: string; isHonorary: boolean }) {
  const curated = useCuratedRecipes();
  const { toast } = useToast();
  const [detailOpen, setDetailOpen] = useState(false);
  const [goal, setGoal] = useState<string | null>(null);
  const [own, setOwn] = useState<R[]>([]);

  useEffect(() => {
    supabase.from("nutrition_goals").select("goal_type").eq("user_id", userId).maybeSingle()
      .then(({ data }) => setGoal(data?.goal_type || null));
    supabase.from("recipes").select("id,name,category,servings,instructions,kcal_per_serving,protein_g_per_serving,fat_g_per_serving,carbs_g_per_serving,image_url,ingredients")
      .eq("user_id", userId).then(({ data }) => setOwn(((data || []) as any[]).map((r) => ({
        id: r.id, name: r.name, category: (r.category || "").toLowerCase(), servings: Number(r.servings) || 1, instructions: r.instructions || "",
        kcal_per_serving: Math.round(Number(r.kcal_per_serving) || 0), protein_g_per_serving: Math.round(Number(r.protein_g_per_serving) || 0),
        fat_g_per_serving: Math.round(Number(r.fat_g_per_serving) || 0), carbs_g_per_serving: Math.round(Number(r.carbs_g_per_serving) || 0),
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [], image_url: r.image_url || null, own: true,
      }))));
  }, [userId]);

  const slot = slotNow();
  const pick = useMemo(() => {
    if (!goal) return null;
    const fits = FITS[goal] ?? FITS.custom;
    // Hedersmedlemmar får även färdiga recept; övriga bara sina egna (färdiga recept är låsta för dem).
    const pool: R[] = [...own, ...(isHonorary ? curated : [])].filter((r) => r.kcal_per_serving > 0 && fits(r));
    const inSlot = pool.filter((r) => r.category === slot);
    const list = inSlot.length ? inSlot : pool.filter((r) => r.category !== "dessert");
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    return sorted[hash(`${toLocalDateKey(new Date())}|${userId}|${goal}|${slot}`) % sorted.length];
  }, [goal, own, curated, isHonorary, slot, userId]);

  // Registrera från detaljvyn (ett tryck bort): samma meal_logs-rad som Kost → addLog.
  async function logPicked(item: PickedItem) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const { error } = await supabase.from("meal_logs").insert({
      user_id: userId, log_date: toLocalDateKey(new Date()), meal_type: slot, item_name: item.name,
      amount: item.amount, unit: item.unit,
      kcal: item.kcal, protein_g: item.protein_g, fat_g: item.fat_g, carbs_g: item.carbs_g, fiber_g: item.fiber_g || 0,
      recipe_id: item.source === "recipe" && UUID_RE.test(item.id) ? item.id : null,
    });
    if (error) { toast({ title: "Kunde inte registrera", description: error.message, variant: "destructive" }); return; }
    setDetailOpen(false);
    toast({ title: "Registrerat ✓", description: `${item.name} lades till i ${slot} (${Math.round(item.kcal)} kcal).` });
  }

  if (!goal) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-2" aria-label="Dagens recept">
      <div className="flex items-center gap-2">
        <ChefHat className="w-4 h-4 text-primary" />
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Dagens recept</p>
        <span className="ml-auto text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">{pick?.category || slot}</span>
      </div>
      {!pick ? (
        <p className="text-xs text-muted-foreground">Inget recept matchar ditt mål ({GOAL_LABEL[goal as GoalType] ?? goal}) än. Spara egna recept under Kost → Recept så föreslår jag ett här.</p>
      ) : (
        <button type="button" onClick={() => setDetailOpen(true)} className="w-full text-left flex gap-3 items-center">
          {pick.image_url && <SocialImage src={pick.image_url} alt={pick.name} className="w-20 h-20 rounded-xl object-cover shrink-0" loading="lazy" />}
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold">{pick.name}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">{pick.kcal_per_serving} kcal · {pick.protein_g_per_serving} g protein · {pick.carbs_g_per_serving} g kolh. · {pick.fat_g_per_serving} g fett</p>
            <p className="text-[11px] text-muted-foreground">{WHY[goal] ?? WHY.custom}</p>
          </div>
        </button>
      )}
      {pick && (
        <CuratedRecipesDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          isHonorary={isHonorary}
          userId={userId}
          initialRecipe={pick}
          addLabel={`Registrera i ${slot}`}
          onPick={(item) => { void logPicked(item); }}
        />
      )}
    </section>
  );
}
