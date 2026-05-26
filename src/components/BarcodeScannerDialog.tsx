import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UNITS, toGrams } from "@/lib/nutritionCalc";
import type { PickedItem } from "./FoodPickerDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: PickedItem) => void;
}

interface FoundFood {
  source: "livsmedelsverket" | "openfoodfacts";
  food: { id: string | null; name: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number };
  product_name: string;
}

export default function BarcodeScannerDialog({ open, onOpenChange, onPick }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lookup, setLookup] = useState(false);
  const [found, setFound] = useState<FoundFood | null>(null);
  const [manual, setManual] = useState("");
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState("g");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      stop();
      setFound(null);
      setManual("");
      return;
    }
    start();
    return () => stop();
    // eslint-disable-next-line
  }, [open]);

  async function start() {
    if (found) return;
    setScanning(true);
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result) {
          const text = result.getText();
          if (/^\d{6,14}$/.test(text)) {
            controls.stop();
            setScanning(false);
            lookupBarcode(text);
          }
        }
      });
      controlsRef.current = controls;
    } catch (e: any) {
      setScanning(false);
      toast({ title: "Kunde inte starta kameran", description: e?.message || "Kontrollera behörigheter", variant: "destructive" });
    }
  }

  function stop() {
    try { controlsRef.current?.stop(); } catch {}
    controlsRef.current = null;
    readerRef.current = null;
    setScanning(false);
  }

  async function lookupBarcode(barcode: string) {
    setLookup(true);
    try {
      const { data, error } = await supabase.functions.invoke("nutrition-barcode", { body: { barcode } });
      if (error) throw error;
      if (!data?.found) {
        toast({ title: "Produkt ej hittad", description: `Streckkod ${barcode}`, variant: "destructive" });
        start();
        return;
      }
      setFound(data);
    } catch (e: any) {
      toast({ title: "Sökningen misslyckades", description: e?.message, variant: "destructive" });
      start();
    } finally {
      setLookup(false);
    }
  }

  function confirm() {
    if (!found) return;
    const a = parseFloat(amount.replace(",", ".")) || 0;
    const grams = toGrams(a, unit);
    const factor = grams / 100;
    onPick({
      source: found.food.id ? "food" : "custom_food",
      id: found.food.id || "barcode-" + Date.now(),
      name: found.food.name,
      amount: a, unit,
      kcal: found.food.kcal * factor,
      protein_g: found.food.protein_g * factor,
      fat_g: found.food.fat_g * factor,
      carbs_g: found.food.carbs_g * factor,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4">
        <DialogHeader>
          <DialogTitle className="font-serif">Skanna streckkod</DialogTitle>
        </DialogHeader>

        {!found && (
          <div className="space-y-3">
            <div className="relative bg-black aspect-square overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-primary/80" />
              {(scanning || lookup) && (
                <div className="absolute top-2 right-2 bg-background/80 px-2 py-1 text-[10px] flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {lookup ? "Söker…" : "Skannar…"}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Eller skriv in streckkoden manuellt</label>
              <div className="flex gap-2 mt-1">
                <Input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder="t.ex. 7311170010014" className="rounded-none" />
                <button onClick={() => manual && lookupBarcode(manual)} className="px-3 bg-primary text-primary-foreground text-sm font-bold">Sök</button>
              </div>
            </div>
          </div>
        )}

        {found && (
          <div className="space-y-3">
            <div className="border border-border p-3 bg-muted/40">
              <p className="font-bold text-sm">{found.food.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">
                Källa: {found.source === "livsmedelsverket" ? "Livsmedelsverket" : "Open Food Facts"}
              </p>
              <div className="grid grid-cols-4 gap-2 text-center mt-2">
                <div><p className="text-[10px] text-muted-foreground">Kcal/100g</p><p className="font-bold tabular-nums">{Math.round(found.food.kcal)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Protein</p><p className="font-bold tabular-nums">{found.food.protein_g.toFixed(1)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Fett</p><p className="font-bold tabular-nums">{found.food.fat_g.toFixed(1)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Kh</p><p className="font-bold tabular-nums">{found.food.carbs_g.toFixed(1)}</p></div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Mängd</label>
              <div className="flex gap-2 mt-1">
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" pattern="[0-9.,]*" className="rounded-none flex-1" />
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border border-input bg-background px-2 text-sm">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setFound(null); start(); }} className="flex-1 py-2.5 border border-input text-sm font-medium">Skanna igen</button>
              <button onClick={confirm} className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold">Lägg till</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
