import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const SUGGESTIONS = ["frukost", "mellanmål", "lunch", "middag", "kvällsmål", "pre-workout", "post-workout", "fika", "shake"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: string;
  title?: string;
  existing?: string[];
  onSave: (name: string) => void;
}

export default function MealNameDialog({ open, onOpenChange, initial, title, existing = [], onSave }: Props) {
  const [name, setName] = useState(initial || "");
  const [err, setErr] = useState("");

  useEffect(() => { if (open) { setName(initial || ""); setErr(""); } }, [open, initial]);

  function save() {
    const v = name.trim().toLowerCase();
    if (!v) { setErr("Skriv ett namn"); return; }
    if (v !== (initial || "").toLowerCase() && existing.includes(v)) { setErr("Det finns redan en måltid med det namnet"); return; }
    onSave(v);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-4">
        <DialogHeader>
          <DialogTitle className="font-serif">{title || "Namn på måltid"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="t.ex. kvällsmål"
            className="rounded-none"
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Förslag</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.filter((s) => !existing.includes(s)).map((s) => (
                <button key={s} onClick={() => setName(s)} className="px-2 py-1 border border-input text-xs capitalize">{s}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => onOpenChange(false)} className="flex-1 py-2.5 border border-input text-sm font-medium">Avbryt</button>
            <button onClick={save} className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold">Spara</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
