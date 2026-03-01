import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Copy, Trash2, ArrowLeft, Save, ChevronDown, ChevronUp, Search, X, Dumbbell } from "lucide-react";
import { exerciseLibrary, muscleGroups } from "@/data/exerciseLibrary";

interface SchemaBuilderProps {
  userId: string;
  onDone: () => void;
  onBack: () => void;
}

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

interface ExerciseEntry {
  name: string;
  sets: number;
  reps: string;
  weight: string;
}

interface BuilderDay {
  day: string;
  session_name: string;
  details: string;
  tempo: string;
  exercises: ExerciseEntry[];
}

interface BuilderWeek {
  weekNumber: number;
  days: BuilderDay[];
  collapsed: boolean;
}

interface CustomExercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
}

const SchemaBuilder = ({ userId, onDone, onBack }: SchemaBuilderProps) => {
  const [weeks, setWeeks] = useState<BuilderWeek[]>([
    { weekNumber: 1, days: [], collapsed: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [editingDay, setEditingDay] = useState<{ weekIdx: number; dayIdx: number } | null>(null);
  const [showAddDay, setShowAddDay] = useState<number | null>(null);
  const [newDay, setNewDay] = useState<BuilderDay>({ day: "Mån", session_name: "", details: "", tempo: "", exercises: [] });

  // Exercise picker state
  const [pickerTarget, setPickerTarget] = useState<{ weekIdx: number; dayIdx: number; isNew: boolean } | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);

  useEffect(() => {
    supabase.from("custom_exercises").select("*").order("name").then(({ data }) => {
      if (data) setCustomExercises(data);
    });
  }, []);

  const allExercises = [
    ...exerciseLibrary.map(e => ({ name: e.name, muscleGroup: e.muscleGroup, isCustom: false })),
    ...customExercises.map(e => ({ name: e.name, muscleGroup: e.muscle_group, isCustom: true })),
  ];

  const filteredExercises = allExercises.filter(e => {
    const matchSearch = !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
    return matchSearch && matchMuscle;
  });

  // Build details string from exercises
  const buildDetails = (exercises: ExerciseEntry[], extraDetails: string) => {
    const lines = exercises.map(ex => {
      let line = `${ex.name} ${ex.sets}x${ex.reps}`;
      if (ex.weight) line += ` ${ex.weight}kg`;
      return line;
    });
    if (extraDetails.trim()) lines.push(extraDetails.trim());
    return lines.join("; ");
  };

  const addExerciseToTarget = (name: string) => {
    if (!pickerTarget) return;
    const entry: ExerciseEntry = { name, sets: 3, reps: "10", weight: "" };

    if (pickerTarget.isNew) {
      setNewDay(prev => ({ ...prev, exercises: [...prev.exercises, entry] }));
    } else {
      setWeeks(prev => prev.map((w, wi) => {
        if (wi !== pickerTarget.weekIdx) return w;
        return {
          ...w,
          days: w.days.map((d, di) => di !== pickerTarget.dayIdx ? d : { ...d, exercises: [...d.exercises, entry] }),
        };
      }));
    }
    setPickerTarget(null);
    setExerciseSearch("");
    setSelectedMuscle(null);
  };

  const updateExercise = (weekIdx: number, dayIdx: number, exIdx: number, field: keyof ExerciseEntry, value: string | number) => {
    setWeeks(prev => prev.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d;
          return {
            ...d,
            exercises: d.exercises.map((ex, ei) => ei !== exIdx ? ex : { ...ex, [field]: value }),
          };
        }),
      };
    }));
  };

  const removeExercise = (weekIdx: number, dayIdx: number, exIdx: number) => {
    setWeeks(prev => prev.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d;
          return { ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) };
        }),
      };
    }));
  };

  const updateNewDayExercise = (exIdx: number, field: keyof ExerciseEntry, value: string | number) => {
    setNewDay(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => i !== exIdx ? ex : { ...ex, [field]: value }),
    }));
  };

  const removeNewDayExercise = (exIdx: number) => {
    setNewDay(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== exIdx) }));
  };

  // --- Core week/day operations (unchanged logic) ---
  const addWeek = () => {
    const next = weeks.length > 0 ? Math.max(...weeks.map(w => w.weekNumber)) + 1 : 1;
    setWeeks(prev => [...prev, { weekNumber: next, days: [], collapsed: false }]);
  };

  const copyWeek = (sourceIdx: number) => {
    const source = weeks[sourceIdx];
    const next = weeks.length > 0 ? Math.max(...weeks.map(w => w.weekNumber)) + 1 : 1;
    setWeeks(prev => [...prev, {
      weekNumber: next,
      days: source.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e })) })),
      collapsed: false,
    }]);
  };

  const deleteWeek = (idx: number) => {
    if (weeks.length <= 1) return;
    setWeeks(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleCollapse = (idx: number) => {
    setWeeks(prev => prev.map((w, i) => i === idx ? { ...w, collapsed: !w.collapsed } : w));
  };

  const addDayToWeek = (weekIdx: number) => {
    if (!newDay.session_name.trim() && newDay.exercises.length === 0) return;
    const finalDetails = buildDetails(newDay.exercises, newDay.details);
    setWeeks(prev => prev.map((w, i) => {
      if (i !== weekIdx) return w;
      return { ...w, days: [...w.days, { ...newDay, details: finalDetails }] };
    }));
    setNewDay({ day: "Mån", session_name: "", details: "", tempo: "", exercises: [] });
    setShowAddDay(null);
  };

  const updateDay = (weekIdx: number, dayIdx: number, field: keyof BuilderDay, value: string) => {
    setWeeks(prev => prev.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => di === dayIdx ? { ...d, [field]: value } : d),
      };
    }));
  };

  const deleteDay = (weekIdx: number, dayIdx: number) => {
    setWeeks(prev => prev.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return { ...w, days: w.days.filter((_, di) => di !== dayIdx) };
    }));
  };

  const availableDays = (weekIdx: number) => {
    const used = weeks[weekIdx].days.map(d => d.day);
    return DAYS.filter(d => !used.includes(d));
  };

  const totalDays = weeks.reduce((sum, w) => sum + w.days.length, 0);

  const handleSave = async () => {
    if (totalDays === 0) return;
    setSaving(true);

    // Rebuild details from exercises for each day before saving
    const allRows: { user_id: string; week: number; day: string; session_name: string; details: string; tempo: string }[] = [];

    for (const w of weeks) {
      const usedDays = new Set<string>();
      for (const d of w.days) {
        const details = d.exercises.length > 0 ? buildDetails(d.exercises, d.details) : d.details;
        allRows.push({ user_id: userId, week: w.weekNumber, day: d.day, session_name: d.session_name, details, tempo: d.tempo });
        usedDays.add(d.day);
      }
      // Fill rest days
      for (const day of DAYS) {
        if (!usedDays.has(day)) {
          allRows.push({ user_id: userId, week: w.weekNumber, day, session_name: "Vila", details: "", tempo: "" });
        }
      }
    }

    for (let i = 0; i < allRows.length; i += 50) {
      await supabase.from("workout_plans").insert(allRows.slice(i, i + 50));
    }

    // Mark user as calibrated since they set a start date in the builder
    await supabase.from("profiles").update({ plan_start_calibrated: true }).eq("user_id", userId);

    setSaving(false);
    onDone();
  };

  // --- Exercise list renderer ---
  const renderExerciseList = (exercises: ExerciseEntry[], weekIdx: number, dayIdx: number, isNew: boolean) => (
    <div className="space-y-1.5">
      {exercises.map((ex, exIdx) => (
        <div key={exIdx} className="flex items-center gap-1.5 bg-secondary rounded-md p-2">
          <Dumbbell className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-xs font-medium flex-1 min-w-0 truncate">{ex.name}</span>
          <input
            type="number"
            value={ex.sets}
            onChange={e => isNew ? updateNewDayExercise(exIdx, "sets", parseInt(e.target.value) || 1) : updateExercise(weekIdx, dayIdx, exIdx, "sets", parseInt(e.target.value) || 1)}
            className="w-10 bg-background text-foreground text-xs p-1 rounded text-center border border-border"
            min={1}
            title="Set"
          />
          <span className="text-xs text-muted-foreground">×</span>
          <input
            type="text"
            value={ex.reps}
            onChange={e => isNew ? updateNewDayExercise(exIdx, "reps", e.target.value) : updateExercise(weekIdx, dayIdx, exIdx, "reps", e.target.value)}
            className="w-12 bg-background text-foreground text-xs p-1 rounded text-center border border-border"
            placeholder="reps"
            title="Reps"
          />
          <input
            type="text"
            value={ex.weight}
            onChange={e => isNew ? updateNewDayExercise(exIdx, "weight", e.target.value) : updateExercise(weekIdx, dayIdx, exIdx, "weight", e.target.value)}
            className="w-14 bg-background text-foreground text-xs p-1 rounded text-center border border-border"
            placeholder="kg"
            title="Vikt (kg)"
          />
          <button
            onClick={() => isNew ? removeNewDayExercise(exIdx) : removeExercise(weekIdx, dayIdx, exIdx)}
            className="p-0.5 text-muted-foreground hover:text-destructive flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => setPickerTarget({ weekIdx, dayIdx, isNew })}
        className="w-full py-1.5 border border-dashed border-primary/40 rounded-md text-xs text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
      >
        <Search className="w-3 h-3" /> Lägg till övning
      </button>
    </div>
  );

  // --- Exercise picker modal ---
  const renderExercisePicker = () => {
    if (!pickerTarget) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={() => { setPickerTarget(null); setExerciseSearch(""); setSelectedMuscle(null); }} />
        <div className="relative bg-card border border-border rounded-t-xl sm:rounded-xl w-full max-w-md max-h-[80vh] flex flex-col animate-fade-in">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-sm">Välj övning</h3>
            <button onClick={() => { setPickerTarget(null); setExerciseSearch(""); setSelectedMuscle(null); }} className="text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={exerciseSearch}
                onChange={e => setExerciseSearch(e.target.value)}
                placeholder="Sök övning..."
                className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedMuscle(null)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${!selectedMuscle ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                Alla
              </button>
              {muscleGroups.map(mg => (
                <button
                  key={mg}
                  onClick={() => setSelectedMuscle(mg === selectedMuscle ? null : mg)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${selectedMuscle === mg ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  {mg}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {filteredExercises.map((e, i) => (
              <button
                key={`${e.name}-${i}`}
                onClick={() => addExerciseToTarget(e.name)}
                className="w-full flex items-center justify-between p-2.5 bg-secondary hover:bg-muted rounded-md text-sm transition-colors text-left"
              >
                <span>{e.name}</span>
                <span className="text-xs text-muted-foreground">{e.muscleGroup}</span>
              </button>
            ))}
            {filteredExercises.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Inga övningar hittades</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {renderExercisePicker()}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-black tracking-tight">Bygg eget schema</h2>
          <p className="text-xs text-muted-foreground">
            {weeks.length} {weeks.length === 1 ? "vecka" : "veckor"} · {totalDays} pass
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || totalDays === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Save className="w-4 h-4" />
          {saving ? "Sparar..." : "Spara"}
        </button>
      </div>

      {/* Weeks */}
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="bg-card border border-border rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between p-3 bg-secondary/50 cursor-pointer"
            onClick={() => toggleCollapse(weekIdx)}
          >
            <div className="flex items-center gap-2">
              {week.collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
              <span className="font-bold text-sm">Vecka {week.weekNumber}</span>
              <span className="text-xs text-muted-foreground">{week.days.length} pass</span>
            </div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={() => copyWeek(weekIdx)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Kopiera vecka">
                <Copy className="w-4 h-4" />
              </button>
              {weeks.length > 1 && (
                <button onClick={() => deleteWeek(weekIdx)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Ta bort vecka">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {!week.collapsed && (
            <div className="p-3 space-y-2">
              {week.days
                .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
                .map((day, dayIdx) => {
                  const realDayIdx = week.days.indexOf(day);
                  const isEditing = editingDay?.weekIdx === weekIdx && editingDay?.dayIdx === realDayIdx;

                  return (
                    <div key={`${day.day}-${dayIdx}`} className="bg-secondary/30 border border-border/50 rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground uppercase">{day.day}</span>
                        <div className="flex gap-1.5">
                          {isEditing ? (
                            <button onClick={() => setEditingDay(null)} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground font-medium">Klar</button>
                          ) : (
                            <button onClick={() => setEditingDay({ weekIdx, dayIdx: realDayIdx })} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Redigera</button>
                          )}
                          <button onClick={() => deleteDay(weekIdx, realDayIdx)} className="text-xs text-destructive hover:text-destructive/80">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={day.session_name}
                            onChange={e => updateDay(weekIdx, realDayIdx, "session_name", e.target.value)}
                            placeholder="Passnamn (t.ex. Styrka överkropp)"
                            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          />
                          {renderExerciseList(day.exercises, weekIdx, realDayIdx, false)}
                          <textarea
                            value={day.details}
                            onChange={e => updateDay(weekIdx, realDayIdx, "details", e.target.value)}
                            placeholder="Övrig info (valfritt)"
                            rows={2}
                            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
                          />
                          <input
                            type="text"
                            value={day.tempo}
                            onChange={e => updateDay(weekIdx, realDayIdx, "tempo", e.target.value)}
                            placeholder="Tempo/RPE (valfritt)"
                            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-sm">{day.session_name || <span className="text-muted-foreground italic">Inget namn</span>}</p>
                          {day.exercises.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {day.exercises.map((ex, i) => (
                                <p key={i} className="text-xs text-muted-foreground">
                                  {ex.name} {ex.sets}×{ex.reps}{ex.weight ? ` ${ex.weight}kg` : ""}
                                </p>
                              ))}
                            </div>
                          )}
                          {day.details && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{day.details}</p>}
                          {day.tempo && <p className="text-xs text-muted-foreground font-mono mt-1">{day.tempo}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Add day form */}
              {showAddDay === weekIdx ? (
                <div className="border border-primary/30 rounded-md p-3 space-y-2 animate-fade-in">
                  <select
                    value={newDay.day}
                    onChange={e => setNewDay(prev => ({ ...prev, day: e.target.value }))}
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none"
                  >
                    {availableDays(weekIdx).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newDay.session_name}
                    onChange={e => setNewDay(prev => ({ ...prev, session_name: e.target.value }))}
                    placeholder="Passnamn"
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                  {renderExerciseList(newDay.exercises, -1, -1, true)}
                  <textarea
                    value={newDay.details}
                    onChange={e => setNewDay(prev => ({ ...prev, details: e.target.value }))}
                    placeholder="Övrig info (valfritt)"
                    rows={2}
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
                  />
                  <input
                    type="text"
                    value={newDay.tempo}
                    onChange={e => setNewDay(prev => ({ ...prev, tempo: e.target.value }))}
                    placeholder="Tempo/RPE (valfritt)"
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => addDayToWeek(weekIdx)}
                      disabled={!newDay.session_name.trim() && newDay.exercises.length === 0}
                      className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-40"
                    >
                      Lägg till
                    </button>
                    <button
                      onClick={() => { setShowAddDay(null); setNewDay({ day: "Mån", session_name: "", details: "", tempo: "", exercises: [] }); }}
                      className="px-4 py-2 bg-secondary text-muted-foreground rounded-md text-sm"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                availableDays(weekIdx).length > 0 && (
                  <button
                    onClick={() => {
                      const avail = availableDays(weekIdx);
                      setNewDay({ day: avail[0] || "Mån", session_name: "", details: "", tempo: "", exercises: [] });
                      setShowAddDay(weekIdx);
                    }}
                    className="w-full py-2.5 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Lägg till pass
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add week */}
      <button
        onClick={addWeek}
        className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Lägg till vecka
      </button>

      {/* Copy week shortcut */}
      {weeks.length > 0 && (
        <div className="bg-secondary/30 border border-border rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">⚡ Snabbkopiera vecka</p>
          <div className="flex flex-wrap gap-2">
            {weeks.map((w, idx) => (
              <button
                key={idx}
                onClick={() => copyWeek(idx)}
                disabled={w.days.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <Copy className="w-3 h-3" /> V{w.weekNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom save */}
      {totalDays > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? "Sparar schema..." : `Spara schema (${totalDays} pass)`}
        </button>
      )}
    </div>
  );
};

export default SchemaBuilder;
