import type { Dispatch, SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, X, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { type PlanDay, type Completion } from "@/components/workout/types";
import { DAYS, getBaseDay, sameWorkoutDay } from "@/lib/workoutDayUtils";

// State remains in WorkoutView; this module preserves the original dialog markup and callback order.
export interface ChangeWorkoutDayDialogProps {
  changeDayDialog: { planId: string; currentDay: string; week: number; sessionName: string; } | null;
  setChangeDayDialog: Dispatch<SetStateAction<{ planId: string; currentDay: string; week: number; sessionName: string; } | null>>;
  plans: PlanDay[];
  completions: Record<string, Completion>;
  stripChallengeLines: (details: string) => string;
  userId: string;
  fetchData: () => Promise<void>;
  changeWorkoutDay: (planId: string, newDay: string, week: number) => Promise<void>;
}

export function ChangeWorkoutDayDialog({ changeDayDialog, setChangeDayDialog, plans, completions, stripChallengeLines, userId, fetchData, changeWorkoutDay }: ChangeWorkoutDayDialogProps) {
  return (<>
{changeDayDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setChangeDayDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              Byt veckodag
            </h3>
            <button onClick={() => setChangeDayDialog(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{changeDayDialog.sessionName}</span> — nuvarande dag: <span className="font-mono font-semibold text-foreground">{getBaseDay(changeDayDialog.currentDay)}</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DAYS.map((d) => {
              const isCurrentDay = sameWorkoutDay(d, changeDayDialog.currentDay);
              const isOccupied = !isCurrentDay && plans.some(p => p.week === changeDayDialog.week && sameWorkoutDay(p.day, d));
              return (
                <button
                  key={d}
                  onClick={async () => {
                    if (!isCurrentDay) {
                      if (isOccupied) {
                        // Swap: move target to current day and current to target day
                        const targetPlan = plans.find(p => p.week === changeDayDialog.week && sameWorkoutDay(p.day, d));
                        if (targetPlan) {
                          const week = changeDayDialog.week;
                          const oldDay = changeDayDialog.currentDay;
                          const newDay = d;

                          // Get completions for both days
                          const compOld = completions[`${week}-${oldDay}`];
                          const compNew = completions[`${week}-${newDay}`];

                          // Strip challenge lines from both plans before swapping
                          const cleanDetailsCurrent = stripChallengeLines(
                            plans.find(p => p.id === changeDayDialog.planId)?.details || ""
                          );
                          const cleanDetailsTarget = stripChallengeLines(targetPlan.details || "");

                          // Swap plan days using a temp value to avoid unique constraint conflict
                          const tempDay = `__swap_${Date.now()}`;
                          await supabase.from("workout_plans").update({ day: tempDay, details: cleanDetailsCurrent }).eq("id", changeDayDialog.planId);
                          await supabase.from("workout_plans").update({ day: oldDay, details: cleanDetailsTarget }).eq("id", targetPlan.id);
                          await supabase.from("workout_plans").update({ day: newDay }).eq("id", changeDayDialog.planId);

                          // Delete both completions first, then re-insert swapped
                          await supabase.from("workout_completions").delete()
                            .eq("user_id", userId).eq("week", week).in("day", [oldDay, newDay]);

                          const upserts: any[] = [];
                          if (compOld) {
                            upserts.push({
                              user_id: userId, week, day: newDay, done: compOld.done, skipped: compOld.skipped,
                              user_comment: compOld.user_comment || "",
                              logged_tempo: compOld.logged_tempo, logged_pulse: compOld.logged_pulse,
                              logged_distance_km: compOld.logged_distance_km, logged_weights: compOld.logged_weights as any,
                            });
                          }
                          if (compNew) {
                            upserts.push({
                              user_id: userId, week, day: oldDay, done: compNew.done, skipped: compNew.skipped,
                              user_comment: compNew.user_comment || "",
                              logged_tempo: compNew.logged_tempo, logged_pulse: compNew.logged_pulse,
                              logged_distance_km: compNew.logged_distance_km, logged_weights: compNew.logged_weights as any,
                            });
                          }
                          if (upserts.length > 0) {
                            await supabase.from("workout_completions").upsert(upserts, { onConflict: "user_id,week,day" });
                          }

                          setChangeDayDialog(null);
                          fetchData();
                        }
                      } else {
                        changeWorkoutDay(changeDayDialog.planId, d, changeDayDialog.week);
                      }
                    }
                  }}
                  disabled={isCurrentDay}
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentDay 
                      ? "bg-primary text-primary-foreground" 
                      : isOccupied 
                        ? "bg-secondary text-muted-foreground cursor-pointer border border-border hover:border-primary"
                        : "bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground"
                  }`}
                  title={isOccupied ? `Byt plats med ${plans.find(p => p.week === changeDayDialog.week && sameWorkoutDay(p.day, d))?.session_name}` : undefined}
                >
                  {d}
                  {isOccupied && <span className="block text-[8px] text-muted-foreground/70 mt-0.5">upptagen</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Tryck på en upptagen dag för att byta plats mellan passen.</p>
        </div>
      </div>
    )}
  </>);
}

export interface CopyWorkoutDateDialogProps {
  copyToDateSource: PlanDay | null;
  setCopyToDateSource: Dispatch<SetStateAction<PlanDay | null>>;
  copyToDateConflict: "replace" | "ask" | "add" | null;
  copyToDateSelected: Date;
  setCopyToDateConflict: Dispatch<SetStateAction<"replace" | "ask" | "add" | null>>;
  executeCopyToDate: (conflictMode: "replace" | "add") => Promise<void>;
  copyToDateSaving: boolean;
  setCopyToDateSelected: Dispatch<SetStateAction<Date>>;
  handleCopyToDateConfirm: () => Promise<void>;
}

export function CopyWorkoutDateDialog({ copyToDateSource, setCopyToDateSource, copyToDateConflict, copyToDateSelected, setCopyToDateConflict, executeCopyToDate, copyToDateSaving, setCopyToDateSelected, handleCopyToDateConfirm }: CopyWorkoutDateDialogProps) {
  return (<>
{copyToDateSource && (
      <>
        <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setCopyToDateSource(null)} />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[90] max-w-sm mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Kopiera till datum
              </h3>
              <button onClick={() => setCopyToDateSource(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {copyToDateSource.session_name}
            </p>
          </div>

          {copyToDateConflict === "ask" ? (
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Det finns redan övningar på <span className="font-semibold text-foreground">{format(copyToDateSelected, "d MMMM yyyy", { locale: sv })}</span>. Vad vill du göra?
              </p>
              <button
                onClick={async () => {
                  setCopyToDateConflict("replace");
                  await executeCopyToDate("replace");
                }}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                Ersätt befintliga övningar
              </button>
              <button
                onClick={async () => {
                  setCopyToDateConflict("add");
                  await executeCopyToDate("add");
                }}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                Lägg till efter befintliga
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={copyToDateSelected}
                  onSelect={(d) => d && setCopyToDateSelected(d)}
                  locale={sv}
                  className="p-3 pointer-events-auto bg-card border border-border rounded-lg"
                />
              </div>
              <div className="bg-secondary/50 border border-border rounded-lg p-2.5 text-center">
                <p className="text-xs font-medium">
                  Kopiera till: <span className="text-primary">{format(copyToDateSelected, "EEEE d MMMM yyyy", { locale: sv })}</span>
                </p>
              </div>
              <button
                onClick={handleCopyToDateConfirm}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-50"
              >
                {copyToDateSaving ? "Kopierar..." : "Kopiera"}
              </button>
            </div>
          )}
        </div>
      </>
    )}
  </>);
}

export interface AddWorkoutWeekDialogProps {
  showAddWeekDialog: boolean;
  setShowAddWeekDialog: Dispatch<SetStateAction<boolean>>;
  weeks: number[];
  setAddWeekSourceWeek: Dispatch<SetStateAction<number | null>>;
  addWeekSourceWeek: number | null;
  plans: PlanDay[];
  addWeekByCopy: (sourceWeek: number) => Promise<void>;
  addWeekSaving: boolean;
}

export function AddWorkoutWeekDialog({ showAddWeekDialog, setShowAddWeekDialog, weeks, setAddWeekSourceWeek, addWeekSourceWeek, plans, addWeekByCopy, addWeekSaving }: AddWorkoutWeekDialogProps) {
  return (<>
{showAddWeekDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddWeekDialog(false)}>
        <div className="bg-card rounded-xl border border-border p-5 w-[90%] max-w-sm space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Lägg till vecka</h3>
            <button onClick={() => setShowAddWeekDialog(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Välj vilken vecka du vill kopiera till den nya veckan:</p>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {weeks.filter(w => w > 0).map(w => (
              <button
                key={w}
                onClick={() => setAddWeekSourceWeek(w)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  addWeekSourceWeek === w
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                V{w}
              </button>
            ))}
          </div>
          {addWeekSourceWeek && (
            <p className="text-xs text-muted-foreground text-center">
              Kopierar {plans.filter(p => p.week === addWeekSourceWeek).length} pass från vecka {addWeekSourceWeek}
            </p>
          )}
          <button
            onClick={() => addWeekSourceWeek && addWeekByCopy(addWeekSourceWeek)}
            disabled={!addWeekSourceWeek || addWeekSaving}
            className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-50"
          >
            {addWeekSaving ? "Skapar..." : `Skapa vecka ${(weeks.filter(w => w > 0).length > 0 ? Math.max(...weeks.filter(w => w > 0)) + 1 : 1)}`}
          </button>
        </div>
      </div>
    )}
  </>);
}
