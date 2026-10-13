import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Loader2, Check, Sparkles, BadgeCheck, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { recordWav } from "@/lib/aiFood";

/** One food as resolved by the nutrition-day function. */
export interface DayFoodItem {
  name: string; amount: number; unit: string;
  kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number;
  nova_group: number | null; micros: Record<string, number | null>;
  food_id: string | null; custom_food_id: string | null; recipe_id: string | null;
  source: "livsmedelsverket" | "egen" | "recept" | "ai"; matched_name: string | null;
  certain: boolean; question: string; options: { label: string; grams: number }[];
}
export type DayFoodRow = { meal: string; offset: number; item: DayFoodItem; aiAmount: number };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slots: string[];
  dateKey: string;
  onConfirm: (rows: DayFoodRow[]) => Promise<void> | void;
}

type Row = DayFoodRow & { on: boolean; amountText: string };

const SOURCE_LABEL: Record<DayFoodItem["source"], string> = {
  livsmedelsverket: "Livsmedelsverket", egen: "Eget livsmedel", recept: "Eget recept", ai: "Uppskattat",
};

function rescale(it: DayFoodItem, amount: number): DayFoodItem {
  const old = it.amount || 0;
  if (old <= 0) return { ...it, amount };
  const f = amount / old;
  const micros: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(it.micros || {})) micros[k] = v == null ? null : v * f;
  return { ...it, amount, kcal: it.kcal * f, protein_g: it.protein_g * f, fat_g: it.fat_g * f, carbs_g: it.carbs_g * f, fiber_g: it.fiber_g * f, micros };
}

const dayLabel = (o: number) => (o === 0 ? "" : o === -1 ? " (igår)" : o === -2 ? " (i förrgår)" : ` (${-o} dagar sedan)`);

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

  const editing = rows.length > 0;

  async function send(fd: FormData) {
    setState("busy");
    try {
      fd.append("slots", JSON.stringify(slots));
      fd.append("date", dateKey);
      if (editing) {
        fd.append("current", JSON.stringify(rows.filter((r) => r.on).map((r) => ({
          meal: r.meal, day_offset: r.offset, name: r.item.name, amount: r.item.amount, unit: r.item.unit,
          ref: r.item.recipe_id ? `recipe:${r.item.recipe_id}` : r.item.custom_food_id ? `custom:${r.item.custom_food_id}` : r.item.food_id ? `food:${r.item.food_id}` : "none",
          per100: r.item.unit === "g" && r.item.amount > 0 ? {
            kcal: +(r.item.kcal / r.item.amount * 100).toFixed(1), protein: +(r.item.protein_g / r.item.amount * 100).toFixed(1),
            fat: +(r.item.fat_g / r.item.amount * 100).toFixed(1), carbs: +(r.item.carbs_g / r.item.amount * 100).toFixed(1),
          } : null,
        }))));
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/nutrition-day`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Något gick fel");
      setTranscript(body.transcript || "");
      const meals: { meal: string; day_offset: number; items: DayFoodItem[] }[] = body.meals || [];
      if (!meals.length) toast.info("Hittade inga livsmedel i beskrivningen");
      setRows(meals.flatMap((m) => m.items.map((it) => ({
        meal: m.meal, offset: m.day_offset || 0, item: it, aiAmount: it.amount, on: true, amountText: String(it.amount),
      }))));
      setText("");
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
  const setAmount = (i: number, n: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, amountText: String(n), item: { ...rescale(row.item, n), certain: true, question: "", options: [] } } : row)));
  const chosen = rows.filter((r) => r.on);
  const groups = Array.from(new Set(rows.map((r) => `${r.offset}|${r.meal}`)));
  const totalKcal = chosen.filter((r) => r.offset === 0).reduce((s, r) => s + r.item.kcal, 0);
  const openQuestions = chosen.filter((r) => !r.item.certain && r.item.options.length).length;

  async function confirm() {
    setSaving(true);
    try { await onConfirm(chosen.map(({ meal, offset, item, aiAmount }) => ({ meal, offset, item, aiAmount }))); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto p-4">
        <DialogHeader><DialogTitle className="font-serif flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Beskriv dagens kost</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          {editing
            ? 'Vill du ändra något? Säg t.ex. "ta bort smöret", "dubbla laxen" eller "flytta bananen till mellanmål".'
            : 'Säg eller skriv t.ex. "Till frukost gröt med blåbär, till lunch samma som igår och klockan tre en Big Mac-meny på McDonald\'s."'}
        </p>

        <div className="flex flex-col items-center gap-2 py-1">
          {state === "rec" ? (
            <button onClick={stop} aria-label="Stoppa inspelning" className="w-14 h-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center animate-pulse">
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={start} disabled={state === "busy" || saving} aria-label="Starta inspelning" className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
              {state === "busy" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <p className="text-[11px] text-muted-foreground">{state === "rec" ? "Spelar in… tryck för att stoppa" : state === "busy" ? "AI tolkar…" : editing ? "Tryck för att ändra med rösten" : "Tryck för att prata"}</p>
        </div>

        {state !== "rec" && (
          <div className="flex gap-2 items-end">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={editing ? "…eller skriv en ändring" : "…eller skriv här"} rows={editing ? 1 : 3} maxLength={3000} className="rounded-xl text-sm flex-1" />
            <button onClick={interpretText} disabled={!text.trim() || state === "busy"} className="pill-btn bg-primary/10 text-primary px-3 py-2 text-xs disabled:opacity-50 shrink-0">
              {editing ? "Ändra" : "Tolka"}
            </button>
          </div>
        )}

        {transcript && <p className="text-xs italic text-muted-foreground text-center">"{transcript}"</p>}

        {rows.length > 0 && (
          <>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><BadgeCheck className="w-3 h-3 text-primary" /> = värden från Livsmedelsverket eller dina egna. Övriga är uppskattade.</p>
            {groups.map((g) => {
              const [off, meal] = [Number(g.split("|")[0]), g.slice(g.indexOf("|") + 1)];
              return (
                <div key={g} className="space-y-1">
                  <p className="text-xs font-semibold capitalize">{meal}{dayLabel(off)}</p>
                  <ul className="rounded-2xl bg-muted/30 divide-y divide-border/40">
                    {rows.map((r, i) => (r.meal !== meal || r.offset !== off) ? null : (
                      <li key={i} className={`p-2 space-y-1 ${r.on ? "" : "opacity-50"}`}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => update(i, { on: !r.on })} aria-label={r.on ? "Avmarkera" : "Markera"}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${r.on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                            {r.on && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <Input value={r.item.name} onChange={(e) => update(i, { item: { ...r.item, name: e.target.value } })} className="h-7 text-sm rounded-lg bg-transparent border-transparent px-1" />
                              {r.item.source !== "ai" && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" aria-label={SOURCE_LABEL[r.item.source]} />}
                            </div>
                            <div className="flex items-center gap-1 px-1 flex-wrap">
                              <select value={r.meal} onChange={(e) => update(i, { meal: e.target.value })} aria-label="Måltid"
                                className="text-[10px] bg-transparent text-muted-foreground capitalize">
                                {slots.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <span className="text-[10px] text-muted-foreground tabular-nums">· {Math.round(r.item.kcal)} kcal · P{r.item.protein_g.toFixed(1)} F{r.item.fat_g.toFixed(1)} K{r.item.carbs_g.toFixed(1)}</span>
                            </div>
                            {r.item.matched_name && r.item.matched_name !== r.item.name && (
                              <p className="text-[10px] text-muted-foreground px-1 truncate">{SOURCE_LABEL[r.item.source]}: {r.item.matched_name}</p>
                            )}
                          </div>
                          <Input value={r.amountText} inputMode="decimal" aria-label={r.item.unit === "g" ? "Gram" : "Portioner"}
                            onChange={(e) => {
                              const n = parseFloat(e.target.value.replace(",", "."));
                              update(i, { amountText: e.target.value, ...(n > 0 && n <= 5000 ? { item: rescale(r.item, n) } : {}) });
                            }}
                            className="h-7 w-14 text-xs rounded-lg bg-muted/50 border-transparent" />
                          <span className="text-[11px] text-muted-foreground w-7">{r.item.unit === "g" ? "g" : "port"}</span>
                        </div>
                        {!r.item.certain && r.item.options.length > 0 && (
                          <div className="pl-7 space-y-1">
                            <p className="text-[11px] flex items-center gap-1"><HelpCircle className="w-3 h-3 text-primary" /> {r.item.question || "Hur mycket?"}</p>
                            <div className="flex gap-1 flex-wrap">
                              {r.item.options.map((o) => (
                                <button key={o.label} onClick={() => setAmount(i, Math.round(o.grams))}
                                  className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] hover:bg-primary/20">
                                  {o.label} · {Math.round(o.grams)} g
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {openQuestions > 0 && <p className="text-[11px] text-muted-foreground">{openQuestions} {openQuestions === 1 ? "fråga" : "frågor"} om mängd – välj ett alternativ eller behåll förslaget.</p>}
            <button disabled={!chosen.length || saving || state !== "idle"} onClick={confirm} className="w-full pill-btn-primary py-2.5 text-sm disabled:opacity-50">
              {saving ? "Sparar…" : `Logga ${chosen.length} livsmedel · ${Math.round(totalKcal)} kcal idag`}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
