import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AIFoodScanDialog from "./AIFoodScanDialog";
import type { PickedItem } from "./FoodPickerDialog";

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
  const [amount, setAmount] = useState("100");
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setName(""); setKcal(""); setProtein(""); setFat(""); setCarbs(""); setAmount("100");
    }
  }, [open]);

  const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

  async function save() {
    if (!name.trim()) { toast.error("Ange ett namn"); return; }
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        name: name.trim(),
        kcal: num(kcal),
        protein_g: num(protein),
        fat_g: num(fat),
        carbs_g: num(carbs),
      };
      const { data, error } = await supabase.from("custom_foods").insert(payload).select("id").single();
      if (error) throw error;
      const grams = num(amount);
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
      });
      toast.success("Sparat i din livsmedelsbank");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  }

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
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-primary text-primary text-xs font-bold"
            >
              <Sparkles className="w-4 h-4" /> Skanna näringsinformation
            </button>
          )}

          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Namn</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-none" placeholder="Namn på livsmedel" />
            </div>
            <p className="text-[11px] text-muted-foreground">Värden per 100 g</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Kcal</label>
                <Input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" className="rounded-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Protein (g)</label>
                <Input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" className="rounded-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fett (g)</label>
                <Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" className="rounded-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Kolhydrater (g)</label>
                <Input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="decimal" className="rounded-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mängd att lägga till (g)</label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="rounded-none" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => onOpenChange(false)} className="flex-1 py-2.5 border border-input text-sm font-medium">Avbryt</button>
            <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Spara & lägg till
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
