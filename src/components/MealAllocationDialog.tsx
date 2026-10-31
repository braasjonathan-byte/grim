import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { allocationError, defaultAllocation, mealTargets, type MealAllocation } from "@/lib/nutritionExperience";

export default function MealAllocationDialog({ open, onOpenChange, allocation, targets, onSave }: {
  open: boolean; onOpenChange: (open: boolean) => void; allocation: MealAllocation;
  targets: { kcal: number; protein_g: number }; onSave: (value: MealAllocation) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(allocation);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setDraft(allocation); }, [open, allocation]);
  const error = allocationError(draft);
  const budgets = mealTargets(draft, targets.kcal, targets.protein_g);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Fördelning mellan måltider</DialogTitle></DialogHeader>
      <div className="space-y-5">
        {Object.entries(draft).map(([meal, shares]) => <div key={meal} className="space-y-3">
          <p className="font-semibold first-letter:uppercase">{meal}</p>
          {(["kcal", "protein"] as const).map((key) => <div key={key} className="space-y-2">
            <div className="flex justify-between text-xs gap-2"><span>{key === "kcal" ? "Kalorier" : "Protein"}</span><span className="tabular-nums">{shares[key]} %{!error && ` · ${budgets[meal][key === "kcal" ? "kcal" : "protein"]} ${key === "kcal" ? "kcal" : "g"}`}</span></div>
            <Slider aria-label={`${meal} ${key === "kcal" ? "kalorier" : "protein"}`} value={[shares[key]]} min={0} max={100} step={1} onValueChange={([v]) => setDraft((prev) => ({ ...prev, [meal]: { ...prev[meal], [key]: v } }))} />
          </div>)}
        </div>)}
        <p className={`text-xs tabular-nums ${error ? "text-destructive" : "text-success"}`}>Kalorier: {Object.values(draft).reduce((s, x) => s + x.kcal, 0)} / 100 % · Protein: {Object.values(draft).reduce((s, x) => s + x.protein, 0)} / 100 %</p>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button variant="ghost" className="w-full" onClick={() => setDraft(defaultAllocation(Object.keys(draft)))}>Återställ standardfördelning</Button>
        <Button className="w-full" disabled={!!error || saving} onClick={async () => { setSaving(true); try { if (await onSave(draft)) onOpenChange(false); } finally { setSaving(false); } }}>{saving ? "Sparar…" : "Spara fördelning"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}