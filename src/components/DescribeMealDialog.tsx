import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2, Check, X, Sparkles, BookOpen, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { PickedItem } from "./FoodPickerDialog";
import { aiItemToPicked, rescalePicked, type AiFoodItem } from "@/lib/aiFood";
import { pickImage } from "@/lib/pickImage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (items: PickedItem[]) => void;
  initialText?: string;
  meal?: string;
  /** Open straight into the menu-photo flow */
  startWithMenu?: boolean;
}

type Photo = { url: string; kind: "meal" | "menu" };
type Row = { item: PickedItem; on: boolean; amountText: string; kind: "eaten" | "menu"; price?: string | null };

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

export default function DescribeMealDialog({ open, onOpenChange, onConfirm, initialText, meal, startWithMenu }: Props) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState("");
  const [restaurant, setRestaurant] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setText(initialText || ""); if (startWithMenu) void addPhoto("menu"); }
    else { setText(""); setPhotos([]); setRows([]); setSummary(""); setRestaurant(null); setBusy(false); }
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
      const items: (AiFoodItem & { kind: "eaten" | "menu"; selected: boolean; price: string | null })[] = data.items || [];
      if (!items.length) toast.info("Hittade inga livsmedel – beskriv lite mer");
      setSummary(data.summary || "");
      setRestaurant(data.restaurant || null);
      // eaten first, then menu items
      const sorted = [...items].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "eaten" ? -1 : 1));
      setRows(sorted.map((it, i) => {
        const p = aiItemToPicked(it, i);
        if (it.kind === "menu" && data.restaurant && !p.name.toLowerCase().includes(String(data.restaurant).toLowerCase())) p.name = `${p.name} (${data.restaurant})`;
        return { item: p, on: !!it.selected, amountText: String(p.amount), kind: it.kind, price: it.price };
      }));
    } catch (e: any) {
      toast.error(e?.message || "Kunde inte tolka måltiden");
    } finally { setBusy(false); }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const chosen = rows.filter((r) => r.on);
  const totalKcal = chosen.reduce((s, r) => s + r.item.kcal, 0);
  const eaten = rows.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "eaten");
  const menu = rows.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "menu");

  const renderRow = ({ r, i }: { r: Row; i: number }) => (
    <li key={i} className={`p-2 flex items-center gap-2 ${r.on ? "" : "opacity-60"}`}>
      <button onClick={() => update(i, { on: !r.on })} aria-label={r.on ? "Avmarkera" : "Markera"}
        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${r.on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
        {r.on && <Check className="w-3.5 h-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <Input value={r.item.name} onChange={(e) => update(i, { item: { ...r.item, name: e.target.value } })} className="h-7 text-sm rounded-lg bg-transparent border-transparent px-1" />
        <p className="text-[10px] text-muted-foreground tabular-nums px-1">{Math.round(r.item.kcal)} kcal · P{r.item.protein_g.toFixed(1)} F{r.item.fat_g.toFixed(1)} K{r.item.carbs_g.toFixed(1)}{r.price ? ` · ${r.price}` : ""}</p>
      </div>
      <Input value={r.amountText} inputMode="decimal" aria-label="Gram"
        onChange={(e) => {
          const n = parseFloat(e.target.value.replace(",", "."));
          update(i, { amountText: e.target.value, ...(n > 0 ? { item: rescalePicked(r.item, n) } : {}) });
        }}
        className="h-7 w-16 text-xs rounded-lg bg-muted/50 border-transparent" />
      <span className="text-[11px] text-muted-foreground">g</span>
    </li>
  );

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
            {summary && <p className="text-xs italic text-muted-foreground">{summary}</p>}
            {eaten.length > 0 && (<>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Det du åt</p>
              <ul className="rounded-2xl bg-muted/30 divide-y divide-border/40">{eaten.map(renderRow)}</ul>
            </>)}
            {menu.length > 0 && (<>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Från menyn{restaurant ? ` · ${restaurant}` : ""} – bocka i det du åt</p>
              <ul className="rounded-2xl bg-muted/30 divide-y divide-border/40">{menu.map(renderRow)}</ul>
            </>)}
            <p className="text-[10px] text-muted-foreground">AI-uppskattade värden. Justera gram eller namn innan du loggar.</p>
            <div className="flex gap-2">
              <button onClick={() => setRows([])} className="flex-1 py-2.5 rounded-full border border-input text-sm">Ändra</button>
              <button disabled={!chosen.length} onClick={() => onConfirm(chosen.map((r) => r.item))} className="flex-[2] pill-btn-primary py-2.5 text-sm disabled:opacity-50">
                Logga {chosen.length} ({Math.round(totalKcal)} kcal)
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
