import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Mic, Square, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { PickedItem } from "./FoodPickerDialog";
import { aiItemToPicked, recordWav, rescalePicked, type AiFoodItem } from "@/lib/aiFood";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (items: PickedItem[]) => void;
}

type Row = { item: PickedItem; on: boolean; amountText: string };

export default function VoiceFoodDialog({ open, onOpenChange, onConfirm }: Props) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [transcript, setTranscript] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const rec = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);

  useEffect(() => {
    if (!open) { rec.current?.cancel(); rec.current = null; setState("idle"); setTranscript(""); setRows([]); }
  }, [open]);

  async function start() {
    try { rec.current = await recordWav(); setState("rec"); }
    catch { toast.error("Kunde inte komma åt mikrofonen. Tillåt mikrofon i inställningarna."); }
  }

  async function stop() {
    if (!rec.current) return;
    setState("busy");
    try {
      const file = await rec.current.stop();
      rec.current = null;
      const fd = new FormData();
      fd.append("file", file);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/nutrition-voice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Något gick fel");
      setTranscript(body.transcript || "");
      const items: AiFoodItem[] = body.items || [];
      if (!items.length) toast.info("Hittade inga livsmedel i beskrivningen");
      setRows(items.map((it, i) => { const p = aiItemToPicked(it, i); return { item: p, on: true, amountText: String(p.amount) }; }));
    } catch (e: any) {
      toast.error(e?.message || "Kunde inte tolka inspelningen");
    } finally {
      setState("idle");
    }
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  const chosen = rows.filter((r) => r.on);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto p-4">
        <DialogHeader><DialogTitle className="font-serif">Logga med rösten</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Säg t.ex. "en skiva bröd med smör och två ägg".</p>

        <div className="flex flex-col items-center gap-2 py-2">
          {state === "rec" ? (
            <button onClick={stop} aria-label="Stoppa inspelning" className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center animate-pulse">
              <Square className="w-6 h-6" />
            </button>
          ) : (
            <button onClick={start} disabled={state === "busy"} aria-label="Starta inspelning" className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
              {state === "busy" ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
            </button>
          )}
          <p className="text-[11px] text-muted-foreground">{state === "rec" ? "Spelar in… tryck för att stoppa" : state === "busy" ? "Tolkar…" : "Tryck för att prata"}</p>
        </div>

        {transcript && <p className="text-xs italic text-muted-foreground text-center">"{transcript}"</p>}

        {rows.length > 0 && (
          <>
            <p className="text-[11px] text-muted-foreground">Förslag – uppskattade värden. Justera eller avmarkera innan du loggar.</p>
            <ul className="rounded-2xl bg-muted/30 divide-y divide-border/40">
              {rows.map((r, i) => (
                <li key={i} className={`p-2 flex items-center gap-2 ${r.on ? "" : "opacity-50"}`}>
                  <button onClick={() => update(i, { on: !r.on })} aria-label={r.on ? "Avmarkera" : "Markera"}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${r.on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                    {r.on && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <Input value={r.item.name} onChange={(e) => update(i, { item: { ...r.item, name: e.target.value } })} className="h-7 text-sm rounded-lg bg-transparent border-transparent px-1" />
                    <p className="text-[10px] text-muted-foreground tabular-nums px-1">{Math.round(r.item.kcal)} kcal · P{r.item.protein_g.toFixed(1)} F{r.item.fat_g.toFixed(1)} K{r.item.carbs_g.toFixed(1)}</p>
                  </div>
                  <Input value={r.amountText} inputMode="decimal" aria-label="Gram"
                    onChange={(e) => {
                      const n = parseFloat(e.target.value.replace(",", "."));
                      update(i, { amountText: e.target.value, ...(n > 0 ? { item: rescalePicked(r.item, n) } : {}) });
                    }}
                    className="h-7 w-16 text-xs rounded-lg bg-muted/50 border-transparent" />
                  <span className="text-[11px] text-muted-foreground">g</span>
                </li>
              ))}
            </ul>
            <button disabled={!chosen.length} onClick={() => onConfirm(chosen.map((r) => r.item))} className="w-full pill-btn-primary py-2.5 text-sm disabled:opacity-50">
              Logga {chosen.length} livsmedel
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
