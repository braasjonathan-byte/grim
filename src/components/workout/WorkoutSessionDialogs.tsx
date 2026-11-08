import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, X, XCircle, Send, Settings, Save } from "lucide-react";
import { type PlanDay } from "@/components/workout/types";
import { getBaseDay } from "@/lib/workoutDayUtils";

// State remains in WorkoutView; this module preserves the original dialog markup and callback order.
export interface SaveWorkoutDialogProps {
  saveWorkoutSource: { details: string; tempo: string | null; defaultName: string; } | null;
  setSaveWorkoutSource: Dispatch<SetStateAction<{ details: string; tempo: string | null; defaultName: string; } | null>>;
  saveWorkoutName: string;
  setSaveWorkoutName: Dispatch<SetStateAction<string>>;
  setSaveWorkoutVisibility: Dispatch<SetStateAction<"public" | "private">>;
  saveWorkoutVisibility: "public" | "private";
  saveWorkoutIsCircuit: boolean;
  setSaveWorkoutIsCircuit: Dispatch<SetStateAction<boolean>>;
  setSaveWorkoutSaving: Dispatch<SetStateAction<boolean>>;
  userId: string;
  setSavedWorkouts: Dispatch<SetStateAction<{ id: string; name: string; details: string; tempo: string | null; visibility: string; user_id: string; }[]>>;
  saveWorkoutSaving: boolean;
}

export function SaveWorkoutDialog({ saveWorkoutSource, setSaveWorkoutSource, saveWorkoutName, setSaveWorkoutName, setSaveWorkoutVisibility, saveWorkoutVisibility, saveWorkoutIsCircuit, setSaveWorkoutIsCircuit, setSaveWorkoutSaving, userId, setSavedWorkouts, saveWorkoutSaving }: SaveWorkoutDialogProps) {
  return (<>
{saveWorkoutSource && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setSaveWorkoutSource(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Save className="w-4 h-4 text-primary" />
              Spara pass
            </h3>
            <button onClick={() => setSaveWorkoutSource(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Namn på passet</label>
              <input
                type="text"
                value={saveWorkoutName}
                onChange={(e) => setSaveWorkoutName(e.target.value)}
                placeholder="T.ex. Mitt favoritpass"
                className="w-full bg-secondary text-foreground text-sm px-3 py-2.5 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Synlighet</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSaveWorkoutVisibility("private")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${saveWorkoutVisibility === "private" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  🔒 Bara jag
                </button>
                <button
                  onClick={() => setSaveWorkoutVisibility("public")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${saveWorkoutVisibility === "public" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  🌍 Alla användare
                </button>
              </div>
              {saveWorkoutVisibility === "public" && (
                <p className="text-[10px] text-muted-foreground mt-1">Passet visas under "Skapat av användare" för alla.</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveWorkoutIsCircuit}
                  onChange={(e) => setSaveWorkoutIsCircuit(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                <span className="text-xs text-foreground">Cirkelpass (visar Starta-knapp)</span>
              </label>
              <p className="text-[10px] text-muted-foreground mt-1 ml-6">Avmarkera om det är ett vanligt styrkepass.</p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!saveWorkoutName.trim()) return;
              setSaveWorkoutSaving(true);
              const tempoToSave = saveWorkoutIsCircuit
                ? (saveWorkoutSource.tempo && saveWorkoutSource.tempo.startsWith("circuit:") ? saveWorkoutSource.tempo : "circuit:40:3:0")
                : null;
              const { data, error } = await supabase.from("saved_workouts").insert({
                user_id: userId,
                name: saveWorkoutName.trim(),
                details: saveWorkoutSource.details,
                tempo: tempoToSave,
                visibility: saveWorkoutVisibility,
              } as any).select().single();
              setSaveWorkoutSaving(false);
              if (error) {
                toast.error("Kunde inte spara passet");
              } else {
                setSavedWorkouts(prev => [...prev, data as any]);
                toast.success(`"${saveWorkoutName.trim()}" sparat!`);
                setSaveWorkoutSource(null);
              }
            }}
            disabled={saveWorkoutSaving || !saveWorkoutName.trim()}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
          >
            {saveWorkoutSaving ? "Sparar..." : "Spara"}
          </button>
        </div>
      </div>
    )}
  </>);
}

export interface WorkoutSessionSettingsDialogProps {
  renameDialog: { planId: string; currentName: string; week: number; day: string; sessionName: string; } | null;
  setRenameDialog: Dispatch<SetStateAction<{ planId: string; currentName: string; week: number; day: string; sessionName: string; } | null>>;
  renameInput: string;
  setRenameInput: Dispatch<SetStateAction<string>>;
  renameSession: (planId: string, newName: string) => Promise<void>;
  setWorkoutAsCurrentDay: () => Promise<void>;
  settingCurrentDay: boolean;
  toggleSkipped: (week: number, day: string) => Promise<void>;
  setReplacementTarget: Dispatch<SetStateAction<{ planId: string; sessionName: string; week: number; day: string; } | null>>;
}

export function WorkoutSessionSettingsDialog({ renameDialog, setRenameDialog, renameInput, setRenameInput, renameSession, setWorkoutAsCurrentDay, settingCurrentDay, toggleSkipped, setReplacementTarget }: WorkoutSessionSettingsDialogProps) {
  return (<>
{renameDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setRenameDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Passinställningar
            </h3>
            <button onClick={() => setRenameDialog(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Rename section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Byt namn</label>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && renameSession(renameDialog.planId, renameInput)}
              placeholder="Nytt namn..."
              className="w-full bg-secondary text-foreground text-sm p-2.5 border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              autoFocus
            />
            <button
              onClick={() => renameSession(renameDialog.planId, renameInput)}
              disabled={!renameInput.trim() || renameInput.trim() === renameDialog.currentName}
              className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Spara namn
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {renameDialog.week > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Aktuell träningsdag</label>
              <button
                onClick={setWorkoutAsCurrentDay}
                disabled={settingCurrentDay}
                className="w-full py-2.5 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <CalendarIcon className="w-4 h-4" />
                {settingCurrentDay ? "Uppdaterar..." : "Gör detta pass till dagens pass"}
              </button>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Justerar schemats startdatum så att vecka {renameDialog.week}, {getBaseDay(renameDialog.day)} matchar idag.
              </p>
            </div>
          )}

          <div className="border-t border-border" />

          {/* Skip/miss section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Markera pass</label>
            <button
              onClick={() => {
                if (renameDialog.week === 0) {
                  const { week, day } = renameDialog;
                  setRenameDialog(null);
                  void toggleSkipped(week, day);
                  return;
                }
                setReplacementTarget({
                  planId: renameDialog.planId,
                  sessionName: renameDialog.sessionName,
                  week: renameDialog.week,
                  day: renameDialog.day
                });
                setRenameDialog(null);
              }}
              className="w-full py-2.5 bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              {renameDialog.week === 0 ? "Markera som missat" : "Markera som missat"}
            </button>
          </div>

          <button
            onClick={() => setRenameDialog(null)}
            className="w-full py-2.5 bg-secondary text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    )}
  </>);
}

export interface ShareWorkoutChatDialogProps {
  chatShareTarget: PlanDay | null;
  chatFriends: { user_id: string; nickname: string; }[];
  setChatShareTarget: Dispatch<SetStateAction<PlanDay | null>>;
  chatShareSending: boolean;
  setChatShareSending: Dispatch<SetStateAction<boolean>>;
  userId: string;
  triggerSave: () => void;
}

export function ShareWorkoutChatDialog({ chatShareTarget, chatFriends, setChatShareTarget, chatShareSending, setChatShareSending, userId, triggerSave }: ShareWorkoutChatDialogProps) {
  return (<>
{chatShareTarget && chatFriends.length > 0 && (
      <>
        <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setChatShareTarget(null)} />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[90] max-w-sm mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Dela pass via chatt
              </h3>
              <button onClick={() => setChatShareTarget(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {chatShareTarget.session_name} – {chatShareTarget.details.split(/[;\n]/).filter(Boolean).length} övningar
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {chatFriends.map(friend => (
              <button
                key={friend.user_id}
                disabled={chatShareSending}
                onClick={async () => {
                  setChatShareSending(true);
                  await supabase.from("chat_messages").insert({
                    sender_id: userId,
                    receiver_id: friend.user_id,
                    message: `Delade passet "${chatShareTarget.session_name}"`,
                    message_type: "workout",
                    shared_workout: {
                      session_name: chatShareTarget.session_name,
                      details: chatShareTarget.details,
                      tempo: chatShareTarget.tempo,
                      week: chatShareTarget.week,
                    },
                  });
                  setChatShareSending(false);
                  setChatShareTarget(null);
                  triggerSave();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{friend.nickname.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium">{friend.nickname}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    )}
  </>);
}
