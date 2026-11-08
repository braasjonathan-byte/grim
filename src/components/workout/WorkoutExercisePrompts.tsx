import type { Dispatch, SetStateAction } from "react";
import { type PlanDay } from "@/components/workout/types";
import { toTitleCase } from "@/lib/workoutIntervalUtils";

export type PendingReplace = { planId: string; lineIndex: number; oldName: string; entry: string; weightsPatch?: Record<string, any> };

// State remains in WorkoutView; this module preserves the original dialog markup and callback order.
export interface DeleteExercisePromptProps {
  deleteExerciseConfirm: { planId: string; lineIndex: number; name: string; } | null;
  setDeleteExerciseConfirm: Dispatch<SetStateAction<{ planId: string; lineIndex: number; name: string; } | null>>;
  executeDeleteExercise: () => Promise<void>;
}

export function DeleteExercisePrompt({ deleteExerciseConfirm, setDeleteExerciseConfirm, executeDeleteExercise }: DeleteExercisePromptProps) {
  return (<>
{deleteExerciseConfirm && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteExerciseConfirm(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Ta bort övning?</h3>
          <p className="text-sm text-muted-foreground">
            Är du säker på att du vill ta bort <span className="font-semibold text-foreground">{deleteExerciseConfirm.name}</span>?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteExerciseConfirm(null)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Avbryt
            </button>
            <button onClick={executeDeleteExercise} className="flex-1 py-2.5 bg-destructive text-destructive-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
              Ta bort
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}

export interface ExerciseRepsPromptProps {
  repsEditor: { planId: string; lineIndex: number; name: string; reps: string; timeBased: boolean; } | null;
  setRepsEditor: Dispatch<SetStateAction<{ planId: string; lineIndex: number; name: string; reps: string; timeBased: boolean; } | null>>;
  repsEditorSaving: boolean;
  applyRepsEdit: (applyToFuture: boolean) => Promise<void>;
}

export function ExerciseRepsPrompt({ repsEditor, setRepsEditor, repsEditorSaving, applyRepsEdit }: ExerciseRepsPromptProps) {
  return (<>
{repsEditor && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setRepsEditor(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Ändra {repsEditor.timeBased ? "sekunder" : "reps"}</h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{toTitleCase(repsEditor.name)}</span>
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoFocus={false}
            value={repsEditor.reps}
            onChange={(e) => setRepsEditor(prev => prev ? { ...prev, reps: e.target.value.replace(/\D/g, "") } : prev)}
            className="w-full bg-secondary text-foreground text-sm px-3 py-2 rounded-lg border border-border text-center font-mono outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-[11px] text-muted-foreground">
            Välj "Alla kommande pass" för att sätta samma förvalda {repsEditor.timeBased ? "sekunder" : "reps"} på övningen i resten av planen.
          </p>
          <div className="flex gap-2">
            <button disabled={repsEditorSaving} onClick={() => applyRepsEdit(false)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm disabled:opacity-50">
              Bara detta pass
            </button>
            <button disabled={repsEditorSaving} onClick={() => applyRepsEdit(true)} className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-50">
              Alla kommande pass
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}

export interface ExercisePropagationPromptProps {
  propagateDialog: { entry: string; originalName: string; newName: string; plan: PlanDay; lineIndex: number; } | null;
  setPropagateDialog: Dispatch<SetStateAction<{ entry: string; originalName: string; newName: string; plan: PlanDay; lineIndex: number; } | null>>;
  handlePropagate: (doPropagate: boolean) => Promise<void>;
}

export function ExercisePropagationPrompt({ propagateDialog, setPropagateDialog, handlePropagate }: ExercisePropagationPromptProps) {
  return (<>
{propagateDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setPropagateDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Tillämpa på framtida veckor?</h3>
          <p className="text-sm text-muted-foreground">
            Vill du tillämpa ändringen på alla <span className="font-semibold text-foreground">{propagateDialog.plan.day}</span>-pass i efterföljande veckor? Vikten ökas progressivt.
          </p>
          <div className="flex gap-2">
            <button onClick={() => handlePropagate(false)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Bara denna vecka
            </button>
            <button onClick={() => handlePropagate(true)} className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
              Alla framtida
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}

export interface ReplaceExercisePromptProps {
  replaceAsk: PendingReplace | null;
  setReplaceAsk: Dispatch<SetStateAction<PendingReplace | null>>;
  applyReplace: (r: PendingReplace, propagate: boolean) => Promise<void>;
}

export function ReplaceExercisePrompt({ replaceAsk, setReplaceAsk, applyReplace }: ReplaceExercisePromptProps) {
  return (<>
{replaceAsk && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setReplaceAsk(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Byt ut i hela schemat?</h3>
          <p className="text-sm text-muted-foreground">
            Vill du byta ut <span className="font-semibold text-foreground">{replaceAsk.oldName}</span> bara i detta pass eller i alla veckor?
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={() => { const r = replaceAsk; setReplaceAsk(null); applyReplace(r, false); }} className="flex-1 py-2.5 bg-secondary text-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
                Bara detta pass
              </button>
              <button onClick={() => { const r = replaceAsk; setReplaceAsk(null); applyReplace(r, true); }} className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
                Hela schemat
              </button>
            </div>
            <button onClick={() => setReplaceAsk(null)} className="w-full py-2 text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Avbryt
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}
