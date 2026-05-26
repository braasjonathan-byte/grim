import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Camera, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UNITS, toGrams } from "@/lib/nutritionCalc";
import type { PickedItem } from "./FoodPickerDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: PickedItem) => void;
}

interface AIResult {
  source: "livsmedelsverket" | "ai";
  food: { id: string | null; name: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number };
  portion_g: number;
  identified: { confidence?: number };
}

export default function AIFoodScanDialog({ open, onOpenChange, onPick }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState("g");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) { stopCam(); setPhoto(null); setResult(null); return; }
    startCam();
    return () => stopCam();
    // eslint-disable-next-line
  }, [open]);

  async function startCam() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
    } catch {
      // fallback to file input
    }
  }
  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function snap() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    const max = 1024;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    c.width = v.videoWidth * scale; c.height = v.videoHeight * scale;
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.8);
    setPhoto(url);
    stopCam();
    analyze(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { const url = r.result as string; setPhoto(url); analyze(url); };
    r.readAsDataURL(f);
  }

  async function analyze(url: string) {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("nutrition-ai-scan", { body: { image: url } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setAmount(String(Math.round(data.portion_g || 100)));
      setUnit("g");
    } catch (e: any) {
      toast({ title: "AI-analys misslyckades", description: e?.message, variant: "destructive" });
      setPhoto(null); startCam();
    } finally {
      setAnalyzing(false);
    }
  }

  function confirm() {
    if (!result) return;
    const a = parseFloat(amount.replace(",", ".")) || 0;
    const grams = toGrams(a, unit);
    const factor = grams / 100;
    onPick({
      source: result.food.id ? "food" : "custom_food",
      id: result.food.id || "ai-" + Date.now(),
      name: result.food.name,
      amount: a, unit,
      kcal: result.food.kcal * factor,
      protein_g: result.food.protein_g * factor,
      fat_g: result.food.fat_g * factor,
      carbs_g: result.food.carbs_g * factor,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI-skanna mat</DialogTitle>
        </DialogHeader>

        {!result && (
          <div className="space-y-3">
            <div className="relative bg-black aspect-square overflow-hidden flex items-center justify-center">
              {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />}
              {analyzing && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-xs">Analyserar maträtt…</p>
                  </div>
                </div>
              )}
            </div>
            {!photo && (
              <div className="flex gap-2">
                <button onClick={snap} className="flex-1 py-3 bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2"><Camera className="w-4 h-4" /> Ta foto</button>
                <button onClick={() => fileRef.current?.click()} className="px-3 py-3 border border-input text-sm">Galleri</button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground text-center">Endast för hedersmedlemmar. AI:n identifierar maträtten och uppskattar makros.</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            {photo && <img src={photo} alt="" className="w-full max-h-48 object-cover" />}
            <div className="border border-border p-3 bg-muted/40">
              <p className="font-bold text-sm">{result.food.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">
                Källa: {result.source === "livsmedelsverket" ? "Livsmedelsverket" : "AI-uppskattning"}
                {result.identified?.confidence != null && ` · ${Math.round(result.identified.confidence * 100)}% säkerhet`}
              </p>
              <div className="grid grid-cols-4 gap-2 text-center mt-2">
                <div><p className="text-[10px] text-muted-foreground">Kcal/100g</p><p className="font-bold tabular-nums">{Math.round(result.food.kcal)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Protein</p><p className="font-bold tabular-nums">{result.food.protein_g.toFixed(1)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Fett</p><p className="font-bold tabular-nums">{result.food.fat_g.toFixed(1)}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Kh</p><p className="font-bold tabular-nums">{result.food.carbs_g.toFixed(1)}</p></div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Mängd (AI uppskattade {Math.round(result.portion_g)} g)</label>
              <div className="flex gap-2 mt-1">
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" pattern="[0-9.,]*" className="rounded-none flex-1" />
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border border-input bg-background px-2 text-sm">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setResult(null); setPhoto(null); startCam(); }} className="flex-1 py-2.5 border border-input text-sm font-medium">Ta nytt foto</button>
              <button onClick={confirm} className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold">Lägg till</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
