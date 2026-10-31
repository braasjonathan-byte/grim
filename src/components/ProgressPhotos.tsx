import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Images, Trash2, Columns2, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pickImage } from "@/lib/pickImage";
import { WEIGHT_CHANGED_EVENT } from "@/lib/bodyWeight";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listProgressPhotos, uploadProgressPhoto, deleteProgressPhoto, POSE_LABEL, type Pose, type ProgressPhoto,
} from "@/lib/progressPhotos";

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmt = (k: string) => new Date(k + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

export default function ProgressPhotos({ userId }: { userId: string }) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [weights, setWeights] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<{ dataUrl: string; taken_on: string; note: string; pose: Pose | "" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const load = useCallback(async () => {
    try { setPhotos(await listProgressPhotos(userId)); setFailed(false); }
    catch (e) { console.warn("progress photos", e); setFailed(true); }
    finally { setLoading(false); }
  }, [userId]);

  const loadWeights = useCallback(() => {
    supabase.from("body_weight_logs").select("log_date,weight_kg").eq("user_id", userId)
      .then(({ data }) => setWeights(new Map((data || []).map((w) => [w.log_date, Number(w.weight_kg)]))));
  }, [userId]);

  useEffect(() => {
    load(); loadWeights();
    window.addEventListener(WEIGHT_CHANGED_EVENT, loadWeights);
    // Signerade länkar gäller 1 h – förnya var 50:e minut.
    const t = window.setInterval(load, 50 * 60 * 1000);
    return () => { window.removeEventListener(WEIGHT_CHANGED_EVENT, loadWeights); window.clearInterval(t); };
  }, [load, loadWeights]);

  const add = async (source: "camera" | "gallery") => {
    const img = await pickImage({ source, quality: 75 });
    if (img) setDraft({ dataUrl: img.dataUrl, taken_on: todayKey(), note: "", pose: "" });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await uploadProgressPhoto(userId, draft.dataUrl, { taken_on: draft.taken_on || todayKey(), note: draft.note, pose: draft.pose || null });
      setDraft(null); toast.success("Progressbild sparad"); await load();
    } catch (e: any) { toast.error("Kunde inte spara bilden", { description: e?.message }); }
    finally { setSaving(false); }
  };

  const remove = async (p: ProgressPhoto) => {
    if (!confirm("Ta bort bilden?")) return;
    try { await deleteProgressPhoto(p); setViewing(null); setSelected((s) => s.filter((x) => x !== p.id)); await load(); }
    catch (e: any) { toast.error("Kunde inte ta bort", { description: e?.message }); }
  };

  const tap = (p: ProgressPhoto) => {
    if (!compareMode) return setViewing(p);
    setSelected((s) => s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id].slice(-2));
  };

  const pair = useMemo(() => {
    const ps = photos.filter((p) => selected.includes(p.id));
    return ps.sort((a, b) => a.taken_on.localeCompare(b.taken_on) || a.created_at.localeCompare(b.created_at));
  }, [photos, selected]);

  const caption = (p: ProgressPhoto) => {
    const w = weights.get(p.taken_on);
    return [fmt(p.taken_on), w != null ? `${w.toFixed(1)} kg` : null, p.pose ? POSE_LABEL[p.pose] : null].filter(Boolean).join(" · ");
  };

  return (
    <div className="rounded-2xl p-3 bg-card shadow-soft space-y-2">
      <div className="flex items-center gap-2">
        <Images className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold flex-1">Progressbilder</p>
        {photos.length >= 2 && (
          <button onClick={() => { setCompareMode((c) => !c); setSelected([]); }}
            className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${compareMode ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <Columns2 className="w-3.5 h-3.5" /> Jämför
          </button>
        )}
        {photos.length > 0 && (
          <>
            <button aria-label="Ta foto" onClick={() => add("camera")} className="p-1.5 rounded-lg bg-muted"><Camera className="w-4 h-4" /></button>
            <button aria-label="Från galleri" onClick={() => add("gallery")} className="p-1.5 rounded-lg bg-muted"><Plus className="w-4 h-4" /></button>
          </>
        )}
      </div>

      {loading ? <p className="text-xs text-muted-foreground">Laddar…</p>
        : failed ? <p className="text-xs text-muted-foreground">Progressbilder är inte tillgängliga just nu.</p>
        : photos.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">Följ din förändring med bilder – bara du kan se dem.</p>
            <p className="text-sm font-medium">Lägg till första bilden</p>
            <div className="flex justify-center gap-2">
              <Button size="sm" onClick={() => add("camera")}><Camera className="w-4 h-4 mr-1" />Ta foto</Button>
              <Button size="sm" variant="secondary" onClick={() => add("gallery")}><Images className="w-4 h-4 mr-1" />Galleri</Button>
            </div>
          </div>
        ) : (
          <>
            {compareMode && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground flex-1">Välj två bilder ({selected.length}/2)</p>
                <Button size="sm" disabled={selected.length !== 2} onClick={() => setComparing(true)}>Visa före | efter</Button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => {
                const sel = selected.indexOf(p.id);
                return (
                  <button key={p.id} onClick={() => tap(p)} className={`relative aspect-[3/4] rounded-lg overflow-hidden bg-muted ${sel >= 0 ? "ring-2 ring-primary" : ""}`}>
                    {p.url && <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-1 py-0.5 text-left leading-tight">
                      {fmt(p.taken_on)}{weights.has(p.taken_on) ? ` · ${weights.get(p.taken_on)!.toFixed(1)} kg` : ""}
                    </span>
                    {sel >= 0 && <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{sel + 1}</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

      {/* Ny bild */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && !saving && setDraft(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ny progressbild</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <img src={draft.dataUrl} alt="" className="w-full max-h-72 object-contain rounded-lg bg-muted" />
              <label className="text-xs block">Datum
                <Input type="date" value={draft.taken_on} max={todayKey()} onChange={(e) => setDraft({ ...draft, taken_on: e.target.value })} />
              </label>
              <div className="flex gap-1.5">
                {(["", "front", "side", "back"] as const).map((k) => (
                  <button key={k} onClick={() => setDraft({ ...draft, pose: k })}
                    className={`flex-1 text-xs py-1.5 rounded-lg ${draft.pose === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {k ? POSE_LABEL[k] : "Ingen"}
                  </button>
                ))}
              </div>
              <Input placeholder="Anteckning (valfri)" maxLength={120} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              <Button className="w-full" disabled={saving} onClick={save}>{saving ? "Sparar…" : "Spara"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Visa en bild */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{viewing && caption(viewing)}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-2">
              {viewing.url && <img src={viewing.url} alt="" className="w-full max-h-[65vh] object-contain rounded-lg bg-muted" />}
              {viewing.note && <p className="text-sm">{viewing.note}</p>}
              <Button variant="destructive" size="sm" onClick={() => remove(viewing)}><Trash2 className="w-4 h-4 mr-1" />Ta bort</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Jämför */}
      <Dialog open={comparing} onOpenChange={setComparing}>
        <DialogContent className="max-w-2xl p-3">
          <DialogHeader><DialogTitle>Före | Efter</DialogTitle></DialogHeader>
          {pair.length === 2 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {pair.map((p, i) => (
                  <div key={p.id} className="space-y-1">
                    <p className="text-xs font-semibold">{i === 0 ? "Före" : "Efter"}</p>
                    {p.url && <img src={p.url} alt="" className="w-full aspect-[3/4] object-cover rounded-lg bg-muted" />}
                    <p className="text-[11px] text-muted-foreground">{caption(p)}</p>
                  </div>
                ))}
              </div>
              {(() => {
                const a = weights.get(pair[0].taken_on), b = weights.get(pair[1].taken_on);
                const days = Math.round((new Date(pair[1].taken_on).getTime() - new Date(pair[0].taken_on).getTime()) / 864e5);
                return <p className="text-xs text-center text-muted-foreground">{days} dagar{a != null && b != null ? ` · ${(b - a) > 0 ? "+" : ""}${(b - a).toFixed(1)} kg` : ""}</p>;
              })()}
            </>
          )}
          <button onClick={() => setComparing(false)} className="sr-only"><X /></button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
