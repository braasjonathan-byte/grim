import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { PickedItem } from "./FoodPickerDialog";
import { aiItemToPicked, recordWav, rescalePicked, type AiFoodItem } from "@/lib/aiFood";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slots: string[];
  dateKey: string;
  onConfirm: (rows: { meal: string; item: PickedItem }[]) => Promise<void> | void;
}

type Row = { meal: string; item: PickedItem; on: boolean; amountText: string };

export default function DayFoodDialog({ open, onOpenChange, slots, dateKey, onConfirm }: Props) {
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [text, setText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const rec = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);

  useEffect(() => {
    if (!open) { rec.current?.cancel(); rec.current = null; setState("idle"); setText(""); setTranscript(""); setRows([]); }
  }, [open]);

  async function send(fd: FormData) {
    setState("busy");
    try {
      fd.append("slots", JSON.stringify(slots));
      fd.append("date", dateKey);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/nutrition-day`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Något gick fel");
      setTranscript(body.transcript || "");
      const meals: { meal: string; items: AiFoodItem[] }[] = body.meals || [];
      if (!meals.length) toast.info("Hittade inga livsmedel i beskrivningen");
      let i = 0;
      setRows(meals.flatMap((m) => m.items.map((it) => {
        const p = aiItemToPicked(it, i++);
        return { meal: m.meal, item: p, on: true, amountText: String(p.amount) };
      })));
    } catch (e: any) {
      toast.error(e?.message || "Kunde inte tolka beskrivningen");
    } finally {
      setState("idle");
    }
  }

  async function start() {
    try { rec.current = await recordWav(); setState("rec"); }
    catch { toast.error("Kunde inte komma åt mikrofonen. Tillåt mikrofon i inställningarna."); }
  }

  async function stop() {
    if (!rec.current) return;
    try {
      const file = await rec.current.stop();
      rec.current = null;
      const fd = new FormData(); fd.append("file", file);
      await send(fd);
    } catch (e: any) { rec.current = null; setState("idle"); toast.error(e?.message || "Inspelningen misslyckades"); }
  }

  function interpretText() {
    if (!text.trim()) return;
    const fd = new FormData(); fd.append("text", text.trim());
    void send(fd);
  }

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const chosen = rows.filter((r) => r.on);
  const mealOrder = Array.from(new Set(rows.map((r) => r.meal)));
  const totalKcal = chosen.reduce((s, r) => s + r.item.kcal, 0);

  async function confirm() {
    setSaving(true);
    try { await onConfirm(chosen.map((r) => ({ meal: r.meal, item: r.item }))); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto p-4">
        <DialogHeader><DialogTitle className="font-serif flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Beskriv dagens kost</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Säg eller skriv t.ex. "Till frukost äter jag gröt med blåbär. Till lunch kycklingsallad. Till middag lax med potatis." Du kan också säga "samma lunch som igår" eller "en Big Mac-meny på McDonald's".</p>

        <div className="flex flex-col items-center gap-2 py-1">
          {state === "rec" ? (
            <button onClick={stop} aria-label="Stoppa inspelning" className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center animate-pulse">
              <Square className="w-6 h-6" />
            </button>
          ) : (
            <button onClick={start} disabled={state === "busy"} aria-label="Starta inspelning" className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
              {state === "busy" ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
            </button>
          )}
          <p className="text-[11px] text-muted-foreground">{state === "rec" ? "Spelar in… tryck för att stoppa" : state === "busy" ? "AI tolkar…" : "Tryck för att prata"}</p>
        </div>

        {state !== "rec" && (
          <div className="space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="…eller skriv här" rows={3} maxLength={3000} className="rounded-xl text-sm" />
            <button onClick={interpretText} disabled={!text.trim() || state === "busy"} className="w-full pill-btn bg-primary/10 text-primary py-2 text-xs disabled:opacity-50">
              Tolka texten
            </button>
          </div>
        )}

        {transcript && <p className="text-xs italic text-muted-foreground text-center">"{transcript}"</p>}

        {rows.length > 0 && (
          <>
            <p className="text-[11px] text-muted-foreground">Förslag – uppskattade värden. Justera, byt måltid eller avmarkera innan du loggar.</p>
            {mealOrder.map((meal) => (
              <div key={meal} className="space-y-1">
                <p className="text-xs font-semibold capitalize">{meal}</p>
                <ul className="rounded-2xl bg-muted/30 divide-y divide-border/40">
                  {rows.map((r, i) => r.meal !== meal ? null : (
                    <li key={i} className={`p-2 flex items-center gap-2 ${r.on ? "" : "opacity-50"}`}>
                      <button onClick={() => update(i, { on: !r.on })} aria-label={r.on ? "Avmarkera" : "Markera"}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${r.on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                        {r.on && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <Input value={r.item.name} onChange={(e) => update(i, { item: { ...r.item, name: e.target.value } })} className="h-7 text-sm rounded-lg bg-transparent border-transparent px-1" />
                        <div className="flex items-center gap-1 px-1">
                          <select value={r.meal} onChange={(e) => update(i, { meal: e.target.value })} aria-label="Måltid"
                            className="text-[10px] bg-transparent text-muted-foreground capitalize">
                            {slots.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <span className="text-[10px] text-muted-foreground tabular-nums">· {Math.round(r.item.kcal)} kcal · P{r.item.protein_g.toFixed(1)} F{r.item.fat_g.toFixed(1)} K{r.item.carbs_g.toFixed(1)}</span>
                        </div>
                      </div>
                      <Input value={r.amountText} inputMode="decimal" aria-label="Gram"
                        onChange={(e) => {
                          const n = parseFloat(e.target.value.replace(",", "."));
                          update(i, { amountText: e.target.value, ...(n > 0 && n <= 5000 ? { item: rescalePicked(r.item, n) } : {}) });
                        }}
                        className="h-7 w-16 text-xs rounded-lg bg-muted/50 border-transparent" />
                      <span className="text-[11px] text-muted-foreground">g</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <button disabled={!chosen.length || saving} onClick={confirm} className="w-full pill-btn-primary py-2.5 text-sm disabled:opacity-50">
              {saving ? "Sparar…" : `Logga ${chosen.length} livsmedel · ${Math.round(totalKcal)} kcal`}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
