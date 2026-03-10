import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Plus, Dumbbell } from "lucide-react";
import ExercisePickerDialog from "@/components/ExercisePickerDialog";

interface ReplacementWorkoutDialogProps {
  userId: string;
  planId: string;
  sessionName: string;
  week: number;
  day: string;
  onClose: () => void;
  onReplaced: () => void;
  onSkipOnly: () => void;
}

const ReplacementWorkoutDialog = ({
  userId,
  planId,
  sessionName,
  week,
  day,
  onClose,
  onReplaced,
  onSkipOnly,
}: ReplacementWorkoutDialogProps) => {
  const [newName, setNewName] = useState("");
  const [exercises, setExercises] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [customExercise, setCustomExercise] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredExercises = exerciseLibrary.filter((e) => {
    const matchesSearch = !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  const addExercise = (name: string) => {
    setExercises((prev) => [...prev, name]);
    setShowPicker(false);
    setSearchTerm("");
    setCustomExercise("");
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReplace = async () => {
    if (exercises.length === 0) return;
    setSaving(true);

    // Update the workout plan entry with the replacement
    await supabase
      .from("workout_plans")
      .update({
        session_name: newName.trim() || `Ersättning: ${sessionName}`,
        details: exercises.join("\n"),
      })
      .eq("id", planId);

    // Preserve existing logged data to prevent data loss
    const { data: existing } = await supabase
      .from("workout_completions")
      .select("logged_weights, logged_tempo, logged_pulse, logged_distance_km")
      .eq("user_id", userId)
      .eq("week", week)
      .eq("day", day)
      .maybeSingle();

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: true,
        skipped: false,
        user_comment: `Ersatte: ${sessionName}`,
        logged_weights: existing?.logged_weights ?? null,
        logged_tempo: existing?.logged_tempo ?? null,
        logged_pulse: existing?.logged_pulse ?? null,
        logged_distance_km: existing?.logged_distance_km ?? null,
      } as any,
      { onConflict: "user_id,week,day" }
    );

    setSaving(false);
    onReplaced();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-fade-in max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Missat pass</h3>
            <p className="text-xs text-muted-foreground">{sessionName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Vill du skapa ett anpassat ersättningspass istället? Det skriver över det schemalagda passet.
        </p>

        {/* Replacement name */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">Passnamn (valfritt)</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Ersättning: ${sessionName}`}
            className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* Added exercises */}
        {exercises.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground block">Övningar</label>
            {exercises.map((ex, i) => (
              <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-sm flex-1">{ex}</span>
                <button onClick={() => removeExercise(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add exercise */}
        {!showPicker ? (
          <button
            onClick={() => setShowPicker(true)}
            className="w-full py-2.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Lägg till övning
          </button>
        ) : (
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold">Välj övning</h4>
              <button onClick={() => setShowPicker(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Custom exercise input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customExercise}
                onChange={(e) => setCustomExercise(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && customExercise.trim() && addExercise(customExercise.trim())}
                placeholder="Skriv egen övning..."
                className="flex-1 bg-background text-foreground text-xs px-3 py-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
              {customExercise.trim() && (
                <button
                  onClick={() => addExercise(customExercise.trim())}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium"
                >
                  Lägg till
                </button>
              )}
            </div>

            {/* Search from library */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök i övningsbiblioteket..."
                className="w-full bg-background text-foreground text-xs pl-8 pr-3 py-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedMuscle(null)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${!selectedMuscle ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                Alla
              </button>
              {muscleGroups.map((mg) => (
                <button
                  key={mg}
                  onClick={() => setSelectedMuscle(mg === selectedMuscle ? null : mg)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${selectedMuscle === mg ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                >
                  {mg}
                </button>
              ))}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {filteredExercises.map((e, i) => (
                <button
                  key={`${e.name}-${i}`}
                  onClick={() => addExercise(e.name)}
                  className="w-full text-left flex items-center justify-between p-1.5 bg-background rounded text-xs hover:bg-primary/10 transition-colors"
                >
                  <span>{e.name}</span>
                  <span className="text-[10px] text-muted-foreground">{e.muscleGroup}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onSkipOnly}
            className="flex-1 py-3 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
          >
            Bara hoppa över
          </button>
          <button
            onClick={handleReplace}
            disabled={exercises.length === 0 || saving}
            className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-1.5"
          >
            <Dumbbell className="w-4 h-4" /> Ersätt pass
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplacementWorkoutDialog;
