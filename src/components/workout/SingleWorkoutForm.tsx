import type { Dispatch, SetStateAction } from "react";
import { Plus, CalendarIcon, TrendingUp, Download } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { type PlanDay } from "@/components/workout/types";

// State remains in WorkoutView; this module preserves the original dialog markup and callback order.
export interface SingleWorkoutFormProps {
  showAddSingle: boolean;
  plans: PlanDay[];
  setShowCopyPicker: Dispatch<SetStateAction<boolean>>;
  showCopyPicker: boolean;
  addSingleWorkout: (copyFrom?: PlanDay | undefined) => Promise<void>;
  setImportWorkoutTarget: Dispatch<SetStateAction<{ planId: string; week: number; day: string; } | null>>;
  singleDate: Date;
  setSingleDate: Dispatch<SetStateAction<Date>>;
  singleName: string;
  setSingleName: Dispatch<SetStateAction<string>>;
  singleIsCircuit: boolean;
  setSingleIsCircuit: Dispatch<SetStateAction<boolean>>;
  singleCircuitSeconds: string;
  setSingleCircuitSeconds: Dispatch<SetStateAction<string>>;
  singleCircuitRounds: string;
  setSingleCircuitRounds: Dispatch<SetStateAction<string>>;
  singleCircuitRest: string;
  setSingleCircuitRest: Dispatch<SetStateAction<string>>;
  setShowAddSingle: Dispatch<SetStateAction<boolean>>;
}

export function SingleWorkoutForm({ showAddSingle, plans, setShowCopyPicker, showCopyPicker, addSingleWorkout, setImportWorkoutTarget, singleDate, setSingleDate, singleName, setSingleName, singleIsCircuit, setSingleIsCircuit, singleCircuitSeconds, setSingleCircuitSeconds, singleCircuitRounds, setSingleCircuitRounds, singleCircuitRest, setSingleCircuitRest, setShowAddSingle }: SingleWorkoutFormProps) {
  return (<>
{showAddSingle ?
        <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3 animate-fade-in">
            <h3 className="text-sm font-semibold">Nytt pass</h3>

            {/* Copy from previous session */}
            {(() => {
            const uniqueSessions = new Map<string, PlanDay>();
            const singlePlans2 = plans.filter((p) => p.week === 0);
            // Get latest version of each session name
            for (const p of singlePlans2) {
              const existing = uniqueSessions.get(p.session_name);
              if (!existing || p.day > existing.day) {
                uniqueSessions.set(p.session_name, p);
              }
            }
            const previousSessions = Array.from(uniqueSessions.values());

            if (previousSessions.length > 0) {
              return (
                <div className="space-y-2">
                    <button
                    onClick={() => setShowCopyPicker(!showCopyPicker)}
                    className="w-full py-2 border border-dashed border-primary/40 rounded-md text-xs text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1">

                      <TrendingUp className="w-3 h-3" /> Kopiera tidigare pass
                    </button>
                    <p className="text-[10px] text-muted-foreground text-center">Övningar, vikter och reps kopieras — justera själv för progression</p>
                    {showCopyPicker &&
                  <div className="space-y-1 max-h-40 overflow-y-auto animate-fade-in">
                        {previousSessions.map((p) =>
                    <button
                      key={p.id}
                      onClick={() => addSingleWorkout(p)}
                      className="w-full text-left p-2.5 bg-secondary rounded-md text-xs hover:bg-primary/10 transition-colors">

                            <span className="font-semibold block">{p.session_name}</span>
                            {p.details &&
                      <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                                {p.details.split("\n").slice(0, 2).join(", ")}
                              </span>
                      }
                          </button>
                    )}
                      </div>
                  }
                  </div>);

            }
            return null;
          })()}

            {/* Import ready workout */}
            <button
              onClick={() => {
                // Find a matching ready workout and create single workout
                setImportWorkoutTarget({ planId: "__single__", week: 0, day: "" });
              }}
              data-tour="import-workout"
              className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-warning hover:border-warning transition-colors flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3" /> Importera färdigt pass
            </button>

            {/* Date picker */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                  className={cn(
                    "w-full flex items-center gap-2 bg-secondary text-secondary-foreground text-sm p-2 rounded-md text-left",
                    !singleDate && "text-muted-foreground"
                  )}>

                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    {singleDate ? format(singleDate, "d MMMM yyyy", { locale: sv }) : "Välj datum"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[80]" align="start">
                  <Calendar
                  mode="single"
                  selected={singleDate}
                  onSelect={(date) => date && setSingleDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")} />

                </PopoverContent>
              </Popover>
            </div>

            <input
            type="text"
            value={singleName}
            onChange={(e) => setSingleName(e.target.value)}
            placeholder="Passnamn (t.ex. Styrka överkropp)"
            className="w-full bg-secondary text-secondary-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            autoFocus />

            <p className="text-[10px] text-muted-foreground">
              Lägg till övningar efter att passet skapats
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={singleIsCircuit} onChange={(e) => setSingleIsCircuit(e.target.checked)} className="accent-primary w-4 h-4" />
              <span className="text-xs text-foreground">Cirkelpass (visar Starta-knapp)</span>
            </label>
            {singleIsCircuit && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Sek/övning:</label>
                  <input type="text" inputMode="numeric" min="5" max="300" value={singleCircuitSeconds} onChange={(e) => setSingleCircuitSeconds(e.target.value)} className="w-16 bg-secondary text-secondary-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                  <label className="text-xs text-muted-foreground whitespace-nowrap ml-2">Rundor:</label>
                  <input type="text" inputMode="numeric" min="1" max="20" value={singleCircuitRounds} onChange={(e) => setSingleCircuitRounds(e.target.value)} className="w-16 bg-secondary text-secondary-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Vila mellan rundor:</label>
                  <input type="text" inputMode="numeric" min="0" max="300" value={singleCircuitRest} onChange={(e) => setSingleCircuitRest(e.target.value)} className="w-16 bg-secondary text-secondary-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                  <span className="text-xs text-muted-foreground">sek</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => addSingleWorkout()} disabled={!singleName.trim()} className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-40">
                Skapa pass
              </button>
              <button onClick={() => {setShowAddSingle(false);setShowCopyPicker(false);}} className="px-4 py-2 bg-secondary text-muted-foreground rounded-md text-sm">
                Avbryt
              </button>
            </div>
          </div> :

        <button
          onClick={() => setShowAddSingle(true)}
          className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2">

            <Plus className="w-4 h-4" /> Lägg till pass
          </button>
        }
  </>);
}
