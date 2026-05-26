import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Target, BookOpen, Trash2, Pencil, GripVertical, ChefHat } from "lucide-react";
import MacroRings from "./MacroRings";
import FoodPickerDialog, { PickedItem } from "./FoodPickerDialog";
import RecipeEditor from "./RecipeEditor";
import NutritionGoalsDialog from "./NutritionGoalsDialog";
import MealNameDialog from "./MealNameDialog";
import CuratedRecipesDialog from "./CuratedRecipesDialog";
import { toLocalDateKey } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
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
}

const DEFAULT_TARGETS = { kcal: 2000, protein_g: 100, fat_g: 70, carbs_g: 250 };

interface SortableMealProps {
  meal: string;
  isCustom: boolean;
  logs: MealLog[];
  mealKcal: number;
  onAdd: () => void;
  onRename: () => void;
  onDelete: () => void;
  onRemoveLog: (id: string) => void;
}

function SortableMeal({ meal, isCustom, logs, mealKcal, onAdd, onRename, onDelete, onRemoveLog }: SortableMealProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: meal, disabled: !isCustom });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };
  return (
    <div ref={setNodeRef} style={style} className="border border-border bg-card">
      <div className="flex items-center justify-between bg-muted/40 px-2 py-2 gap-2">
        {isCustom && (
          <button {...attributes} {...listeners} className="p-1 -ml-1 cursor-grab active:cursor-grabbing touch-none text-muted-foreground" aria-label="Dra för att flytta">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold capitalize font-serif truncate">{meal}</p>
          <p className="text-[10px] text-muted-foreground">{Math.round(mealKcal)} kcal</p>
        </div>
        <div className="flex items-center gap-1">
          {isCustom && (
            <>
              <button onClick={onRename} className="p-1.5" aria-label="Byt namn"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={onDelete} className="p-1.5 text-destructive" aria-label="Ta bort"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
          <button onClick={onAdd} className="flex items-center gap-1 text-xs font-bold text-primary ml-1 px-1">
            <Plus className="w-3.5 h-3.5" /> Lägg till
          </button>
        </div>
      </div>
      {logs.length > 0 && (
        <ul className="divide-y divide-border">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{l.item_name}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {l.amount} {l.unit} · {Math.round(Number(l.kcal))} kcal · P{Number(l.protein_g).toFixed(0)} F{Number(l.fat_g).toFixed(0)} K{Number(l.carbs_g).toFixed(0)}
                </p>
              </div>
              <button onClick={() => onRemoveLog(l.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
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
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [picker, setPicker] = useState<string | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [curatedOpen, setCuratedOpen] = useState(false);
  const [curatedTargetMeal, setCuratedTargetMeal] = useState<string | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [addNameOpen, setAddNameOpen] = useState(false);
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dateKey = toLocalDateKey(date);

  async function load() {
    const [logsR, goalsR] = await Promise.all([
      supabase.from("meal_logs").select("*").eq("user_id", userId).eq("log_date", dateKey).order("created_at"),
      supabase.from("nutrition_goals").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    setLogs((logsR.data as MealLog[]) || []);
    if (goalsR.data) {
      setTargets({ kcal: goalsR.data.daily_kcal, protein_g: goalsR.data.protein_g, fat_g: goalsR.data.fat_g, carbs_g: goalsR.data.carbs_g });
      const ms = (goalsR.data as any).meal_slots as string[] | null;
      if (ms && ms.length) setSlots(ms);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, dateKey]);

  const allSlots = useMemo(() => {
    const extras = Array.from(new Set(logs.map((l) => l.meal_type))).filter((m) => !slots.includes(m));
    return [...slots, ...extras];
  }, [slots, logs]);

  const totals = useMemo(() => ({
    kcal: logs.reduce((s, l) => s + Number(l.kcal), 0),
    protein: logs.reduce((s, l) => s + Number(l.protein_g), 0),
    fat: logs.reduce((s, l) => s + Number(l.fat_g), 0),
    carbs: logs.reduce((s, l) => s + Number(l.carbs_g), 0),
  }), [logs]);

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

  function deleteSlot(idx: number) {
    const name = slots[idx];
    const hasLogs = logs.some((l) => l.meal_type === name);
    if (hasLogs && !window.confirm(`Ta bort "${name}"? Alla loggade livsmedel under denna måltid tas också bort.`)) return;
    if (!hasLogs && !window.confirm(`Ta bort "${name}"?`)) return;
    persistSlots(slots.filter((_, i) => i !== idx));
    if (hasLogs) {
      supabase.from("meal_logs").delete().eq("user_id", userId).eq("meal_type", name).then(() => load());
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = slots.indexOf(String(active.id));
    const newIdx = slots.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    persistSlots(arrayMove(slots, oldIdx, newIdx));
  }

  async function addLog(meal: string, item: PickedItem) {
    const { error } = await supabase.from("meal_logs").insert({
      user_id: userId, log_date: dateKey, meal_type: meal, item_name: item.name,
      amount: item.amount, unit: item.unit,
      kcal: item.kcal, protein_g: item.protein_g, fat_g: item.fat_g, carbs_g: item.carbs_g,
      food_id: item.source === "food" ? item.id : null,
      custom_food_id: item.source === "custom_food" ? item.id : null,
      recipe_id: item.source === "recipe" ? item.id : null,
    });
    if (error) toast({ title: "Fel", description: error.message, variant: "destructive" });
    else { setPicker(null); load(); }
  }

  async function removeLog(id: string) {
    await supabase.from("meal_logs").delete().eq("id", id);
    load();
  }

  function shiftDay(n: number) {
    const d = new Date(date); d.setDate(d.getDate() + n); setDate(d);
  }

  const isToday = dateKey === toLocalDateKey(new Date());
  const dateLabel = date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDay(-1)} className="p-2 hover:bg-accent"><ChevronLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <p className="font-serif text-lg capitalize">{dateLabel}</p>
          {!isToday && <button onClick={() => setDate(new Date())} className="text-[10px] text-primary font-bold">Gå till idag</button>}
        </div>
        <button onClick={() => shiftDay(1)} className="p-2 hover:bg-accent"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="border border-border bg-card p-4 space-y-4">
        <MacroRings kcal={totals.kcal} protein={totals.protein} fat={totals.fat} carbs={totals.carbs} targets={targets} />

        <div className="flex gap-2">
          <button onClick={() => setGoalsOpen(true)} className="flex-1 flex items-center justify-center gap-1 py-2 border border-input text-xs font-bold">
            <Target className="w-3 h-3" /> Mål
          </button>
          <button onClick={() => setRecipeOpen(true)} className="flex-1 flex items-center justify-center gap-1 py-2 border border-input text-xs font-bold">
            <BookOpen className="w-3 h-3" /> Nytt recept
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={slots} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {allSlots.map((meal, idx) => {
                const isCustom = idx < slots.length;
                const ml = logs.filter((l) => l.meal_type === meal);
                const mealKcal = ml.reduce((s, l) => s + Number(l.kcal), 0);
                return (
                  <SortableMeal
                    key={meal}
                    meal={meal}
                    isCustom={isCustom}
                    logs={ml}
                    mealKcal={mealKcal}
                    onAdd={() => setPicker(meal)}
                    onRename={() => setRenameIdx(idx)}
                    onDelete={() => deleteSlot(idx)}
                    onRemoveLog={removeLog}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <button onClick={() => setAddNameOpen(true)} className="w-full flex items-center justify-center gap-1 py-2 border border-dashed border-input text-xs font-bold">
          <Plus className="w-3 h-3" /> Lägg till måltid
        </button>
      </div>

      <FoodPickerDialog open={!!picker} onOpenChange={(v) => !v && setPicker(null)} userId={userId} onPick={(item) => picker && addLog(picker, item)} />
      <RecipeEditor open={recipeOpen} onOpenChange={setRecipeOpen} userId={userId} onSaved={load} />
      <NutritionGoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} userId={userId} onSaved={load} />
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
    </div>
  );
}
