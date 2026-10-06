import { validateNumber, parseDecimal, formatDecimal, isPlausibleMealLog, IMPLAUSIBLE_LABEL, UNUSUAL_FOOD_GRAMS, UNUSUAL_QUICK_KCAL, type NumberRule } from "@/lib/inputValidation";
import ConfirmValueDialog, { FieldError } from "@/components/ConfirmValueDialog";
const QUICK_MACRO: NumberRule = { min: 0, max: 1000, unit: "g", optional: true };
import { hapticLight } from "@/lib/haptics";
import { loadWorkoutBurned } from "@/lib/workoutBurned";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Target, Trash2, Pencil, GripVertical, ChefHat, Bookmark, MoreHorizontal, CopyPlus, Zap, BookmarkPlus, ArrowRightLeft, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import NutritionHero from "./NutritionHero";
import FoodPickerDialog, { PickedItem } from "./FoodPickerDialog";
import RecipeEditor from "./RecipeEditor";
import NutritionGoalsDialog from "./NutritionGoalsDialog";
import MealNameDialog from "./MealNameDialog";
import CuratedRecipesDialog from "./CuratedRecipesDialog";
import MealTemplatesDialog from "./MealTemplatesDialog";
import WaterTracker from "./WaterTracker";
import FastingWidget from "./FastingWidget";
import { foodQualityScore, MICROS, pickMicros, scaleMicros, type Micros } from "@/lib/micronutrients";
import { toLocalDateKey } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { showUndoToast } from "@/lib/undoToast";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props { userId: string; isHonorary?: boolean }

const DEFAULT_SLOTS = ["frukost", "lunch", "middag", "mellanmål"];

interface MealLog {
  id: string;
  meal_type: string;
  item_name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
}

const MEAL_SHARE: Record<string, number> = { frukost: 0.25, lunch: 0.35, middag: 0.3, "mellanmål": 0.1 };

const FOOD_EMOJI: [RegExp, string][] = [
  [/ägg/i, "🥚"], [/banan/i, "🍌"], [/äpple/i, "🍎"], [/apelsin|juice/i, "🍊"], [/bär|blåbär|jordgubb|hallon/i, "🫐"],
  [/kaffe|latte|cappuccino/i, "☕"], [/te\b/i, "🍵"], [/mjölk|fil|yoghurt|kvarg/i, "🥛"], [/havre|gröt|müsli|flingor/i, "🥣"],
  [/bröd|macka|knäck|toast/i, "🍞"], [/ost/i, "🧀"], [/kyckling|fågel/i, "🍗"], [/lax|fisk|tonfisk|torsk|räk/i, "🐟"],
  [/nöt|biff|fläsk|kött|färs|korv|bacon/i, "🥩"], [/pasta|spagetti|nudl/i, "🍝"], [/ris/i, "🍚"], [/potatis/i, "🥔"],
  [/sallad|grönsak|tomat|gurka|broccoli/i, "🥗"], [/pizza/i, "🍕"], [/burgare|hamburg/i, "🍔"], [/choklad|godis|kaka|bulle/i, "🍫"],
  [/avokado/i, "🥑"], [/vatten/i, "💧"], [/öl|vin/i, "🍷"], [/snabbpost|⚡/i, "⚡"],
];
const foodEmoji = (name: string) => FOOD_EMOJI.find(([re]) => re.test(name))?.[1] ?? "🍽️";

// Ikoner i måltidsraden ska aldrig upprepas: vid kollision plockas en
// oanvänd generisk ikon i stället (t.ex. två livsmedel utan träff -> 🍽️ + 🥄).
const GENERIC_ICONS = ["🍽️", "🥄", "🍴", "🫙", "🍳", "🧂", "🥡"];
const uniqueMealIcons = (logs: MealLog[]) => {
  const used = new Set<string>();
  return logs.map((l) => {
    let e = foodEmoji(l.item_name);
    if (used.has(e)) e = GENERIC_ICONS.find((g) => !used.has(g)) ?? e;
    used.add(e);
    return e;
  });
};

const FEELINGS = [
  { key: "light", emoji: "🙂", label: "Lätt" },
  { key: "good", emoji: "😋", label: "Lagom" },
  { key: "full", emoji: "😮‍💨", label: "Mätt" },
];

const DEFAULT_TARGETS: { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number | null } = { kcal: 2000, protein_g: 100, fat_g: 70, carbs_g: 250, fiber_g: null };

interface SortableMealProps {
  meal: string;
  isCustom: boolean;
  logs: MealLog[];
  mealKcal: number;
  onAdd: () => void;
  onRename: () => void;
  onDelete: () => void;
  onRemoveLog: (id: string) => void;
  onEditLog: (l: MealLog) => void;
  onCopyYesterday?: () => void;
  onQuickLog: () => void;
  onSaveTemplate?: () => void;
  budget?: number;
  feeling?: string;
  onFeeling: (k: string | null) => void;
}

function SortableMeal({ meal, isCustom, logs, mealKcal, onAdd, onRename, onDelete, onRemoveLog, onEditLog, onCopyYesterday, onQuickLog, onSaveTemplate, budget, feeling, onFeeling }: SortableMealProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: meal, disabled: !isCustom });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-2xl bg-card shadow-soft border border-border/40 overflow-hidden">
      <div className="flex items-center justify-between bg-muted/30 px-2.5 py-2.5 gap-2">
        {isCustom && (
          <button {...attributes} {...listeners} className="p-1 -ml-1 cursor-grab active:cursor-grabbing touch-none text-muted-foreground" aria-label="Dra för att flytta">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold capitalize font-serif truncate">{meal}</p>
          <p className={`text-[10px] tabular-nums ${budget && mealKcal > budget * 1.1 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            {Math.round(mealKcal)}{budget ? ` / ${Math.round(budget)}` : ""} kcal
          </p>
          {logs.length > 0 && (
            <p className="text-[10px] tabular-nums text-muted-foreground truncate">
              {Math.round(logs.filter((l) => isPlausibleMealLog(l)).reduce((s, l) => s + Number(l.protein_g || 0), 0))}g P · {Math.round(logs.filter((l) => isPlausibleMealLog(l)).reduce((s, l) => s + Number(l.carbs_g || 0), 0))}g K · {Math.round(logs.filter((l) => isPlausibleMealLog(l)).reduce((s, l) => s + Number(l.fat_g || 0), 0))}g F
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onCopyYesterday && (
            <button onClick={onCopyYesterday} className="w-8 h-8 icon-round text-muted-foreground hover:bg-muted/60 transition-colors" aria-label={`Kopiera ${meal} från igår`} title="Kopiera från igår">
              <CopyPlus className="w-4 h-4" />
            </button>
          )}
          <button onClick={onQuickLog} className="w-8 h-8 icon-round text-muted-foreground hover:bg-muted/60 transition-colors" aria-label={`Snabbpost i ${meal}`} title="Snabbpost (bara kcal)">
            <Zap className="w-4 h-4" />
          </button>
          <button onClick={onAdd} className="pill-btn-soft text-xs px-3 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Lägg till
          </button>
          {(isCustom || onSaveTemplate) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 icon-round text-muted-foreground hover:bg-muted/60 transition-colors" aria-label="Fler val">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                {onSaveTemplate && (
                  <DropdownMenuItem onClick={onSaveTemplate}>
                    <BookmarkPlus className="w-3.5 h-3.5 mr-2" /> Spara som måltidsmall
                  </DropdownMenuItem>
                )}
                {isCustom && (
                  <>
                    <DropdownMenuItem onClick={onRename}>
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Byt namn
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Ta bort
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {logs.length > 0 && (
        <div className="px-3 pt-2.5 flex items-start justify-between gap-2">
          <div className="flex -space-x-1.5 overflow-hidden pt-0.5">
            {uniqueMealIcons(logs.slice(0, 5)).map((emoji, i) => (
              <span key={logs[i].id} className="w-9 h-9 rounded-full bg-muted border-2 border-card flex items-center justify-center text-lg" title={logs[i].item_name}>{emoji}</span>
            ))}
            {logs.length > 5 && <span className="w-9 h-9 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold">+{logs.length - 5}</span>}
          </div>
          <div className="flex gap-2" role="group" aria-label="Hur kändes måltiden?">
            {FEELINGS.map((f) => (
              <button key={f.key} onClick={() => onFeeling(feeling === f.key ? null : f.key)} title={`Måltiden kändes: ${f.label}`} aria-label={`Måltiden kändes: ${f.label}`} aria-pressed={feeling === f.key}
                className="flex flex-col items-center gap-0.5">
                <span className={`w-8 h-8 rounded-full text-base flex items-center justify-center transition-all ${feeling === f.key ? "bg-primary/20 ring-2 ring-primary scale-110" : feeling ? "opacity-40" : "bg-muted/40"}`}>{f.emoji}</span>
                <span className={`text-[9px] leading-none ${feeling === f.key ? "font-semibold text-primary" : "text-muted-foreground"}`}>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {logs.length > 0 && (
        <ul className="divide-y divide-border/40">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm truncate">{l.item_name}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {!isPlausibleMealLog(l) && <span className="text-destructive font-semibold">{IMPLAUSIBLE_LABEL} · </span>}{formatDecimal(l.amount)} {l.unit} · {Math.round(Number(l.kcal))} kcal · P{Number(l.protein_g).toFixed(0)} F{Number(l.fat_g).toFixed(0)} K{Number(l.carbs_g).toFixed(0)}
                </p>
              </div>
              <button onClick={() => onEditLog(l)} className="w-8 h-8 icon-round text-muted-foreground hover:bg-muted/60 transition-colors" aria-label="Redigera"><Pencil className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>

  );
}

export default function NutritionView({ userId, isHonorary = false }: Props) {
  const [date, setDate] = useState(() => new Date());
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [microTargets, setMicroTargets] = useState<Micros>({});
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [picker, setPicker] = useState<string | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [curatedOpen, setCuratedOpen] = useState(false);
  const [curatedTargetMeal, setCuratedTargetMeal] = useState<string | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<PickedItem | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [addNameOpen, setAddNameOpen] = useState(false);
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  const [editingLog, setEditingLog] = useState<MealLog | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [waterGoal, setWaterGoal] = useState(2000);
  const [burned, setBurned] = useState(0);
  const [feelings, setFeelings] = useState<Record<string, string>>({});
  const [yesterdayLogs, setYesterdayLogs] = useState<any[]>([]);
  const [quickMeal, setQuickMeal] = useState<string | null>(null);
  const [quick, setQuick] = useState({ name: "", kcal: "", protein: "", fat: "", carbs: "" });

  const quickErrs = {
    kcal: validateNumber(quick.kcal, "quickKcal").error,
    protein: validateNumber(quick.protein, QUICK_MACRO).error,
    fat: validateNumber(quick.fat, QUICK_MACRO).error,
    carbs: validateNumber(quick.carbs, QUICK_MACRO).error,
  };
  const quickHasErrors = Object.values(quickErrs).some(Boolean);
  const [valueConfirm, setValueConfirm] = useState<{ msg: string; run: () => void } | null>(null);
  function requestQuickSave() {
    if (quickHasErrors) return;
    if (parseDecimal(quick.kcal) > UNUSUAL_QUICK_KCAL) { setValueConfirm({ msg: "Det är ovanligt mycket. Stämmer det?", run: () => void saveQuickLog() }); return; }
    void saveQuickLog();
  }

  async function saveQuickLog() {
    if (!quickMeal) return;
    if (quickHasErrors) return;
    const num = (v: string) => validateNumber(v, QUICK_MACRO).value ?? 0;
    const kcal = parseDecimal(quick.kcal);
    const { error } = await supabase.from("meal_logs").insert({
      user_id: userId, log_date: dateKey, meal_type: quickMeal,
      item_name: quick.name.trim() || "Snabbpost", amount: 1, unit: "portion",
      kcal, protein_g: num(quick.protein), fat_g: num(quick.fat), carbs_g: num(quick.carbs), fiber_g: 0,
    });
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    setQuickMeal(null);
    setQuick({ name: "", kcal: "", protein: "", fat: "", carbs: "" });
    load();
  }

  async function saveMealAsTemplate(meal: string) {
    const rows = logs.filter((l) => l.meal_type === meal);
    if (!rows.length) return;
    const name = window.prompt("Namn på mallen", `Min ${meal}`);
    if (!name?.trim()) return;
    const items = rows.map((i: any) => ({
      item_name: i.item_name, amount: Number(i.amount) || 0, unit: i.unit,
      kcal: Number(i.kcal) || 0, protein_g: Number(i.protein_g) || 0, fat_g: Number(i.fat_g) || 0, carbs_g: Number(i.carbs_g) || 0,
      food_id: i.food_id ?? null, custom_food_id: i.custom_food_id ?? null, recipe_id: i.recipe_id ?? null,
    }));
    const { error } = await supabase.from("meal_templates" as any).insert({ user_id: userId, name: name.trim(), items } as any);
    if (error) toast({ title: "Kunde inte spara mall", description: error.message, variant: "destructive" });
    else toast({ title: `Sparade mall: ${name.trim()}`, description: "Hittas under Mallar" });
  }

  async function moveLog(meal: string) {
    if (!editingLog || meal === editingLog.meal_type) return;
    const prev = editingLog.meal_type, id = editingLog.id;
    const { error } = await supabase.from("meal_logs").update({ meal_type: meal }).eq("id", id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    setEditingLog(null);
    load();
    showUndoToast(`Flyttad till ${meal}`, async () => { await supabase.from("meal_logs").update({ meal_type: prev }).eq("id", id); load(); });
  }

  async function copyLogTo(dayOffset: number) {
    if (!editingLog) return;
    const { data: rows } = await supabase.from("meal_logs").select("*").eq("id", editingLog.id);
    const row: any = rows?.[0];
    if (!row) return;
    const d = dayOffset === 0 ? new Date() : new Date(date);
    if (dayOffset !== 0) d.setDate(d.getDate() + dayOffset);
    const { id, created_at, ...rest } = row;
    const { error } = await supabase.from("meal_logs").insert({ ...rest, log_date: toLocalDateKey(d) });
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    toast({ title: dayOffset === 0 ? "Kopierad till idag" : "Kopierad till nästa dag" });
    setEditingLog(null);
    load();
  }

  useEffect(() => {
    if (editingLog) setEditAmount(formatDecimal(editingLog.amount));
  }, [editingLog]);

  const editAmountError = editingLog
    ? validateNumber(editAmount, editingLog.unit === "g" ? "foodGrams" : { min: 0.1, max: 1000, unit: editingLog.unit }).error
    : null;
  function requestEditSave() {
    if (!editingLog || editAmountError) return;
    if (editingLog.unit === "g" && parseDecimal(editAmount) > UNUSUAL_FOOD_GRAMS) { setValueConfirm({ msg: "Det är ovanligt mycket. Stämmer det?", run: () => void saveEditLog() }); return; }
    void saveEditLog();
  }

  async function saveEditLog() {
    if (!editingLog) return;
    if (editAmountError) return;
    const newAmt = parseDecimal(editAmount);
    const oldAmt = Number(editingLog.amount) || 1;
    const f = newAmt / oldAmt;
    const { error } = await supabase.from("meal_logs").update({
      amount: newAmt,
      kcal: Number(editingLog.kcal) * f,
      protein_g: Number(editingLog.protein_g) * f,
      fat_g: Number(editingLog.fat_g) * f,
      carbs_g: Number(editingLog.carbs_g) * f,
      fiber_g: Number(editingLog.fiber_g || 0) * f,
      ...scaleMicros(pickMicros(editingLog), f),
      sugar_g: (editingLog as any).sugar_g != null ? Number((editingLog as any).sugar_g) * f : null,
    } as any).eq("id", editingLog.id);
    if (error) { toast({ title: "Fel", description: error.message, variant: "destructive" }); return; }
    setEditingLog(null);
    load();
  }

  async function deleteEditLog() {
    if (!editingLog) return;
    await supabase.from("meal_logs").delete().eq("id", editingLog.id);
    setEditingLog(null);
    load();
  }
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dateKey = toLocalDateKey(date);

  async function load() {
    const y = new Date(date); y.setDate(y.getDate() - 1);
    const [logsR, goalsR, yR] = await Promise.all([
      supabase.from("meal_logs").select("*").eq("user_id", userId).eq("log_date", dateKey).order("created_at"),
      supabase.from("nutrition_goals").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("meal_logs").select("*").eq("user_id", userId).eq("log_date", toLocalDateKey(y)).order("created_at"),
    ]);
    setLogs((logsR.data as MealLog[]) || []);
    setYesterdayLogs(yR.data || []);
    if (goalsR.data) {
      setTargets({ kcal: goalsR.data.daily_kcal, protein_g: goalsR.data.protein_g, fat_g: goalsR.data.fat_g, carbs_g: goalsR.data.carbs_g, fiber_g: goalsR.data.fiber_g ?? null });
      setMicroTargets(pickMicros(goalsR.data));
      setWaterGoal(goalsR.data.water_goal_ml ?? 2000);
      const ms = (goalsR.data as any).meal_slots as string[] | null;
      if (ms && ms.length) setSlots(ms);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, dateKey]);

  const feelKey = `grim-meal-feel:${userId}:${dateKey}`;
  useEffect(() => {
    let cancelled = false;
    let local: Record<string, string> = {};
    try { local = JSON.parse(localStorage.getItem(feelKey) || "{}"); } catch { /* ignore */ }
    setFeelings(local);
    (supabase as any).from("meal_feelings").select("meal_type, feeling").eq("user_id", userId).eq("log_date", dateKey)
      .then(async ({ data, error }: any) => {
        if (cancelled || error) return;
        const remote: Record<string, string> = {};
        for (const r of data || []) remote[r.meal_type] = r.feeling;
        // Migrate old locally stored feelings once
        const toMigrate = Object.entries(local).filter(([m]) => !remote[m]);
        if (toMigrate.length) {
          await (supabase as any).from("meal_feelings").upsert(
            toMigrate.map(([meal_type, feeling]) => ({ user_id: userId, log_date: dateKey, meal_type, feeling })),
            { onConflict: "user_id,log_date,meal_type" },
          );
          for (const [m, f] of toMigrate) remote[m] = f;
        }
        try { localStorage.removeItem(feelKey); } catch { /* ignore */ }
        if (!cancelled) setFeelings(remote);
      });
    loadWorkoutBurned(userId, dateKey).then(setBurned).catch(() => setBurned(0));
    return () => { cancelled = true; };
  }, [feelKey, userId, dateKey]);

  function setFeeling(meal: string, k: string | null) {
    hapticLight();
    setFeelings((prev) => {
      const next = { ...prev };
      if (k) next[meal] = k; else delete next[meal];
      return next;
    });
    const t = (supabase as any).from("meal_feelings");
    const p = k
      ? t.upsert({ user_id: userId, log_date: dateKey, meal_type: meal, feeling: k, updated_at: new Date().toISOString() }, { onConflict: "user_id,log_date,meal_type" })
      : t.delete().eq("user_id", userId).eq("log_date", dateKey).eq("meal_type", meal);
    p.then(({ error }: any) => { if (error) toast({ title: "Kunde inte spara känslan", variant: "destructive" }); });
  }

  const allSlots = useMemo(() => {
    const extras = Array.from(new Set(logs.map((l) => l.meal_type))).filter((m) => !slots.includes(m));
    return [...slots, ...extras];
  }, [slots, logs]);

  // Kostposter utanför gränserna räknas inte i totalerna (visas märkta i listan).
  const plausibleLogs = useMemo(() => logs.filter((l) => isPlausibleMealLog(l)), [logs]);
  const totals = useMemo(() => ({
    kcal: plausibleLogs.reduce((s, l) => s + Number(l.kcal), 0),
    protein: plausibleLogs.reduce((s, l) => s + Number(l.protein_g), 0),
    fat: plausibleLogs.reduce((s, l) => s + Number(l.fat_g), 0),
    carbs: plausibleLogs.reduce((s, l) => s + Number(l.carbs_g), 0),
    fiber: plausibleLogs.reduce((s, l) => s + Number(l.fiber_g || 0), 0),
  }), [plausibleLogs]);

  const microTotals = useMemo(() => {
    const out: Micros = {};
    for (const m of MICROS) {
      const vals = logs.map((l: any) => l[m.key]).filter((v) => v != null);
      if (vals.length) out[m.key] = vals.reduce((a: number, v: any) => a + Number(v), 0);
    }
    return out;
  }, [logs]);

  /** Copy yesterday's logged items (optionally only one meal) to the shown day. */
  async function copyFromYesterday(meal?: string) {
    const rows = yesterdayLogs.filter((r) => !meal || r.meal_type === meal);
    if (rows.length === 0) { toast({ title: meal ? `Inget loggat i ${meal} igår` : "Inget loggat igår" }); return; }
    const label = meal ? `${meal} (${rows.length} livsmedel)` : `alla ${rows.length} livsmedel`;
    if (!window.confirm(`Kopiera ${label} från igår?`)) return;
    const insert = rows.map(({ id, created_at, ...r }: any) => ({ ...r, log_date: dateKey }));
    const { data, error } = await supabase.from("meal_logs").insert(insert).select("id");
    if (error) { toast({ title: "Kunde inte kopiera", description: error.message, variant: "destructive" }); return; }
    load();
    const ids = (data || []).map((d) => d.id);
    showUndoToast(`Kopierade ${rows.length} livsmedel från igår`, async () => {
      if (ids.length) await supabase.from("meal_logs").delete().in("id", ids);
      load();
    });
  }

  async function persistSlots(next: string[]) {
    setSlots(next);
    const { error } = await supabase.from("nutrition_goals").upsert(
      { user_id: userId, meal_slots: next } as any,
      { onConflict: "user_id" }
    );
    if (error) toast({ title: "Kunde inte spara måltider", description: error.message, variant: "destructive" });
  }

  function handleAddMeal(name: string) {
    if (allSlots.includes(name)) { toast({ title: "Måltiden finns redan" }); return; }
    persistSlots([...slots, name]);
  }

  function handleRename(idx: number, name: string) {
    const current = slots[idx];
    if (name === current) return;
    const next = [...slots];
    next[idx] = name;
    persistSlots(next);
    supabase.from("meal_logs").update({ meal_type: name }).eq("user_id", userId).eq("meal_type", current).then(() => load());
  }

  async function deleteSlot(idx: number) {
    const name = slots[idx];
    const hasLogs = logs.some((l) => l.meal_type === name);
    if (hasLogs && !window.confirm(`Ta bort "${name}"? Alla loggade livsmedel under denna måltid tas också bort.`)) return;
    if (!hasLogs && !window.confirm(`Ta bort "${name}"?`)) return;
    const prevSlots = slots;
    let removedRows: any[] = [];
    if (hasLogs) {
      const { data } = await supabase.from("meal_logs").select("*").eq("user_id", userId).eq("meal_type", name);
      removedRows = data || [];
    }
    persistSlots(slots.filter((_, i) => i !== idx));
    if (hasLogs) {
      await supabase.from("meal_logs").delete().eq("user_id", userId).eq("meal_type", name);
      load();
    }
    showUndoToast(`Måltiden "${name}" borttagen`, async () => {
      persistSlots(prevSlots);
      if (removedRows.length > 0) {
        await supabase.from("meal_logs").insert(removedRows);
        load();
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = slots.indexOf(String(active.id));
    const newIdx = slots.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    persistSlots(arrayMove(slots, oldIdx, newIdx));
  }

  async function addLog(meal: string, item: PickedItem, keepOpen = false) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = typeof item.id === "string" && UUID_RE.test(item.id);
    const { error } = await supabase.from("meal_logs").insert({
      user_id: userId, log_date: dateKey, meal_type: meal, item_name: item.name,
      amount: item.amount, unit: item.unit,
      kcal: item.kcal, protein_g: item.protein_g, fat_g: item.fat_g, carbs_g: item.carbs_g,
      fiber_g: item.fiber_g || 0,
      ...(item.micros || {}),
      nova_group: item.nova_group ?? null,
      sugar_g: item.sugar_g ?? null,
      food_id: item.source === "food" && isUuid ? item.id : null,
      custom_food_id: item.source === "custom_food" && isUuid ? item.id : null,
      recipe_id: item.source === "recipe" && isUuid ? item.id : null,
    });
    if (error) toast({ title: "Fel", description: error.message, variant: "destructive" });
    else if (keepOpen) { load(); }
    else { setPicker(null); setCuratedTargetMeal(null); setCuratedOpen(false); load(); }
  }

  async function removeLog(id: string) {
    const { data: rows } = await supabase.from("meal_logs").select("*").eq("id", id);
    const row: any = rows?.[0];
    await supabase.from("meal_logs").delete().eq("id", id);
    load();
    if (row) {
      showUndoToast(`"${row.item_name}" borttagen`, async () => {
        await supabase.from("meal_logs").insert(row);
        load();
      });
    }
  }

  function shiftDay(n: number) {
    const d = new Date(date); d.setDate(d.getDate() + n); setDate(d);
  }

  const isToday = dateKey === toLocalDateKey(new Date());
  const dateLabel = date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDay(-1)} className="w-9 h-9 icon-round hover:bg-muted/60 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <p className="font-serif text-lg capitalize">{dateLabel}</p>
          {!isToday && <button onClick={() => setDate(new Date())} className="text-[10px] text-primary font-bold">Gå till idag</button>}
        </div>
        <button onClick={() => shiftDay(1)} className="w-9 h-9 icon-round hover:bg-muted/60 transition-colors"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Snabbvalen ligger precis under veckodagen, före energikortet. */}
      <div className="grid grid-cols-4 gap-2">
        <button data-tour="nutrition-goals" onClick={() => setGoalsOpen(true)} className="pill-btn-ghost shadow-soft py-2 text-xs">
          <Target className="w-3 h-3" /> Mål
        </button>
        <button data-tour="nutrition-recipes" onClick={() => { setCuratedTargetMeal(null); setCuratedOpen(true); }} className="pill-btn-ghost shadow-soft py-2 text-xs">
          <ChefHat className="w-3 h-3" /> Recept
        </button>
        <button onClick={() => setTemplatesOpen(true)} className="pill-btn-ghost shadow-soft py-2 text-xs">
          <Bookmark className="w-3 h-3" /> Mallar
        </button>
        <button onClick={() => { hapticLight(); copyFromYesterday(); }} disabled={yesterdayLogs.length === 0} className="pill-btn-ghost shadow-soft py-2 text-xs disabled:opacity-40">
          <CopyPlus className="w-3 h-3" /> Igår
        </button>
      </div>


      <div className="rounded-2xl bg-card shadow-soft border border-border/40 p-4 space-y-4">
        <div data-tour="nutrition-rings">
          <NutritionHero kcal={totals.kcal} burned={burned} protein={totals.protein} fat={totals.fat} carbs={totals.carbs} fiber={totals.fiber} targets={targets} micros={microTotals} quality={foodQualityScore(logs)} microTargets={microTargets} />
        </div>

        <FastingWidget userId={userId} />

        {logs.length === 0 && (
          <div className="rounded-2xl bg-primary/5 border border-primary/25 p-3 text-center space-y-2">
            <p className="text-sm font-semibold">Inget loggat {isToday ? "idag" : "denna dag"} än</p>
            <p className="text-xs text-muted-foreground">
              Lägg till din första måltid så räknar vi kalorier och makros åt dig.
            </p>
            <button
              onClick={() => setPicker(allSlots[0] || slots[0] || "frukost")}
              className="pill-btn bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Logga din första måltid
            </button>
          </div>
        )}




        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={slots} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {allSlots.map((meal, idx) => {
                const isCustom = idx < slots.length;
                const ml = logs.filter((l) => l.meal_type === meal);
                const mealKcal = ml.filter((l) => isPlausibleMealLog(l)).reduce((s, l) => s + Number(l.kcal), 0);
                return (
                  <SortableMeal
                    key={meal}
                    meal={meal}
                    isCustom={isCustom}
                    logs={ml}
                    mealKcal={mealKcal}
                    onAdd={() => { hapticLight(); setPicker(meal); }}
                    onRename={() => setRenameIdx(idx)}
                    onDelete={() => deleteSlot(idx)}
                    onRemoveLog={removeLog}
                    onEditLog={(l) => setEditingLog(l)}
                    onQuickLog={() => { hapticLight(); setQuickMeal(meal); }}
                    onSaveTemplate={ml.length > 0 ? () => saveMealAsTemplate(meal) : undefined}
                    budget={MEAL_SHARE[meal.toLowerCase()] ? MEAL_SHARE[meal.toLowerCase()] * targets.kcal : undefined}
                    feeling={feelings[meal]}
                    onFeeling={(k) => setFeeling(meal, k)}
                    onCopyYesterday={yesterdayLogs.some((r) => r.meal_type === meal) ? () => copyFromYesterday(meal) : undefined}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <button data-tour="nutrition-add-meal" onClick={() => setAddNameOpen(true)} className="w-full pill-btn bg-primary/10 text-primary py-2.5 text-xs hover:bg-primary/20">
          <Plus className="w-3 h-3" /> Lägg till måltid
        </button>

      </div>

      <WaterTracker userId={userId} dateKey={dateKey} goalMl={waterGoal} />

      <FoodPickerDialog
        open={!!picker}
        onOpenChange={(v) => !v && setPicker(null)}
        userId={userId}
        onPick={(item, opts) => picker && addLog(picker, item, !!opts?.keepOpen)}
        onEditRecipe={(id) => { setPicker(null); setEditingRecipeId(id); setRecipeOpen(true); }}
      />
      <RecipeEditor
        open={recipeOpen}
        onOpenChange={(v) => { setRecipeOpen(v); if (!v) setEditingRecipeId(null); }}
        userId={userId}
        onSaved={load}
        initialRecipeId={editingRecipeId}
      />
      <CuratedRecipesDialog
        open={curatedOpen}
        onOpenChange={(v) => { setCuratedOpen(v); if (!v) setCuratedTargetMeal(null); }}
        isHonorary={isHonorary}
        onCreateOwn={() => setRecipeOpen(true)}
        onPick={(item) => {
          if (curatedTargetMeal) {
            addLog(curatedTargetMeal, item);
          } else {
            setPendingRecipe(item);
            setCuratedOpen(false);
          }
        }}
      />

      {pendingRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setPendingRecipe(null)}>
          <div className="bg-card rounded-2xl shadow-soft border border-border/40 w-full sm:max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-serif text-lg">Lägg till i måltid</p>
              <p className="text-xs text-muted-foreground truncate">{pendingRecipe.name}</p>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {allSlots.map((meal) => (
                <button
                  key={meal}
                  onClick={() => { const it = pendingRecipe; setPendingRecipe(null); addLog(meal, it); }}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-secondary text-sm font-semibold capitalize hover:bg-muted transition-colors"
                >
                  {meal}
                </button>
              ))}
            </div>
            <button onClick={() => setPendingRecipe(null)} className="w-full py-2 text-xs text-muted-foreground">Avbryt</button>
          </div>
        </div>
      )}

      <NutritionGoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} userId={userId} onSaved={load} />
      <MealTemplatesDialog
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        userId={userId}
        currentMealSlots={allSlots}
        currentDayItemsBySlot={Object.fromEntries(allSlots.map((s) => [s, logs.filter((l) => l.meal_type === s)]))}
        onApplied={load}
      />
      <MealNameDialog
        open={addNameOpen}
        onOpenChange={setAddNameOpen}
        title="Ny måltid"
        existing={allSlots}
        onSave={handleAddMeal}
      />
      <MealNameDialog
        open={renameIdx !== null}
        onOpenChange={(v) => !v && setRenameIdx(null)}
        title="Byt namn på måltid"
        initial={renameIdx !== null ? slots[renameIdx] : ""}
        existing={allSlots}
        onSave={(name) => { if (renameIdx !== null) handleRename(renameIdx, name); setRenameIdx(null); }}
      />

      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditingLog(null)}>
          <div className="bg-card rounded-2xl shadow-soft border border-border/40 w-full sm:max-w-sm p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-serif text-lg">Redigera livsmedel</p>
              <p className="text-xs text-muted-foreground truncate">{editingLog.item_name}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold">Mängd ({editingLog.unit})</label>
              <input
                type="text"
                inputMode="decimal"
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => { if (e.key === "Enter") requestEditSave(); }}
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full input-soft"
                aria-invalid={!!editAmountError || undefined}
                autoFocus
              />
              <FieldError error={editAmountError} />
              {(() => {
                const n = parseFloat(editAmount.replace(",", "."));
                const oldAmt = Number(editingLog.amount) || 1;
                const f = isFinite(n) && n > 0 ? n / oldAmt : 1;
                return (
                  <p className="text-[10px] text-muted-foreground tabular-nums pt-1">
                    {Math.round(Number(editingLog.kcal) * f)} kcal · P{(Number(editingLog.protein_g) * f).toFixed(0)} F{(Number(editingLog.fat_g) * f).toFixed(0)} K{(Number(editingLog.carbs_g) * f).toFixed(0)}
                  </p>
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Flytta till</p>
              <div className="flex flex-wrap gap-1.5">
                {allSlots.filter((m) => m !== editingLog.meal_type).map((m) => (
                  <button key={m} onClick={() => moveLog(m)} className="px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold capitalize hover:bg-muted">{m}</button>
                ))}
              </div>
              <p className="text-xs font-bold flex items-center gap-1 pt-1"><Copy className="w-3 h-3" /> Kopiera till</p>
              <div className="flex flex-wrap gap-1.5">
                {!isToday && <button onClick={() => copyLogTo(0)} className="px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold hover:bg-muted">Idag</button>}
                <button onClick={() => copyLogTo(1)} className="px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold hover:bg-muted">Nästa dag</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={deleteEditLog} className="flex-1 py-2 rounded-full bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Ta bort
              </button>
              <button onClick={requestEditSave} disabled={!!editAmountError} className="flex-1 pill-btn-primary py-2 text-xs disabled:opacity-50">
                Spara
              </button>
            </div>
            <button onClick={() => setEditingLog(null)} className="w-full py-1 text-xs text-muted-foreground">Avbryt</button>
          </div>
        </div>
      )}
      {quickMeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setQuickMeal(null)}>
          <div className="bg-card rounded-2xl shadow-soft border border-border/40 w-full sm:max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-serif text-lg flex items-center gap-1.5"><Zap className="w-4 h-4 text-primary" /> Snabbpost</p>
              <p className="text-xs text-muted-foreground capitalize">{quickMeal} · ange bara kalorier om du inte vet mer</p>
            </div>
            <input className="w-full input-soft" placeholder="Anteckning (t.ex. Lunch på stan)" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
            <input className="w-full input-soft text-lg font-bold" inputMode="decimal" placeholder="Kalorier (kcal)" autoFocus value={quick.kcal}
              onChange={(e) => setQuick({ ...quick, kcal: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") requestQuickSave(); }} />
            <FieldError error={quick.kcal.trim() ? quickErrs.kcal : null} />
            <div className="grid grid-cols-3 gap-2">
              {([["protein", "Protein g"], ["fat", "Fett g"], ["carbs", "Kolh. g"]] as const).map(([k, l]) => (
                <div key={k} className="min-w-0"><input className="input-soft w-full text-sm" inputMode="decimal" placeholder={l} value={quick[k]} onChange={(e) => setQuick({ ...quick, [k]: e.target.value })} /><FieldError error={quickErrs[k]} /></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["100", "250", "400", "600", "800"].map((k) => (
                <button key={k} onClick={() => setQuick({ ...quick, kcal: k })} className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${quick.kcal === k ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{k} kcal</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setQuickMeal(null)} className="flex-1 pill-btn-ghost py-2 text-xs">Avbryt</button>
              <button onClick={requestQuickSave} disabled={quickHasErrors} className="flex-1 pill-btn-primary py-2 text-xs disabled:opacity-50">Spara</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmValueDialog message={valueConfirm?.msg ?? null} onConfirm={() => { const r = valueConfirm?.run; setValueConfirm(null); r?.(); }} onCancel={() => setValueConfirm(null)} />
    </div>
  );
}
