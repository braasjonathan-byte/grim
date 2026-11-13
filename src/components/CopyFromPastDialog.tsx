import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toLocalDateKey } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { showUndoToast } from "@/lib/undoToast";
import { exclusive } from "@/lib/clickGuard";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  /** Dagen som visas (YYYY-MM-DD) – dit raderna kopieras. */
  dateKey: string;
  onCopied: () => void;
}

const dayLabel = (key: string, targetKey: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const [ty, tm, td] = targetKey.split("-").map(Number);
  const diff = Math.round((new Date(ty, tm - 1, td).getTime() - date.getTime()) / 86400000);
  const wd = date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" });
  return diff === 1 ? `Igår · ${wd}` : wd.charAt(0).toUpperCase() + wd.slice(1);
};

/** Lista med senaste veckans dagar och deras loggade rätter; valda rader kopieras till visad dag. */
const CopyFromPastDialog = ({ open, onOpenChange, userId, dateKey, onCopied }: Props) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const [y, m, d] = dateKey.split("-").map(Number);
    const from = toLocalDateKey(new Date(y, m - 1, d - 7));
    setLoading(true);
    setSelected(new Set());
    supabase.from("meal_logs").select("*").eq("user_id", userId).gte("log_date", from).lt("log_date", dateKey)
      .order("log_date", { ascending: false }).order("created_at", { ascending: true })
      .then(({ data }) => { setRows(data || []); setLoading(false); });
  }, [open, userId, dateKey]);

  const grouped = useMemo(() => {
    const days = new Map<string, Map<string, any[]>>();
    for (const r of rows) {
      if (!days.has(r.log_date)) days.set(r.log_date, new Map());
      const meals = days.get(r.log_date)!;
      if (!meals.has(r.meal_type)) meals.set(r.meal_type, []);
      meals.get(r.meal_type)!.push(r);
    }
    return [...days.entries()];
  }, [rows]);

  const toggle = (ids: string[], on: boolean) => setSelected((prev) => {
    const n = new Set(prev);
    ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
    return n;
  });

  const copy = () => exclusive(`copy-past:${dateKey}`, async () => {
    const pick = rows.filter((r) => selected.has(r.id));
    if (!pick.length) return;
    const insert = pick.map(({ id, created_at, ...r }: any) => ({ ...r, log_date: dateKey }));
    const { data, error } = await supabase.from("meal_logs").insert(insert).select("id");
    if (error) { toast({ title: "Kunde inte kopiera", description: error.message, variant: "destructive" }); return; }
    onOpenChange(false);
    onCopied();
    const ids = (data || []).map((d) => d.id);
    showUndoToast(`Kopierade ${pick.length} livsmedel`, async () => {
      if (ids.length) await supabase.from("meal_logs").delete().in("id", ids);
      onCopied();
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Kopiera från senaste veckan</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
          {loading && <p className="text-sm text-muted-foreground">Laddar…</p>}
          {!loading && grouped.length === 0 && <p className="text-sm text-muted-foreground">Inget loggat de senaste sju dagarna.</p>}
          {grouped.map(([day, meals]) => (
            <div key={day} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dayLabel(day, dateKey)}</h3>
              {[...meals.entries()].map(([meal, items]) => {
                const ids = items.map((i) => i.id);
                const all = ids.every((id) => selected.has(id));
                const kcal = Math.round(items.reduce((a, i) => a + Number(i.kcal || 0), 0));
                return (
                  <div key={meal} className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5">
                    <label className="flex items-center gap-2 text-sm font-semibold capitalize cursor-pointer">
                      <Checkbox checked={all} onCheckedChange={(v) => toggle(ids, !!v)} />
                      <span className="flex-1">{meal}</span>
                      <span className="text-xs text-muted-foreground font-normal">{kcal} kcal</span>
                    </label>
                    {items.map((i) => (
                      <label key={i.id} className="flex items-center gap-2 pl-6 text-xs cursor-pointer">
                        <Checkbox checked={selected.has(i.id)} onCheckedChange={(v) => toggle([i.id], !!v)} />
                        <span className="flex-1 truncate">{i.item_name}</span>
                        <span className="text-muted-foreground">{Number(i.amount)} {i.unit} · {Math.round(Number(i.kcal))} kcal</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <Button onClick={copy} disabled={selected.size === 0}>
          Kopiera {selected.size > 0 ? `${selected.size} valda` : "valda"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default CopyFromPastDialog;
