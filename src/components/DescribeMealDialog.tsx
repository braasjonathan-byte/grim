import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2, Check, X, Sparkles, BookOpen, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { PickedItem } from "./FoodPickerDialog";
import { rescalePicked } from "@/lib/aiFood";
import { searchMenu } from "@/lib/restaurantSearch";
import { searchFoods } from "@/lib/foodSearch";
import { gramsForFood } from "@/lib/nutritionCalc";
import { pickImage } from "@/lib/pickImage";
import { nutritionSource } from "@/lib/nutritionExperience";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (items: PickedItem[]) => void;
  initialText?: string;
  meal?: string;
  /** Open straight into the menu-photo flow */
  startWithMenu?: boolean;
  /** Appens livsmedelsbank (foods + egna + recept) – näringsvärden slås upp här, inte av AI:n */
  foods: { id: string; name: string; source: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number | null; group_name?: string | null }[];
  /** Ingen träff: sök manuellt i väljaren */
  onSearch: (q: string) => void;
}

type AiItem = { name: string; grams: number; kind: "eaten" | "menu"; selected: boolean; price: string | null };

/** Slå upp näringsvärden: restaurangmenyn först (om restaurang är känd / exakt rätt), annars livsmedelsbanken. */
function match(it: AiItem, restaurant: string | null, foods: Props["foods"], idx: number): PickedItem | null {
  const q = restaurant ? `${it.name} ${restaurant}` : it.name;
  const hit = searchMenu(q, undefined, 1)[0];
  if (hit && (hit.score < 0.35 && (restaurant || hit.score <= 0))) {
    const m = hit.item;
    const f = (it.kind === "menu" ? m.g : (it.grams || m.g)) / m.g;
    return { source: "custom_food", id: `rest-${idx}-${Date.now()}`, name: `${m.n} (${m.r})`, amount: Math.round(m.g * f), unit: "g",
      kcal: m.kcal * f, protein_g: m.p * f, fat_g: m.f * f, carbs_g: m.c * f, fiber_g: 0, nutrition_source: "Restaurang · ungefärliga menyvärden" };
  }
  const food = searchFoods(foods.filter((x) => x.source !== "recipe"), it.name)[0];
  if (!food) return null;
  const g = gramsForFood(it.grams || 100, "g", food.name);
  const f = g / 100;
  return { source: food.source as PickedItem["source"], id: food.id, name: food.name, amount: Math.round(g), unit: "g",
    kcal: food.kcal * f, protein_g: food.protein_g * f, fat_g: food.fat_g * f, carbs_g: food.carbs_g * f, fiber_g: (food.fiber_g || 0) * f, nutrition_source: nutritionSource(food) };
}

type Photo = { url: string; kind: "meal" | "menu" };
type Row = { query: string; item: PickedItem | null; on: boolean; amountText: string; kind: "eaten" | "menu"; price?: string | null };

async function shrink(dataUrl: string, max = 1280): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function DescribeMealDialog({ open, onOpenChange, onConfirm, initialText, meal, startWithMenu, foods, onSearch }: Props) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [restaurant, setRestaurant] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setText(initialText || ""); if (startWithMenu) void addPhoto("menu"); }
    else { setText(""); setPhotos([]); setRows([]);setRestaurant(null); setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function addPhoto(kind: Photo["kind"]) {
    const p = await pickImage({ source: "prompt", quality: 80 });
    if (!p) return;
    const url = await shrink(p.dataUrl);
    setPhotos((ps) => [...ps, { url, kind }].slice(0, 4));
  }

  async function analyze() {
    if (!text.trim() && !photos.length) { toast.info("Skriv vad du ätit eller lägg till ett foto"); return; }
    setBusy(true);
    try {
      const hint = photos.map((p, i) => `Bild ${i + 1}: ${p.kind === "menu" ? "restaurangmeny" : "foto på maten"}`).join(". ");
      const { data, error } = await supabase.functions.invoke("nutrition-describe", {
        body: { text: [text.trim(), hint].filter(Boolean).join("\n"), images: photos.map((p) => p.url), meal },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if (data?.error) throw new Error(data.error);
      const items: AiItem[] = data.items || [];
      if (!items.length) toast.info("Hittade inga livsmedel – beskriv lite mer");
      setRestaurant(data.restaurant || null);
      const sorted = [...items].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "eaten" ? -1 : 1));
      setRows(sorted.map((it, i) => {
        const p = match(it, data.restaurant || null, foods, i);
        return { query: it.name, item: p, on: !!it.selected && !!p, amountText: p ? String(p.amount) : "", kind: it.kind, price: it.price };
      }));
    } catch (e: any) {
      toast.error(e?.message || "Kunde inte tolka måltiden");
    } finally { setBusy(false); }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const chosen = rows.filter((r) => r.on && r.item);
  const totalKcal = chosen.reduce((s, r) => s + (r.item?.kcal || 0), 0);
  const eaten = rows.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "eaten");
  const menu = rows.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "menu");

  const renderRow = ({ r, i }: { r: Row; i: number }) => {
    const it = r.item;
    if (!it) return (
      <li key={i} className="p-2 flex items-center gap-2 opacity-80">
        <span className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0"><p className="text-sm truncate px-1">{r.query}{r.price ? ` · ${r.price}` : ""}</p><p className="text-[10px] text-muted-foreground px-1">Ingen träff i livsmedelsbanken</p></div>
        <button onClick={() => onSearch(r.query)} className="pill-btn-soft text-xs px-3 py-1">Sök</button>
      </li>
    );
    return (
    <li key={i} className={`p-2 flex items-center gap-2 ${r.on ? "" : "opacity-60"}`}>
      <button onClick={() => update(i, { on: !r.on })} aria-label={r.on ? "Avmarkera" : "Markera"}
        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${r.on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
        {r.on && <Check className="w-3.5 h-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate px-1">{it.name}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums px-1 truncate">{r.query.toLowerCase() !== it.name.toLowerCase() ? `"${r.query}" · ` : ""}{Math.round(it.kcal)} kcal · P{it.protein_g.toFixed(1)} F{it.fat_g.toFixed(1)} K{it.carbs_g.toFixed(1)}{r.price ? ` · ${r.price}` : ""}</p>
      </div>
      <Input value={r.amountText} inputMode="decimal" aria-label="Gram"
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(",", "."));
          update(i, { amountText: e.target.value, ...(n > 0 ? { item: rescalePicked(it, n) } : {}) });
        }}
        className="h-7 w-16 text-xs rounded-lg bg-muted/50 border-transparent" />
      <span className="text-[11px] text-muted-foreground">g</span>
    </li>
  ); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[88dvh] overflow-y-auto p-4">
        <DialogHeader><DialogTitle className="font-serif flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Beskriv måltiden</DialogTitle></DialogHeader>

        {!rows.length && (
          <div className="space-y-3">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus={!startWithMenu}
              placeholder={'T.ex. "Big Mac, medium pommes och en Cola Zero" eller "2 ägg, en macka med ost"'} className="rounded-xl bg-muted/50 border-transparent text-sm" />
            {photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted">
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 text-[9px] font-bold text-center bg-background/80">{p.kind === "menu" ? "Meny" : "Mat"}</span>
                    <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label="Ta bort bild" className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/90 flex items-center justify-center"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addPhoto("meal")} disabled={photos.length >= 4} className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-secondary text-xs font-semibold disabled:opacity-50"><Camera className="w-4 h-4" /> Foto på maten</button>
              <button onClick={() => addPhoto("menu")} disabled={photos.length >= 4} className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-secondary text-xs font-semibold disabled:opacity-50"><BookOpen className="w-4 h-4" /> Foto på menyn</button>
            </div>
            <p className="text-[11px] text-muted-foreground">Fota menyn och skriv vad du beställde (t.ex. "nr 3 och en stor öl") – eller bara fota så väljer du rätterna själv.</p>
            <button onClick={analyze} disabled={busy || (!text.trim() && !photos.length)} className="w-full pill-btn-primary py-2.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Tolkar…</> : <><Sparkles className="w-4 h-4" /> Tolka måltiden</>}
            </button>
          </div>
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            {eaten.length > 0 && (<>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Det du åt</p>
              <ul className="rounded-2xl bg-muted/30 divide-y divide-border/40">{eaten.map(renderRow)}</ul>
            </>)}
            {menu.length > 0 && (<>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Från menyn{restaurant ? ` · ${restaurant}` : ""} – bocka i det du åt</p>
              <ul className="rounded-2xl bg-muted/30 divide-y divide-border/40">{menu.map(renderRow)}</ul>
            </>)}
            <p className="text-[10px] text-muted-foreground">AI:n tolkar bara vad du åt – näringsvärden kommer från livsmedelsbanken och restaurangmenyerna. Justera gram innan du loggar.</p>
            <div className="flex gap-2">
              <button onClick={() => setRows([])} className="flex-1 py-2.5 rounded-full border border-input text-sm">Ändra</button>
              <button disabled={!chosen.length} onClick={() => onConfirm(chosen.map((r) => r.item!))} className="flex-[2] pill-btn-primary py-2.5 text-sm disabled:opacity-50">
                Logga {chosen.length} ({Math.round(totalKcal)} kcal)
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
