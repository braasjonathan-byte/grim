import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AIFoodScanDialog from "./AIFoodScanDialog";
import type { PickedItem } from "./FoodPickerDialog";
import { validateNumber, parseDecimal, macroKcal, kcalDeviation, UNUSUAL_FOOD_GRAMS } from "@/lib/inputValidation";
import ConfirmValueDialog, { FieldError } from "@/components/ConfirmValueDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: PickedItem) => void;
  userId: string;
  isHonorary: boolean;
}

export default function ManualFoodDialog({ open, onOpenChange, onPick, userId, isHonorary }: Props) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fiber, setFiber] = useState("");
  const [amount, setAmount] = useState("100");
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [confirmQueue, setConfirmQueue] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setName(""); setKcal(""); setProtein(""); setFat(""); setCarbs(""); setFiber(""); setAmount("100");
    }
  }, [open]);

  const p = validateNumber(protein, "customMacro");
  const f = validateNumber(fat, "customMacro");
  const c = validateNumber(carbs, "customMacro");
  const macroSum = (p.value ?? 0) + (f.value ?? 0) + (c.value ?? 0);
  const errs = {
    name: name.trim() ? null : "Namn måste fyllas i.",
    kcal: validateNumber(kcal, "customKcal").error,
    protein: p.error,
    fat: f.error,
    carbs: c.error,
    fiber: validateNumber(fiber, "customMacro").error,
    amount: validateNumber(amount, "foodGrams").error,
    sum: !p.error && !f.error && !c.error && macroSum > 100 ? "Protein, fett och kolhydrater kan tillsammans vara högst 100 g per 100 g." : null,
  };
  const hasErrors = Object.values(errs).some(Boolean);
  const [showErrors, setShowErrors] = useState(false);
  const show = (e: string | null, filled: string) => (showErrors || filled.trim() ? e : null);

  function requestSave() {
    if (hasErrors) { setShowErrors(true); return; }
    const k = parseDecimal(kcal);
    const msgs: string[] = [];
    if (kcalDeviation(k, p.value ?? 0, c.value ?? 0, f.value ?? 0) > 0.2) {
      msgs.push(`Kalorierna stämmer inte med makrona (beräknat ≈ ${Math.round(macroKcal(p.value ?? 0, c.value ?? 0, f.value ?? 0))} kcal). Spara ändå?`);
    }
    if (parseDecimal(amount) > UNUSUAL_FOOD_GRAMS) msgs.push("Det är ovanligt mycket. Stämmer det?");
    if (msgs.length) { setConfirmMsg(msgs[0]); setConfirmQueue(msgs.slice(1)); return; }
    void save();
  }

  async function save() {
    if (hasErrors) return;
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        name: name.trim(),
        kcal: parseDecimal(kcal),
        protein_g: p.value ?? 0,
        fat_g: f.value ?? 0,
        carbs_g: c.value ?? 0,
        fiber_g: validateNumber(fiber, "customMacro").value ?? 0,
      };
      const { data, error } = await supabase.from("custom_foods").insert(payload).select("id").single();
      if (error) throw error;
      const grams = parseDecimal(amount);
      const factor = grams / 100;
      onPick({
        source: "custom_food",
        id: data!.id,
        name: payload.name,
        amount: grams,
        unit: "g",
        kcal: payload.kcal * factor,
        protein_g: payload.protein_g * factor,
        fat_g: payload.fat_g * factor,
        carbs_g: payload.carbs_g * factor,
        fiber_g: payload.fiber_g * factor,
      });
      toast.success("Sparat i din livsmedelsbank");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  }

  const inp = "rounded-xl bg-muted/50 border-transparent";
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-serif">Eget livsmedel</DialogTitle>
          </DialogHeader>

          {isHonorary && (
            <button
              onClick={() => setScanOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 pill-btn-soft text-xs font-bold"
            >
              <Sparkles className="w-4 h-4" /> Skanna näringsinformation
            </button>
          )}

          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Namn</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="Namn på livsmedel" />
              <FieldError error={show(errs.name, name)} />
            </div>
            <p className="text-[11px] text-muted-foreground">Värden per 100 g</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Kcal</label>
                <Input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" className={inp} />
                <FieldError error={show(errs.kcal, kcal)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Protein (g)</label>
                <Input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" className={inp} />
                <FieldError error={show(errs.protein, protein)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fett (g)</label>
                <Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" className={inp} />
                <FieldError error={show(errs.fat, fat)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Kolhydrater (g)</label>
                <Input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="decimal" className={inp} />
                <FieldError error={show(errs.carbs, carbs)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fiber (g, valfritt)</label>
                <Input value={fiber} onChange={(e) => setFiber(e.target.value)} inputMode="decimal" className={inp} />
                <FieldError error={show(errs.fiber, fiber)} />
              </div>
            </div>
            <FieldError error={errs.sum} />
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mängd att lägga till (g)</label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inp} />
              <FieldError error={show(errs.amount, amount)} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="flex-1 pill-btn-ghost py-2.5 text-sm">Avbryt</button>
            <button onClick={requestSave} disabled={saving || (showErrors && hasErrors)} className="flex-1 pill-btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Spara & lägg till
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmValueDialog
        message={confirmMsg}
        onConfirm={() => {
          if (confirmQueue.length) { setConfirmMsg(confirmQueue[0]); setConfirmQueue(confirmQueue.slice(1)); return; }
          setConfirmMsg(null); void save();
        }}
        onCancel={() => { setConfirmMsg(null); setConfirmQueue([]); }}
      />

      <AIFoodScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onPick={(item) => {
          setScanOpen(false);
          onPick(item);
          onOpenChange(false);
        }}
      />
    </>
  );
}
