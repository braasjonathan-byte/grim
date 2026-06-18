import { useEffect, useState } from "react";
import { X, Loader2, BookmarkPlus, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toLocalDateKey } from "@/lib/dateUtils";

interface TemplateItem {
  item_name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  food_id?: string | null;
  custom_food_id?: string | null;
  recipe_id?: string | null;
}

interface MealTemplate {
  id: string;
  name: string;
  items: TemplateItem[];
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentMealSlots: string[];
  /** Items currently logged today, keyed by meal slot — used when saving a new template */
  currentDayItemsBySlot: Record<string, TemplateItem[]>;
  /** Reload meal logs after applying a template */
  onApplied: () => void;
}

const MealTemplatesDialog = ({ open, onClose, userId, currentMealSlots, currentDayItemsBySlot, onApplied }: Props) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveFromSlot, setSaveFromSlot] = useState<string>("");
  const [applyingTemplate, setApplyingTemplate] = useState<MealTemplate | null>(null);
  const [pendingSlot, setPendingSlot] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, userId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("meal_templates" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Kunde inte ladda mallar");
      return;
    }
    setTemplates(((data as any) || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      items: Array.isArray(d.items) ? d.items : [],
      created_at: d.created_at,
    })));
  }

  async function saveTemplate() {
    const items = (currentDayItemsBySlot[saveFromSlot] || []).map((i) => ({
      item_name: i.item_name,
      amount: Number(i.amount) || 0,
      unit: i.unit,
      kcal: Number(i.kcal) || 0,
      protein_g: Number(i.protein_g) || 0,
      fat_g: Number(i.fat_g) || 0,
      carbs_g: Number(i.carbs_g) || 0,
      food_id: i.food_id ?? null,
      custom_food_id: i.custom_food_id ?? null,
      recipe_id: i.recipe_id ?? null,
    }));
    if (items.length === 0) {
      toast.error("Inga livsmedel att spara i den måltiden");
      return;
    }
    const name = saveName.trim() || saveFromSlot;
    const { error } = await supabase.from("meal_templates" as any).insert({
      user_id: userId,
      name,
      items,
    } as any);
    if (error) {
      toast.error("Kunde inte spara mall");
      return;
    }
    toast.success(`Sparade mall: ${name}`);
    setSaveMode(false);
    setSaveName("");
    setSaveFromSlot("");
    void load();
  }

  async function deleteTemplate(id: string) {
    await supabase.from("meal_templates" as any).delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function applyTemplate(tpl: MealTemplate, slot: string) {
    const dateKey = toLocalDateKey(new Date());
    const rows = tpl.items.map((i) => ({
      user_id: userId,
      log_date: dateKey,
      meal_type: slot,
      item_name: i.item_name,
      amount: i.amount,
      unit: i.unit,
      kcal: i.kcal,
      protein_g: i.protein_g,
      fat_g: i.fat_g,
      carbs_g: i.carbs_g,
      food_id: i.food_id ?? null,
      custom_food_id: i.custom_food_id ?? null,
      recipe_id: i.recipe_id ?? null,
    }));
    const { error } = await supabase.from("meal_logs").insert(rows as any);
    if (error) {
      toast.error("Kunde inte använda mallen");
      return;
    }
    toast.success(`${tpl.items.length} livsmedel tillagda i ${slot}`);
    setApplyingTemplate(null);
    setPendingSlot("");
    onApplied();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-card border-t-2 sm:border-2 border-border max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-black">Måltidsmallar</p>
          <button onClick={onClose} className="p-1 hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          {!saveMode && !applyingTemplate && (
            <>
              <button
                onClick={() => setSaveMode(true)}
                className="w-full py-2 border border-dashed border-input text-xs font-bold flex items-center justify-center gap-1"
              >
                <BookmarkPlus className="w-3.5 h-3.5" /> Spara dagens måltid som mall
              </button>

              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : templates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Inga sparade mallar än</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="border border-border bg-secondary p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold truncate">{t.name}</p>
                        <button onClick={() => deleteTemplate(t.id)} className="p-1 text-destructive" aria-label="Ta bort">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t.items.length} livsmedel ·{" "}
                        {Math.round(t.items.reduce((s, i) => s + (Number(i.kcal) || 0), 0))} kcal
                      </p>
                      <button
                        onClick={() => setApplyingTemplate(t)}
                        className="w-full mt-1 py-1.5 bg-primary text-primary-foreground text-xs font-bold"
                      >
                        Använd mall
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {saveMode && (
            <div className="space-y-3">
              <p className="text-xs font-bold">Spara mall</p>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Vilken måltid?</label>
                <select
                  value={saveFromSlot}
                  onChange={(e) => setSaveFromSlot(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background text-sm"
                >
                  <option value="">Välj måltid…</option>
                  {currentMealSlots.map((s) => {
                    const count = (currentDayItemsBySlot[s] || []).length;
                    return (
                      <option key={s} value={s} disabled={count === 0}>
                        {s} ({count} livsmedel)
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Mallnamn (valfritt)</label>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="t.ex. Min frukost"
                  className="w-full px-3 py-2 border border-input bg-background text-sm"
                  maxLength={60}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSaveMode(false); setSaveName(""); setSaveFromSlot(""); }} className="flex-1 py-2 border border-input text-xs font-bold">Avbryt</button>
                <button onClick={saveTemplate} disabled={!saveFromSlot} className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Spara
                </button>
              </div>
            </div>
          )}

          {applyingTemplate && (
            <div className="space-y-3">
              <p className="text-xs font-bold">Lägg till "{applyingTemplate.name}" i:</p>
              <div className="space-y-2">
                {currentMealSlots.map((s) => (
                  <button
                    key={s}
                    onClick={() => applyTemplate(applyingTemplate, s)}
                    className="w-full text-left px-3 py-3 border border-input text-sm font-bold capitalize hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={() => setApplyingTemplate(null)} className="w-full py-1 text-xs text-muted-foreground">Avbryt</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MealTemplatesDialog;
