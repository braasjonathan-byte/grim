import type { Dispatch, SetStateAction } from "react";
import { X, Download, Lock, Sparkles } from "lucide-react";
import type { ReadyWorkoutCategory } from "@/data/readyWorkouts";

// State remains in WorkoutView; this module preserves the original dialog markup and callback order.
export interface WorkoutImportPickerProps {
  importWorkoutTarget: { planId: string; week: number; day: string; } | null;
  setImportWorkoutTarget: Dispatch<SetStateAction<{ planId: string; week: number; day: string; } | null>>;
  isHonorary: boolean;
  isAdmin: boolean;
  setShowAiScan: Dispatch<SetStateAction<boolean>>;
  setShowFileImport: Dispatch<SetStateAction<boolean>>;
  savedWorkouts: { id: string; name: string; details: string; tempo: string | null; visibility: string; user_id: string; }[];
  userId: string;
  handleImportWorkout: (rawWorkout: { name: string; details: string; tempo: string | null; }) => void;
  readyWorkoutCategories: ReadyWorkoutCategory[];
}

export function WorkoutImportPicker({ importWorkoutTarget, setImportWorkoutTarget, isHonorary, isAdmin, setShowAiScan, setShowFileImport, savedWorkouts, userId, handleImportWorkout, readyWorkoutCategories }: WorkoutImportPickerProps) {
  return (<>
{importWorkoutTarget && (
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setImportWorkoutTarget(null)} />
        <div className="relative bg-card rounded-t-xl sm:rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4 space-y-3 z-10">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Importera färdigt pass</h3>
            <button onClick={() => setImportWorkoutTarget(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          {(isHonorary || isAdmin) && (
            <button
              onClick={() => setShowAiScan(true)}
              className="w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI: läs av skärmdump från annan app
            </button>
          )}
          <button
            onClick={() => setShowFileImport(true)}
            className="w-full py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Importera fil (.gpx / .tcx / .fit)
          </button>


          {/* User's own saved workouts */}
          {(() => {
            const myWorkouts = savedWorkouts.filter(sw => sw.user_id === userId);
            if (myWorkouts.length === 0) return null;
            return (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground">⭐ Mina sparade pass</p>
                {myWorkouts.map((sw) => (
                  <button
                    key={sw.id}
                    onClick={() => handleImportWorkout({ name: sw.name, details: sw.details, tempo: sw.tempo })}
                    className="w-full text-left bg-secondary/50 hover:bg-secondary rounded-lg px-3 py-2 transition-colors"
                  >
                    <p className="text-xs font-semibold text-foreground">{sw.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{sw.details.replace(/\n/g, " · ")}</p>
                  </button>
                ))}
              </div>
            );
          })()}
          {/* Public saved workouts from other users */}
          {(() => {
            const publicWorkouts = savedWorkouts.filter(sw => sw.visibility === "public" && sw.user_id !== userId);
            if (publicWorkouts.length === 0) return null;
            return (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground">👥 Skapat av användare</p>
                {publicWorkouts.map((sw) => (
                  <button
                    key={sw.id}
                    onClick={() => handleImportWorkout({ name: sw.name, details: sw.details, tempo: sw.tempo })}
                    className="w-full text-left bg-secondary/50 hover:bg-secondary rounded-lg px-3 py-2 transition-colors"
                  >
                    <p className="text-xs font-semibold text-foreground">{sw.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{sw.details.replace(/\n/g, " · ")}</p>
                  </button>
                ))}
              </div>
            );
          })()}
          {readyWorkoutCategories.map((cat, ci) => (
            <div key={ci} className="space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground">{cat.emoji} {cat.label}</p>
              {cat.workouts.map((w, wi) => {
                const isLocked = wi > 0 && !isHonorary && !isAdmin;
                return (
                <button
                  key={wi}
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    handleImportWorkout({ name: w.name, details: w.details, tempo: w.tempo });
                  }}
                  className={`w-full text-left bg-secondary/50 rounded-lg px-3 py-2 transition-colors flex items-center justify-between ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{w.name}</p>
                    {isLocked ? <p className="text-[10px] text-warning">🔒 Exklusivt för hedersmedlemmar</p> : <p className="text-[10px] text-muted-foreground line-clamp-1">{w.details.replace(/\n/g, " · ")}</p>}
                  </div>
                  {isLocked && <Lock className="w-3.5 h-3.5 text-warning flex-shrink-0 ml-2" />}
                </button>
                );
              })}
            </div>
          ))}
          {!isHonorary && !isAdmin && (
            <div className="text-center pt-2 space-y-1">
              <p className="text-[10px] text-muted-foreground">🔒 Exklusivt för hedersmedlemmar</p>
              <p className="text-[10px] text-muted-foreground">Som vanlig medlem kan du välja 1 pass per kategori.</p>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}

export interface WorkoutImportConflictPromptsProps {
  pendingImport: { target: { planId: string; week: number; day: string; }; workout: { name: string; details: string; tempo: string | null; }; step: "conflict" | "propagate"; mode?: "replace" | "append" | undefined; } | null;
  setPendingImport: Dispatch<SetStateAction<{ target: { planId: string; week: number; day: string; }; workout: { name: string; details: string; tempo: string | null; }; step: "conflict" | "propagate"; mode?: "replace" | "append" | undefined; } | null>>;
  executeImport: (target: { planId: string; week: number; day: string; }, workout: { name: string; details: string; tempo: string | null; }, mode: "replace" | "append", propagate: boolean) => Promise<void>;
}

export function WorkoutImportConflictPrompts({ pendingImport, setPendingImport, executeImport }: WorkoutImportConflictPromptsProps) {
  return (<>
{pendingImport && pendingImport.step === "conflict" && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setPendingImport(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Detta pass har redan övningar</h3>
          <p className="text-sm text-muted-foreground">
            Vill du <span className="font-semibold text-foreground">ersätta</span> de befintliga övningarna med "{pendingImport.workout.name}", eller <span className="font-semibold text-foreground">lägga till</span> övningarna efter de befintliga?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                const next = { ...pendingImport, mode: "replace" as const };
                if (pendingImport.target.week > 0) {
                  setPendingImport({ ...next, step: "propagate" });
                } else {
                  void executeImport(pendingImport.target, pendingImport.workout, "replace", false);
                }
              }}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Ersätt befintliga övningar
            </button>
            <button
              onClick={() => {
                const next = { ...pendingImport, mode: "append" as const };
                if (pendingImport.target.week > 0) {
                  setPendingImport({ ...next, step: "propagate" });
                } else {
                  void executeImport(pendingImport.target, pendingImport.workout, "append", false);
                }
              }}
              className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
            >
              Lägg till efter befintliga
            </button>
            <button
              onClick={() => setPendingImport(null)}
              className="w-full py-2 text-muted-foreground text-xs hover:text-foreground"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    )}
{pendingImport && pendingImport.step === "propagate" && pendingImport.mode && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setPendingImport(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Tillämpa på alla {pendingImport.target.day}-pass?</h3>
          <p className="text-sm text-muted-foreground">
            Vill du tillämpa denna ändring på alla framtida {pendingImport.target.day}-pass i planen, eller bara på det aktuella passet?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => void executeImport(pendingImport.target, pendingImport.workout, pendingImport.mode!, true)}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Alla framtida {pendingImport.target.day}-pass
            </button>
            <button
              onClick={() => void executeImport(pendingImport.target, pendingImport.workout, pendingImport.mode!, false)}
              className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
            >
              Bara denna vecka
            </button>
            <button
              onClick={() => setPendingImport(null)}
              className="w-full py-2 text-muted-foreground text-xs hover:text-foreground"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}
