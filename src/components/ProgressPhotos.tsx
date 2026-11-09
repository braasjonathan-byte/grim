import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Eye, EyeOff, Images, Trash2, Columns2, X, Plus, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pickImage, pickImages } from "@/lib/pickImage";
import { WEIGHT_CHANGED_EVENT } from "@/lib/bodyWeight";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listProgressPhotos, uploadProgressPhoto, deleteProgressPhoto, POSE_LABEL, type Pose, type ProgressPhoto,
  listSharedWithMe, listFriends, getShares, setShares, type Friend,
} from "@/lib/progressPhotos";

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmt = (k: string) => new Date(k + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

export default function ProgressPhotos({ userId }: { userId: string }) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [weights, setWeights] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  type DraftItem = { dataUrl: string; pose: Pose | "" };
  const [draft, setDraft] = useState<{ items: DraftItem[]; taken_on: string; note: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [shared, setShared] = useState<ProgressPhoto[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sharing, setSharing] = useState<{ photoIds: string[]; recipients: string[] } | null>(null);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const load = useCallback(async () => {
    try {
      const mine = await listProgressPhotos(userId); setPhotos(mine); setFailed(false);
      getShares(mine.map((p) => p.id)).then((sh) => setSharedIds(new Set(sh.map((x) => x.photo_id)))).catch(() => {});
      listSharedWithMe(userId).then(setShared).catch(() => setShared([]));
    }
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
    const imgs = source === "camera"
      ? [await pickImage({ source, quality: 75 })].filter(Boolean) as { dataUrl: string }[]
      : await pickImages({ quality: 75, limit: 10 });
    if (!imgs.length) return;
    const items = imgs.map((i) => ({ dataUrl: i.dataUrl, pose: "" as const }));
    setDraft((d) => d ? { ...d, items: [...d.items, ...items].slice(0, 10) } : { items, taken_on: todayKey(), note: "" });
  };

  const openShare = async (ids: string[]) => {
    try {
      const [fr, sh] = await Promise.all([friends.length ? Promise.resolve(friends) : listFriends(userId), getShares(ids)]);
      setFriends(fr);
      // Förvalt = vänner som redan ser ALLA valda bilder
      const rec = fr.filter((f) => ids.every((id) => sh.some((x) => x.photo_id === id && x.recipient_id === f.id))).map((f) => f.id);
      setSharing({ photoIds: ids, recipients: rec });
    } catch (e: any) { toast.error("Kunde inte hämta delning", { description: e?.message }); }
  };
  const saveShare = async () => {
    if (!sharing) return;
    try {
      await setShares(userId, sharing.photoIds, sharing.recipients);
      toast.success(sharing.recipients.length ? `Delat med ${sharing.recipients.length} vän${sharing.recipients.length > 1 ? "ner" : ""}` : "Bilderna är nu helt privata");
      setSharing(null); await load();
    } catch (e: any) { toast.error("Kunde inte spara delning", { description: e?.message }); }
  };
  const sessionOf = (p: ProgressPhoto) => p.session_id ? photos.filter((x) => x.session_id === p.session_id) : [p];

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const session_id = draft.items.length > 1 ? crypto.randomUUID() : null;
      let n = 0;
      for (const it of draft.items) {
        await uploadProgressPhoto(userId, it.dataUrl, { taken_on: draft.taken_on || todayKey(), note: draft.note, pose: it.pose || null, session_id });
        setProgress(++n);
      }
      setDraft(null); toast.success(n > 1 ? `${n} progressbilder sparade` : "Progressbild sparad"); await load();
    } catch (e: any) { toast.error("Kunde inte spara bilden", { description: e?.message }); }
    finally { setSaving(false); setProgress(0); await load(); }
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
    return [`Tagen ${fmt(p.taken_on)}`, w != null ? `${w.toFixed(1)} kg` : null, p.pose ? POSE_LABEL[p.pose] : null].filter(Boolean).join(" · ");
  };

  return (
    <div className="rounded-2xl p-3 bg-card shadow-soft space-y-2">
      <div className="flex items-center gap-2">
        <Images className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold flex-1">Progressbilder</p>
        {(photos.length > 0 || shared.length > 0) && (
          <button onClick={() => { setRevealed((r) => !r); setCompareMode(false); setSelected([]); }}
            className="text-xs px-2 py-1 rounded-lg flex items-center gap-1 bg-muted text-foreground">
            {revealed ? <><EyeOff className="w-3.5 h-3.5" /> Dölj</> : <><Eye className="w-3.5 h-3.5" /> Visa</>}
          </button>
        )}
        {revealed && photos.length >= 2 && (
          <button onClick={() => { setCompareMode((c) => !c); setSelected([]); }}
            className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${compareMode ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <Columns2 className="w-3.5 h-3.5" /> Jämför
          </button>
        )}
        {revealed && photos.length > 0 && (
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
        ) : !revealed ? (
          <button onClick={() => setRevealed(true)} className="w-full py-4 rounded-lg bg-muted text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> {photos.length} {photos.length === 1 ? "bild" : "bilder"} dolda – tryck för att visa
          </button>
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
                    {sharedIds.has(p.id) && <span className="absolute top-1 left-1 bg-black/55 text-white rounded-full p-0.5" title="Delad med vän"><Users className="w-3 h-3" /></span>}
                    {sel >= 0 && <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{sel + 1}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Privata som standard – bara du ser dem om du inte delar med en vän.</p>
          </>
        )}

      {revealed && shared.length > 0 && (
        <div className="pt-2 space-y-1.5">
          <p className="text-xs font-semibold flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Delat med dig</p>
          <div className="grid grid-cols-3 gap-1.5">
            {shared.map((p) => (
              <button key={p.id} onClick={() => setViewing(p)} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted">
                {p.url && <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />}
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-1 py-0.5 text-left leading-tight">{p.shared_by} · {fmt(p.taken_on)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ny bild */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && !saving && setDraft(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{draft && draft.items.length > 1 ? `${draft.items.length} nya progressbilder` : "Ny progressbild"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <label className="text-xs block font-medium">Datum bilderna togs
                <Input type="date" value={draft.taken_on} max={todayKey()} onChange={(e) => setDraft({ ...draft, taken_on: e.target.value })} />
              </label>
              <div className="space-y-2 max-h-[45vh] overflow-y-auto">
                {draft.items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <img src={it.dataUrl} alt="" className="w-16 h-20 object-cover rounded-lg bg-muted shrink-0" />
                    <div className="flex-1 flex gap-1">
                      {(["", "front", "side", "back"] as const).map((k) => (
                        <button key={k} onClick={() => setDraft({ ...draft, items: draft.items.map((x, j) => j === idx ? { ...x, pose: k } : x) })}
                          className={`flex-1 text-[11px] py-1.5 rounded-lg ${it.pose === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {k ? POSE_LABEL[k] : "Ingen"}
                        </button>
                      ))}
                    </div>
                    <button aria-label="Ta bort ur urvalet" onClick={() => { const items = draft.items.filter((_, j) => j !== idx); setDraft(items.length ? { ...draft, items } : null); }} className="p-1 rounded bg-muted"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              {draft.items.length < 10 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1" disabled={saving} onClick={() => add("camera")}><Camera className="w-4 h-4 mr-1" />Ta en till</Button>
                  <Button size="sm" variant="secondary" className="flex-1" disabled={saving} onClick={() => add("gallery")}><Plus className="w-4 h-4 mr-1" />Fler från galleri</Button>
                </div>
              )}
              <Input placeholder="Anteckning (valfri)" maxLength={120} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Sparas privat. Du kan välja att dela med en vän efteråt.</p>
              <Button className="w-full" disabled={saving} onClick={save}>{saving ? `Sparar ${progress}/${draft.items.length}…` : draft.items.length > 1 ? `Spara ${draft.items.length} bilder` : "Spara"}</Button>
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
              {viewing.shared_by ? (
                <p className="text-xs text-muted-foreground">Delad med dig av {viewing.shared_by}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openShare([viewing.id])}><Users className="w-4 h-4 mr-1" />{sharedIds.has(viewing.id) ? "Delning" : "Dela med vän"}</Button>
                  {sessionOf(viewing).length > 1 && (
                    <Button variant="secondary" size="sm" onClick={() => openShare(sessionOf(viewing).map((p) => p.id))}>Dela hela tillfället ({sessionOf(viewing).length})</Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => remove(viewing)}><Trash2 className="w-4 h-4 mr-1" />Ta bort</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dela med vän (frivilligt) */}
      <Dialog open={!!sharing} onOpenChange={(o) => !o && setSharing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dela {sharing && sharing.photoIds.length > 1 ? `${sharing.photoIds.length} bilder` : "bild"} med vän</DialogTitle></DialogHeader>
          {sharing && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Bara de vänner du bockar i kan se bilden. Ingen annan, och den visas aldrig i flödet. Du kan ändra dig när du vill.</p>
              {friends.length === 0 ? <p className="text-sm">Du har inga vänner i Socialt än.</p> : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {friends.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm py-1">
                      <input type="checkbox" checked={sharing.recipients.includes(f.id)}
                        onChange={(e) => setSharing({ ...sharing, recipients: e.target.checked ? [...sharing.recipients, f.id] : sharing.recipients.filter((x) => x !== f.id) })} />
                      {f.name}
                    </label>
                  ))}
                </div>
              )}
              <Button className="w-full" onClick={saveShare}>{sharing.recipients.length ? "Spara delning" : "Håll privat"}</Button>
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
