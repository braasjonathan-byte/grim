import { useState, useEffect, useRef } from "react";
import { Search, X, Plus, Dumbbell, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary, muscleGroups } from "@/data/exerciseLibrary";
import { cn } from "@/lib/utils";

interface CustomExercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
  is_bodyweight_exercise?: boolean;
  is_time_based?: boolean;
}

interface ExercisePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseName: string) => void;
  title?: string;
  /** Pre-filter to a specific muscle group */
  initialMuscleGroup?: string | null;
  /** Show last-used weight next to exercise */
  getLastWeight?: (name: string) => string | null;
  /** Show info button */
  onExerciseInfo?: (name: string) => void;
  /** Allow creating custom exercises */
  allowCreate?: boolean;
  /** User id for creating custom exercises */
  userId?: string;
}

const ExercisePickerDialog = ({
  open,
  onClose,
  onSelect,
  title = "Välj övning",
  initialMuscleGroup = null,
  getLastWeight,
  onExerciseInfo,
  allowCreate = false,
  userId,
}: ExercisePickerDialogProps) => {
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(initialMuscleGroup);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("styrka");
  const [newMuscle, setNewMuscle] = useState("Helkropp");
  const [newIsBodyweight, setNewIsBodyweight] = useState(false);
  const [newIsTimeBased, setNewIsTimeBased] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedMuscle(initialMuscleGroup);
      setShowCreate(false);
      setNewName("");
      supabase.from("custom_exercises").select("*").order("name").then(({ data }) => {
        if (data) setCustomExercises(data);
      });
      // Focus search after animation
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, initialMuscleGroup]);

  // Handle keyboard on mobile — keep content visible
  useEffect(() => {
    if (!open) return;
    const handleResize = () => {
      if (contentRef.current) {
        const vh = window.visualViewport?.height || window.innerHeight;
        contentRef.current.style.maxHeight = `${vh - 24}px`;
      }
    };
    handleResize();
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, [open]);

  if (!open) return null;

  // Deduplicate: custom exercises override library entries (e.g. muscle group edits by admin)
  const allExercises = (() => {
    const nameMap = new Map<string, { name: string; muscleGroup: string; category: string; isCustom: boolean }>();
    for (const e of exerciseLibrary) {
      nameMap.set(e.name.toLowerCase(), { name: e.name, muscleGroup: e.muscleGroup, category: e.category, isCustom: false });
    }
    for (const e of customExercises) {
      const key = e.name.toLowerCase();
      if (nameMap.has(key)) {
        // Override muscle group from custom/admin edit
        const existing = nameMap.get(key)!;
        nameMap.set(key, { ...existing, muscleGroup: e.muscle_group, isCustom: false });
      } else {
        nameMap.set(key, { name: e.name, muscleGroup: e.muscle_group, category: e.category, isCustom: true });
      }
    }
    return Array.from(nameMap.values()).sort((a, b) => a.name.localeCompare(b.name, "sv"));
  })();

  const filtered = allExercises.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
    return matchSearch && matchMuscle;
  });

  const handleSelect = (name: string) => {
    onSelect(name);
    onClose();
  };

  const handleCreateExercise = async () => {
    if (!newName.trim() || !userId) return;
    const trimmed = newName.trim();
    const builtInDupe = exerciseLibrary.find(e => e.name.toLowerCase() === trimmed.toLowerCase());
    if (builtInDupe) { alert("Övningen finns redan i biblioteket."); return; }
    const customDupe = customExercises.find(e => e.name.toLowerCase() === trimmed.toLowerCase());
    if (customDupe) { alert("Övningen finns redan."); return; }
    await supabase.from("custom_exercises").insert({ name: trimmed, category: newCategory, muscle_group: newMuscle, created_by: userId, is_bodyweight_exercise: newIsBodyweight, is_time_based: newIsTimeBased } as any);
    const { data } = await supabase.from("custom_exercises").select("*").order("name");
    if (data) setCustomExercises(data);
    setNewName("");
    setShowCreate(false);
    // Auto-select the newly created exercise
    handleSelect(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div
        ref={contentRef}
        className="relative w-full max-w-md bg-background border border-border rounded-b-none flex flex-col animate-fade-in overflow-hidden shadow-lg"
        style={{ maxHeight: "100vh", height: "100%" }}
      >
        {/* Handle bar on mobile */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Sök övning..."
              className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2.5 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground transition-shadow"
            />
          </div>
        </div>

        {/* Muscle group filters */}
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedMuscle(null)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors",
              !selectedMuscle
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            Alla
          </button>
          {muscleGroups.map(mg => (
            <button
              key={mg}
              onClick={() => setSelectedMuscle(mg === selectedMuscle ? null : mg)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors",
                selectedMuscle === mg
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {mg}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div
          className="flex-1 overflow-y-auto px-4 pb-2 min-h-0"
          onTouchMove={() => {
            if (document.activeElement === inputRef.current) {
              inputRef.current?.blur();
            }
          }}
        >
          <div className="space-y-1">
            {filtered.map((e, i) => {
              const lastW = getLastWeight?.(e.name);
              return (
                <button
                  key={`${e.name}-${i}`}
                  onClick={() => handleSelect(e.name)}
                  className="w-full flex items-center justify-between p-2.5 bg-secondary/60 hover:bg-primary/10 rounded-xl text-sm transition-colors text-left group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-shrink-1 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0 group-hover:bg-primary transition-colors" />
                    <span className="truncate font-medium">{e.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-1" style={{ maxWidth: "45%" }}>
                    {onExerciseInfo && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); onExerciseInfo(e.name); }}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                        title="Info"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {lastW && (
                      <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                        {lastW}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{e.muscleGroup}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-8">
                <Dumbbell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Inga övningar hittades</p>
              </div>
            )}
          </div>
        </div>

        {/* Create custom exercise */}
        {allowCreate && userId && (
          <div className="flex-shrink-0 border-t border-border px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            {showCreate ? (
              <div className="space-y-2 animate-fade-in">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newName.trim() && handleCreateExercise()}
                  placeholder="Namn på övning..."
                  className="w-full bg-secondary text-foreground text-sm px-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                  autoFocus
                />
                <div className="flex gap-2">
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="flex-1 bg-secondary text-foreground text-xs p-2 rounded-lg border-none outline-none"
                  >
                    <option value="styrka">Styrka</option>
                    <option value="kondition">Kondition</option>
                    <option value="rörlighet">Rörlighet</option>
                    <option value="core">Core</option>
                  </select>
                  <select
                    value={newMuscle}
                    onChange={e => setNewMuscle(e.target.value)}
                    className="flex-1 bg-secondary text-foreground text-xs p-2 rounded-lg border-none outline-none"
                  >
                    {muscleGroups.map(mg => <option key={mg} value={mg}>{mg}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsBodyweight}
                    onChange={e => setNewIsBodyweight(e.target.checked)}
                    className="rounded border-border accent-primary w-4 h-4"
                  />
                  <span className="text-xs text-muted-foreground">Kroppsviktsövning (+/− vikt)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsTimeBased}
                    onChange={e => setNewIsTimeBased(e.target.checked)}
                    className="rounded border-border accent-primary w-4 h-4"
                  />
                  <span className="text-xs text-muted-foreground">Tidsbaserad (sekunder istället för reps)</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateExercise}
                    disabled={!newName.trim()}
                    className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs disabled:opacity-40 transition-opacity"
                  >
                    Spara
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 bg-secondary text-muted-foreground rounded-lg text-xs hover:text-foreground transition-colors"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full py-2.5 border border-dashed border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Lägg till egen övning
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExercisePickerDialog;
