import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pickImage } from "@/lib/pickImage";
import { Capacitor } from "@capacitor/core";
import { scanPick, type ScanItem, type ScanRow } from "@/lib/foodScan";
import { validateNumber } from "@/lib/inputValidation";
import type { PickedItem } from "./FoodPickerDialog";

interface Props {
  open: boolean; onOpenChange: (open: boolean) => void;
  onPick?: (item: PickedItem) => void;
  onPickMany?: (items: PickedItem[], sources: string[]) => Promise<void>;
  meal?: string | null;
}
const SOURCE = { livsmedelsverket: "Livsmedelsverket", egen: "Eget livsmedel", ai: "AI-uppskattning", label: "Avläst näringsdeklaration (AI)" };

export default function AIFoodScanDialog({ open, onOpenChange, onPick, onPickMany, meal }: Props) {
  const [mode, setMode] = useState<"dish" | "label">("dish");
  const [photo, setPhoto] = useState<string | null>(null);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveToBank, setSaveToBank] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const lock = useRef(false);
  useEffect(() => {
    if (!open) { generation.current++; setPhoto(null); setRows([]); setError(""); setBusy(false); setMode(onPickMany ? "dish" : "label"); }
  }, [open, onPickMany]);

  async function analyze(image: string) {
    const seq = ++generation.current;
    setBusy(true); setError(""); setRows([]);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("nutrition-ai-scan", { body: { image, mode, components: !!onPickMany } });
      if (invokeError || data?.error) throw new Error(data?.error || "Bildanalysen kunde inte slutföras. Försök igen.");
      if (seq !== generation.current) return;
      const items: ScanItem[] = data.items ?? [data];
      if (!items.length || items.some(item => !item.food)) throw new Error("Ingen mat kunde identifieras.");
      setRows(items.map(item => ({ ...item, selected: true, grams: String(Math.round(item.portion_g)) })));
    } catch (cause) { if (seq === generation.current) setError(cause instanceof Error ? cause.message : "Bildanalysen misslyckades."); }
    finally { if (seq === generation.current) setBusy(false); }
  }
  async function acceptFile(file?: File) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size > 20_000_000) { setError("Välj en bild som är högst 20 MB."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) { bitmap.close(); throw new Error("Bilden kunde inte öppnas."); }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const image = canvas.toDataURL("image/jpeg", 0.85);
      setPhoto(image); void analyze(image);
    } catch { setError("Bildformatet kunde inte öppnas. Välj en JPG- eller PNG-bild."); }
  }
  async function choose(source: "camera" | "gallery") {
    if (Capacitor.isNativePlatform()) {
      const picked = await pickImage({ source, quality: 80 });
      if (picked) void acceptFile(picked.file);
    } else (source === "camera" ? cameraRef : fileRef).current?.click();
  }
  const selected = rows.filter(row => row.selected);
  const picks = selected.map((row, index) => scanPick(row, index));
  const valid = selected.length > 0 && picks.every(item => item !== null);
  const total = picks.reduce((sum, item) => sum + (item?.kcal ?? 0), 0);
  const macros = picks.reduce((sum, item) => ({ protein: sum.protein + (item?.protein_g ?? 0), fat: sum.fat + (item?.fat_g ?? 0), carbs: sum.carbs + (item?.carbs_g ?? 0) }), { protein: 0, fat: 0, carbs: 0 });
  function update(index: number, patch: Partial<ScanRow>) { setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  async function confirm() {
    if (!valid || lock.current) return;
    lock.current = true; setSaving(true); setError("");
    try {
      const items = picks.filter((item): item is PickedItem => item !== null);
      if (onPickMany) await onPickMany(items, selected.map(row => row.source));
      else {
        const item = items[0];
        if (!item || !onPick) return;
        if (mode === "label" && saveToBank && !selected[0].food.id) {
          const { data: auth } = await supabase.auth.getUser();
          if (!auth.user) throw new Error("Logga in igen för att spara.");
          const { id: _id, ...food } = selected[0].food;
          const { data, error: saveError } = await supabase.from("custom_foods").insert({ ...food, fiber_g: food.fiber_g ?? 0, user_id: auth.user.id, nutrition_source: "ai" }).select("id").single();
          if (saveError || !data) throw new Error("Livsmedlet kunde inte sparas. Försök igen.");
          item.id = data.id;
          update(rows.indexOf(selected[0]), { food: { ...selected[0].food, id: data.id } });
        }
        onPick(item);
      }
      onOpenChange(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Måltiden kunde inte sparas. Dina val finns kvar."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <Sheet open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
    <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl p-4 sm:max-w-lg sm:mx-auto">
      <SheetHeader><SheetTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Skanna mat{meal ? ` · ${meal}` : ""}</SheetTitle></SheetHeader>
      <div className="space-y-4 pt-4" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy && !saving) void acceptFile(event.dataTransfer.files[0]); }}>
        {!rows.length && <div className="grid grid-cols-2 gap-2">{(["dish", "label"] as const).map(value => <Button key={value} variant={mode === value ? "default" : "outline"} disabled={busy} onClick={() => { setMode(value); setPhoto(null); setError(""); }}>{value === "dish" ? "Maträtt" : "Näringstabell"}</Button>)}</div>}
        {photo && <img src={photo} alt="Valt matfoto" className="w-full h-40 rounded-lg object-contain bg-muted" />}
        {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> Analyserar bilden…</p>}
        {!photo && <div className="grid grid-cols-2 gap-2"><Button onClick={() => void choose("camera")} className="min-h-12 gap-2"><Camera className="w-4 h-4" /> Kamera</Button><Button variant="outline" className="min-h-12 gap-2" onClick={() => void choose("gallery")}><ImageIcon className="w-4 h-4" /> Galleri</Button></div>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={event => { void acceptFile(event.target.files?.[0]); event.target.value = ""; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { void acceptFile(event.target.files?.[0]); event.target.value = ""; }} />
        {!!rows.length && <>
          <p className="text-xs text-muted-foreground">Mängder från foto är uppskattningar. Kontrollera maten och mängderna före loggning.</p>
          <div className="divide-y divide-border">{rows.map((row, index) => <div key={index} className="py-3 space-y-2">
            <div className="flex gap-3 items-start"><Checkbox aria-label={`Ta med ${row.food.name}`} checked={row.selected} disabled={saving} onCheckedChange={value => update(index, { selected: value === true })} className="mt-2" />
              <div className="min-w-0 flex-1"><Input aria-label={`Namn på mat ${index + 1}`} value={row.food.name} maxLength={120} disabled={saving} onChange={event => update(index, { food: { ...row.food, name: event.target.value, id: null }, source: "ai" })} /><p className="text-xs text-muted-foreground mt-1">{SOURCE[row.source]}</p>{row.identified?.name && row.identified.name !== row.food.name && <p className="text-xs text-muted-foreground">Identifierat: {row.identified.name}</p>}</div></div>
            <div className="flex items-center gap-2 pl-7"><Input aria-label={`Gram för mat ${index + 1}`} inputMode="decimal" value={row.grams} disabled={saving || !row.selected} onChange={event => update(index, { grams: event.target.value })} className="w-24" /><span className="text-sm">g</span><span className="text-xs text-muted-foreground ml-auto">{Math.round(scanPick(row, index)?.kcal ?? 0)} kcal</span></div>
            {row.selected && validateNumber(row.grams, "foodGrams").error && <p role="alert" className="text-xs text-destructive pl-7">{validateNumber(row.grams, "foodGrams").error}</p>}
          </div>)}</div>
          {!onPickMany && mode === "label" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={saveToBank} disabled={saving} onCheckedChange={value => setSaveToBank(value === true)} /> Spara i min livsmedelsbank</label>}
          <div className="flex justify-between text-sm font-semibold"><span>{selected.length} valda livsmedel</span><span>{Math.round(total)} kcal</span></div>
          <p className="text-xs text-muted-foreground">Protein {Math.round(macros.protein)} g · Fett {Math.round(macros.fat)} g · Kolhydrater {Math.round(macros.carbs)} g</p>
          <Button className="w-full min-h-12 whitespace-normal" disabled={!valid || saving} onClick={() => void confirm()}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{meal ? `Lägg till i ${meal}` : "Lägg till"}</Button>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {photo && !busy && <div className="flex gap-2">{!rows.length && <Button variant="outline" onClick={() => void analyze(photo)}>Försök igen</Button>}<Button variant="ghost" disabled={saving} onClick={() => { generation.current++; setPhoto(null); setRows([]); setError(""); }}>Välj nytt foto</Button></div>}
      </div>
    </SheetContent>
  </Sheet>;
}
