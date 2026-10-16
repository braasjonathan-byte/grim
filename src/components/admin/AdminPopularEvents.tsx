import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type EventRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  city: string | null;
  country: string;
  event_type: string;
};

const TYPES = [
  ["halvmaraton", "Halvmaraton"],
  ["maraton", "Maraton"],
  ["5k", "5 km"],
  ["10k", "10 km"],
  ["styrkelyft", "Styrkelyft"],
  ["crossfit", "CrossFit"],
  ["hinderbana", "Hinderbana"],
  ["simning", "Simning"],
  ["cykling", "Cykling"],
  ["triathlon", "Triathlon"],
  ["annat", "Annat"],
] as const;

const empty = { name: "", start_date: "", end_date: "", city: "", event_type: "halvmaraton" };

export default function AdminPopularEvents() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ ...empty, event_type: "halvmaraton" });
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("popular_events").select("id,name,start_date,end_date,city,country,event_type").order("start_date", { ascending: false }).limit(100);
    if (error) return toast.error(error.message);
    setRows((data || []) as EventRow[]);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);

  const save = async () => {
    const name = form.name.trim();
    if (!name || !form.start_date) return toast.error("Namn och startdatum behövs");
    const payload = {
      name,
      start_date: form.start_date,
      end_date: form.end_date || null,
      city: form.city.trim() || null,
      country: "Sverige",
      event_type: form.event_type,
    };
    const { error } = editId
      ? await supabase.from("popular_events").update(payload).eq("id", editId)
      : await supabase.from("popular_events").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editId ? "Loppet är uppdaterat" : "Loppet syns i sökningen");
    setForm({ ...empty });
    setEditId(null);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("popular_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((list) => list.filter((r) => r.id !== id));
    toast.success("Borttaget ur sökningen");
  };

  const sel = "w-full rounded-xl border border-input bg-background px-2 py-2 text-sm";
  return (
    <div className="space-y-3 text-sm">
      <p className="text-[11px] text-muted-foreground">Syns när någon söker lopp i nedräkningen. Gäller webbappen direkt.</p>
      <Input value={form.name} maxLength={120} placeholder="Namn, t.ex. Göteborgsvarvet" onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground">Start
          <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </label>
        <label className="text-[11px] text-muted-foreground">Slut, valfritt
          <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground">Ort
          <Input value={form.city} maxLength={60} placeholder="Göteborg" onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
        <label className="text-[11px] text-muted-foreground">Typ
          <select className={sel} value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
            {TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save}>{editId ? "Spara ändring" : "Lägg till"}</Button>
        {editId && <Button size="sm" variant="outline" onClick={() => { setEditId(null); setForm({ ...empty, event_type: "halvmaraton" }); }}>Avbryt</Button>}
      </div>
      <Input value={q} placeholder="Sök bland sparade lopp" onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-border">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center gap-2 py-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setEditId(r.id); setForm({ name: r.name, start_date: r.start_date, end_date: r.end_date || "", city: r.city || "", event_type: r.event_type }); }}>
              <span className="block font-medium">{r.name}</span>
              <span className="block text-[11px] text-muted-foreground">{[r.start_date, r.city, TYPES.find((t) => t[0] === r.event_type)?.[1] || r.event_type].filter(Boolean).join(" · ")}</span>
            </button>
            <button type="button" aria-label={`Ta bort ${r.name}`} onClick={() => remove(r.id)} className="text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-[11px] text-muted-foreground">Inga lopp att visa.</p>}
    </div>
  );
}
