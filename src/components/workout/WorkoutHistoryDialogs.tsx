import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import SetRowsEditor, { validateSetRows, type SetRow } from "./SetRowsEditor";
import { deleteSession, loadWorkoutHistory, saveSessionEdit, WORKOUTS_CHANGED_EVENT, type HistorySession } from "@/lib/workoutHistory";
import { showUndoToast } from "@/lib/undoToast";

export const formatSessionDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Okänt datum";
const formatVolume = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")} ton` : `${Math.round(v)} kg`);

export const useWorkoutHistory = (userId: string, enabled = true) => {
  const [sessions, setSessions] = useState<HistorySession[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => loadWorkoutHistory(userId).then((s) => alive && setSessions(s)).catch(() => alive && setSessions([]));
    load();
    window.addEventListener(WORKOUTS_CHANGED_EVENT, load);
    return () => { alive = false; window.removeEventListener(WORKOUTS_CHANGED_EVENT, load); };
  }, [userId, enabled]);
  return sessions;
};

export const SessionRow = ({ s, onOpen }: { s: HistorySession; onOpen: () => void }) => (
  <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 rounded-xl bg-secondary/50 hover:bg-secondary px-3 py-2.5 text-left">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate">{s.name}</p>
      <p className="text-[11px] text-muted-foreground">
        {formatSessionDate(s.date)}
        {s.setCount > 0 && ` · ${s.setCount} set`}
        {s.volume > 0 && ` · ${formatVolume(s.volume)}`}
        {s.distanceKm ? ` · ${String(s.distanceKm).replace(".", ",")} km` : ""}
        {s.tempo ? ` · ${s.tempo}` : ""}
      </p>
    </div>
    <ChevronRight className="w-4 h-4 text-muted-foreground" />
  </button>
);

/** Detail view with Redigera / Radera pass. Works for single, plan and archived workouts. */
export const WorkoutDetailDialog = ({ userId, session, onClose }: { userId: string; session: HistorySession | null; onClose: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Record<string, SetRow[]>>({});
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setEditing(false); setConfirmDelete(false); }, [session?.id]);
  if (!session) return null;
  const strength = session.exercises.filter((e) => e.sets.length > 0);
  const canChangeDate = session.source.kind === "active" && session.week === 0;

  const startEdit = () => {
    setRows(Object.fromEntries(strength.map((e) => [e.name, e.sets.map((x) => ({ ...x }))])));
    setDate(session.date || "");
    setEditing(true);
  };
  const save = async () => {
    for (const [name, r] of Object.entries(rows)) {
      const err = validateSetRows(r);
      if (err) { toast.error(`${name}: ${err}`); return; }
    }
    if (canChangeDate && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast.error("Välj ett giltigt datum."); return; }
    setSaving(true);
    try {
      await saveSessionEdit(userId, session, Object.entries(rows).map(([name, sets]) => ({ name, sets })), canChangeDate ? date : null);
      toast.success("Passet sparades");
      onClose();
    } catch { toast.error("Kunde inte spara passet"); }
    finally { setSaving(false); }
  };
  const doDelete = async () => {
    setConfirmDelete(false);
    try {
      const undo = await deleteSession(userId, session);
      onClose();
      showUndoToast("Passet raderades", undo);
    } catch { toast.error("Kunde inte radera passet"); }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto mobile-sheet-safe">
          <DialogHeader>
            <DialogTitle>{session.name}</DialogTitle>
            <p className="text-xs text-muted-foreground">{formatSessionDate(session.date)}{session.source.kind === "archive" ? " · arkiverad plan" : ""}</p>
          </DialogHeader>

          {!editing ? (
            <div className="space-y-3">
              {session.exercises.length === 0 && <p className="text-sm text-muted-foreground">Inga övningar loggade.</p>}
              {session.exercises.map((e) => (
                <div key={e.name} className="rounded-xl bg-secondary/50 p-3">
                  <p className="text-sm font-semibold">{e.name}</p>
                  {e.sets.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {e.sets.map((x, i) => (
                        <li key={i} className="text-xs font-mono text-muted-foreground">Set {i + 1}: {x.reps || "–"} reps{x.kg ? ` × ${x.kg.replace(".", ",")} kg` : ""}</li>
                      ))}
                    </ul>
                  ) : e.info ? <p className="text-xs text-muted-foreground">{e.info}</p> : null}
                </div>
              ))}
              {(session.distanceKm || session.tempo || session.pulse) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {session.distanceKm ? <span>📏 {String(session.distanceKm).replace(".", ",")} km</span> : null}
                  {session.tempo ? <span>⏱ {session.tempo}</span> : null}
                  {session.pulse ? <span>❤️ {session.pulse} bpm</span> : null}
                </div>
              )}
              {session.completion.user_comment ? <p className="text-xs italic text-muted-foreground whitespace-pre-line">💬 {session.completion.user_comment}</p> : null}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={startEdit} disabled={strength.length === 0 && !canChangeDate} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40">
                  <Pencil className="w-4 h-4" /> Redigera
                </button>
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex-1 py-2.5 rounded-xl bg-destructive/15 text-destructive text-sm font-semibold flex items-center justify-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> Radera pass
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {canChangeDate && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold">Datum</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-background rounded-md p-2 text-sm border border-border" />
                </label>
              )}
              {strength.map((e) => (
                <div key={e.name} className="rounded-xl bg-secondary/50 p-3 space-y-2">
                  <p className="text-sm font-semibold">{e.name}</p>
                  <SetRowsEditor rows={rows[e.name] || []} onChange={(r) => setRows((prev) => ({ ...prev, [e.name]: r }))} />
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-semibold">Avbryt</button>
                <button type="button" disabled={saving} onClick={save} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Spara</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <DeleteWorkoutConfirm open={confirmDelete} name={session.name} date={session.date} onCancel={() => setConfirmDelete(false)} onConfirm={doDelete} />
    </>
  );
};

export const DeleteWorkoutConfirm = ({ open, name, date, onCancel, onConfirm }: { open: boolean; name: string; date: string | null; onCancel: () => void; onConfirm: () => void }) => (
  <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Radera pass</AlertDialogTitle>
        <AlertDialogDescription>Radera passet "{name}" från {formatSessionDate(date)}? Statistik och rekord räknas om.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Avbryt</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Radera</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

/** "Tidigare pass": every completed workout, newest first. */
export const PastWorkoutsDialog = ({ userId, open, onClose, onlyDate }: { userId: string; open: boolean; onClose: () => void; onlyDate?: string | null }) => {
  const sessions = useWorkoutHistory(userId, open);
  const [selected, setSelected] = useState<HistorySession | null>(null);
  const list = (sessions || []).filter((s) => !onlyDate || s.date === onlyDate);
  return (
    <>
      <Dialog open={open && !selected} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto mobile-sheet-safe">
          <DialogHeader>
            <DialogTitle>{onlyDate ? `Pass ${formatSessionDate(onlyDate)}` : "Tidigare pass"}</DialogTitle>
          </DialogHeader>
          {sessions === null ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Laddar…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Inga avslutade pass {onlyDate ? "den här dagen" : "än"}.</p>
          ) : (
            <div className="space-y-2">{list.map((s) => <SessionRow key={s.id} s={s} onOpen={() => setSelected(s)} />)}</div>
          )}
        </DialogContent>
      </Dialog>
      {selected && <WorkoutDetailDialog userId={userId} session={selected} onClose={() => setSelected(null)} />}
    </>
  );
};
