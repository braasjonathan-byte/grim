import type { Dispatch, SetStateAction } from "react";
import { parseNum } from "@/lib/inputValidation";
import { supabase } from "@/integrations/supabase/client";
import { type PlanDay } from "@/components/workout/types";

// State remains in WorkoutView; this module preserves the original dialog markup and callback order.
export interface WorkoutNamePromptProps {
  namePromptDialog: { week: number; day: string; planId: string; suggestion: string; } | null;
  setNamePromptDialog: Dispatch<SetStateAction<{ week: number; day: string; planId: string; suggestion: string; } | null>>;
  namePromptInput: string;
  setNamePromptInput: Dispatch<SetStateAction<string>>;
  setPlans: Dispatch<SetStateAction<PlanDay[]>>;
  toggleDone: (week: number, day: string, skipNamePrompt?: boolean) => Promise<void>;
}

export function WorkoutNamePrompt({ namePromptDialog, setNamePromptDialog, namePromptInput, setNamePromptInput, setPlans, toggleDone }: WorkoutNamePromptProps) {
  return (<>
{namePromptDialog && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setNamePromptDialog(null)} />
        <div className="relative bg-card rounded-2xl shadow-lg p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div>
            <h3 className="font-bold text-base">Vad heter passet?</h3>
            <p className="text-sm text-muted-foreground mt-1">Passet saknar namn – här är ett förslag som du kan ändra.</p>
          </div>
          <input
            autoFocus
            value={namePromptInput}
            onChange={(e) => setNamePromptInput(e.target.value)}
            placeholder={namePromptDialog.suggestion}
            className="w-full bg-background text-foreground text-sm px-3 py-2.5 rounded-xl border border-border outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNamePromptDialog(null)}
              className="flex-1 py-2.5 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:opacity-80 transition-opacity"
            >
              Avbryt
            </button>
            <button
              onClick={async () => {
                const d = namePromptDialog;
                const name = (namePromptInput.trim() || d.suggestion).trim();
                setNamePromptDialog(null);
                await supabase.from("workout_plans").update({ session_name: name }).eq("id", d.planId);
                setPlans((prev) => prev.map((p) => (p.id === d.planId ? { ...p, session_name: name } : p)));
                await toggleDone(d.week, d.day, true);
              }}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl"
            >
              Spara & klarmarkera
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}

export interface UncheckedSetsPromptProps {
  uncheckedSetsDialog: { week: number; day: string; uncheckedCount: number; doneCount: number; totalCount: number; } | null;
  setUncheckedSetsDialog: Dispatch<SetStateAction<{ week: number; day: string; uncheckedCount: number; doneCount: number; totalCount: number; } | null>>;
  performToggleDone: (week: number, day: string) => Promise<void>;
}

export function UncheckedSetsPrompt({ uncheckedSetsDialog, setUncheckedSetsDialog, performToggleDone }: UncheckedSetsPromptProps) {
  return (<>
{uncheckedSetsDialog && (

      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setUncheckedSetsDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Obockade set</h3>
          <p className="text-sm text-muted-foreground">
            Du har gjort {uncheckedSetsDialog.doneCount} av {uncheckedSetsDialog.totalCount} set. Obockade sparas som ej gjorda.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setUncheckedSetsDialog(null)}
              className="flex-1 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity"
            >
              Avbryt
            </button>
            <button
              onClick={async () => {
                const { week, day } = uncheckedSetsDialog;
                setUncheckedSetsDialog(null);
                await performToggleDone(week, day);
              }}
              className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity"
            >
              Klarmarkera
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}

export interface BodyWeightPromptProps {
  showWeightPrompt: boolean;
  setShowWeightPrompt: Dispatch<SetStateAction<boolean>>;
  weightPromptValue: string;
  setWeightPromptValue: Dispatch<SetStateAction<string>>;
  userId: string;
  setProfileWeight: Dispatch<SetStateAction<number | null>>;
}

export function BodyWeightPrompt({ showWeightPrompt, setShowWeightPrompt, weightPromptValue, setWeightPromptValue, userId, setProfileWeight }: BodyWeightPromptProps) {
  return (<>
{showWeightPrompt && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowWeightPrompt(false)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Ange din kroppsvikt</h3>
          <p className="text-sm text-muted-foreground">
            Din kroppsvikt behövs för att beräkna effektiv vikt på kroppsviktsövningar.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={weightPromptValue}
              onChange={(e) => setWeightPromptValue(e.target.value)}
              placeholder="kg"
              className="flex-1 bg-secondary text-foreground text-sm px-3 py-2.5 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              autoFocus
            />
            <span className="text-sm text-muted-foreground">kg</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowWeightPrompt(false)}
              className="flex-1 py-2.5 bg-secondary text-muted-foreground text-sm font-semibold rounded-lg"
            >
              Avbryt
            </button>
            <button
              onClick={async () => {
                const w = parseNum(weightPromptValue);
                if (isNaN(w) || w <= 0) return;
                await supabase.from("profiles").update({ weight_kg: w }).eq("user_id", userId);
                setProfileWeight(w);
                setShowWeightPrompt(false);
                setWeightPromptValue("");
              }}
              disabled={!weightPromptValue || isNaN(parseNum(weightPromptValue)) || parseNum(weightPromptValue) <= 0}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg disabled:opacity-40"
            >
              Spara
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}
