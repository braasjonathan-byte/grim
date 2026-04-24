import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link2, Trash2, Loader2, ChevronDown, Check, FileText, Image, X, Pencil, Save, Eye, BookOpen, AlertCircle } from "lucide-react";
import { exerciseLibrary, muscleGroups, submusclesByGroup } from "@/data/exerciseLibrary";
import { toast } from "sonner";

interface SecondaryMuscle { muscle: string; submuscles: string[]; }

interface MuscleOverride {
  id: string;
  exercise_name: string;
  muscle_group: string | null;
  submuscles: string[];
  secondary_muscles: SecondaryMuscle[];
}

interface Mapping {
  id: string;
  exercise_name: string;
  exercisedb_name: string;
  gif_url: string | null;
  custom_instructions: string[] | null;
  created_at: string;
}

interface ExerciseDBResult {
  name: string;
  gifUrl: string | null;
  targetMuscles: string[];
  equipments: string[];
  instructions: string[];
}

interface CustomExercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
  is_bodyweight_exercise?: boolean;
  submuscles?: string[];
  secondary_muscles?: SecondaryMuscle[];
}

const ExerciseGifManager = () => {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [overrides, setOverrides] = useState<MuscleOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);
  const [showOnlyMissingSubmuscle, setShowOnlyMissingSubmuscle] = useState(false);
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<string | null>(null);

  // Linking state
  const [linkingExercise, setLinkingExercise] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExerciseDBResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Preview / expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewGif, setPreviewGif] = useState<string | null>(null);

  // Instruction editing
  const [editingInstructionsFor, setEditingInstructionsFor] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [loadingInstructions, setLoadingInstructions] = useState(false);

  // Name editing
  const [editingNameFor, setEditingNameFor] = useState<string | null>(null);
  const [editSwedishName, setEditSwedishName] = useState("");
  const [editEnglishName, setEditEnglishName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Muscle group editing
  const [editingMuscleFor, setEditingMuscleFor] = useState<string | null>(null);
  const [editMuscleGroup, setEditMuscleGroup] = useState("");
  const [savingMuscle, setSavingMuscle] = useState(false);

  // Multi-select for mass editing
  const [selectMode, setSelectMode] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [savingBulk, setSavingBulk] = useState(false);

  // Submuscle / secondary editing
  const [editingMusclesFor, setEditingMusclesFor] = useState<string | null>(null);
  const [editPrimaryGroup, setEditPrimaryGroup] = useState<string>("");
  const [editSubmuscles, setEditSubmuscles] = useState<string[]>([]);
  const [editSecondary, setEditSecondary] = useState<SecondaryMuscle[]>([]);
  const [savingMuscles, setSavingMuscles] = useState(false);

  // Bulk muscles dialog
  const [showBulkMuscle, setShowBulkMuscle] = useState(false);
  const [bulkPrimaryGroup, setBulkPrimaryGroup] = useState<string>("");
  const [bulkSubmuscles, setBulkSubmuscles] = useState<string[]>([]);
  const [bulkSecondary, setBulkSecondary] = useState<SecondaryMuscle[]>([]);

  const fetchMappings = async () => {
    const { data } = await supabase
      .from("exercise_gif_mappings")
      .select("id, exercise_name, exercisedb_name, gif_url, custom_instructions, created_at")
      .order("exercise_name");
    setMappings((data as Mapping[]) || []);
  };

  const fetchCustomExercises = async () => {
    const { data } = await supabase
      .from("custom_exercises")
      .select("id, name, category, muscle_group, is_bodyweight_exercise, submuscles, secondary_muscles")
      .order("name");
    setCustomExercises((data as any) || []);
  };

  const fetchOverrides = async () => {
    const { data } = await supabase
      .from("exercise_muscle_overrides" as any)
      .select("id, exercise_name, muscle_group, submuscles, secondary_muscles");
    setOverrides((data as any) || []);
  };

  useEffect(() => {
    if (open) {
      Promise.all([fetchMappings(), fetchCustomExercises(), fetchOverrides()]).then(() => setLoading(false));
    }
  }, [open]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-exercisedb", {
        body: { query: searchQuery.trim() },
      });
      if (!error && data?.results) {
        setSearchResults(data.results);
      }
    } catch {
      // ignore
    }
    setSearching(false);
  };

  const handleLink = async (result: ExerciseDBResult) => {
    if (!linkingExercise) return;
    setSaving(true);

    const { data: existing } = await supabase
      .from("exercise_gif_mappings")
      .select("id")
      .ilike("exercise_name", linkingExercise)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("exercise_gif_mappings")
        .update({ exercisedb_name: result.name, gif_url: result.gifUrl })
        .eq("id", existing.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("exercise_gif_mappings").insert({
        exercise_name: linkingExercise,
        exercise_name_lower: linkingExercise.toLowerCase(),
        exercisedb_name: result.name,
        gif_url: result.gifUrl,
        created_by: user!.id,
      });
    }

    await fetchMappings();
    setLinkingExercise(null);
    setSearchQuery("");
    setSearchResults([]);
    setPreviewGif(null);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("exercise_gif_mappings").delete().eq("id", id);
    setMappings((prev) => prev.filter((m) => m.id !== id));
  };

  const startEditingInstructions = async (exerciseName: string, existingCustom: string[] | null) => {
    setEditingInstructionsFor(exerciseName);
    if (existingCustom && existingCustom.length > 0) {
      setEditText(existingCustom.join("\n"));
      return;
    }
    // Fetch current instructions from the API so admin sees what users see
    setLoadingInstructions(true);
    try {
      const { data: result } = await supabase.functions.invoke("exercise-gif", {
        body: { exerciseName },
      });
      if (result?.instructions && result.instructions.length > 0) {
        setEditText(result.instructions.map((inst: string) => inst.replace(/^(Step|Steg)\s*:?\s*\d+\s*:?\s*/i, "")).join("\n"));
      } else {
        setEditText("");
      }
    } catch {
      setEditText("");
    }
    setLoadingInstructions(false);
  };

  const saveInstructions = async (exerciseName: string) => {
    setSavingInstructions(true);
    const instructions = editText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    try {
      await supabase.functions.invoke("exercise-gif", {
        body: { exerciseName, action: "save_instructions", instructions },
      });
      await fetchMappings();
      setEditingInstructionsFor(null);
      toast.success("Instruktioner sparade");
    } catch (e) {
      console.error("Failed to save instructions:", e);
      toast.error("Kunde inte spara instruktioner");
    }
    setSavingInstructions(false);
  };

  const saveNames = async (mappingId: string) => {
    if (!editSwedishName.trim() || !editEnglishName.trim()) return;
    setSavingName(true);
    try {
      await supabase
        .from("exercise_gif_mappings")
        .update({
          exercise_name: editSwedishName.trim(),
          exercise_name_lower: editSwedishName.trim().toLowerCase(),
          exercisedb_name: editEnglishName.trim(),
        })
        .eq("id", mappingId);
      await fetchMappings();
      setEditingNameFor(null);
      toast.success("Namn uppdaterat");
    } catch (e) {
      console.error("Failed to save names:", e);
    }
    setSavingName(false);
  };

  const saveMuscleGroup = async (exerciseName: string, newMuscle: string) => {
    setSavingMuscle(true);
    try {
      const custom = customExercises.find(c => c.name.toLowerCase() === exerciseName.toLowerCase());

      if (custom) {
        const { data: updatedRows, error: updateError } = await supabase
          .from("custom_exercises")
          .update({ muscle_group: newMuscle })
          .eq("id", custom.id)
          .select("id, muscle_group");

        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error("Ingen övning uppdaterades");
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const libEntry = exerciseLibrary.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
        const { error: insertError } = await supabase.from("custom_exercises").insert({
          name: exerciseName,
          category: libEntry?.category || "styrka",
          muscle_group: newMuscle,
          created_by: user!.id,
        });

        if (insertError) {
          const { data: existing, error: existingError } = await supabase
            .from("custom_exercises")
            .select("id")
            .ilike("name", exerciseName)
            .maybeSingle();

          if (existingError) throw existingError;
          if (!existing) throw insertError;

          const { data: updatedRows, error: fallbackUpdateError } = await supabase
            .from("custom_exercises")
            .update({ muscle_group: newMuscle })
            .eq("id", existing.id)
            .select("id, muscle_group");

          if (fallbackUpdateError) throw fallbackUpdateError;
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error("Ingen övning uppdaterades vid fallback");
          }
        }
      }

      await fetchCustomExercises();
      setEditingMuscleFor(null);
      toast.success("Muskelgrupp uppdaterad");
    } catch (e) {
      console.error("Failed to save muscle group:", e);
      toast.error("Kunde inte spara muskelgrupp");
    }
    setSavingMuscle(false);
  };

  // Build override lookup map
  const overridesByName = useMemo(() => {
    const m = new Map<string, MuscleOverride>();
    for (const o of overrides) m.set(o.exercise_name.toLowerCase(), o);
    return m;
  }, [overrides]);

  // All exercises: library + custom + overrides, deduplicated, sorted alphabetically
  const allExercises = useMemo(() => {
    const nameSet = new Map<string, {
      name: string;
      category: string;
      muscleGroup: string;
      submuscles: string[];
      secondaryMuscles: SecondaryMuscle[];
      isBodyweight: boolean;
    }>();

    for (const e of exerciseLibrary) {
      nameSet.set(e.name.toLowerCase(), {
        name: e.name, category: e.category, muscleGroup: e.muscleGroup,
        submuscles: [], secondaryMuscles: [], isBodyweight: false,
      });
    }

    for (const c of customExercises) {
      const key = c.name.toLowerCase();
      const existing = nameSet.get(key);
      nameSet.set(key, {
        name: existing?.name ?? c.name,
        category: c.category,
        muscleGroup: c.muscle_group,
        submuscles: c.submuscles ?? [],
        secondaryMuscles: c.secondary_muscles ?? [],
        isBodyweight: !!c.is_bodyweight_exercise,
      });
    }

    // Apply admin overrides last (overrides custom + lib)
    for (const o of overrides) {
      const key = o.exercise_name.toLowerCase();
      const existing = nameSet.get(key);
      if (!existing) continue;
      nameSet.set(key, {
        ...existing,
        muscleGroup: o.muscle_group ?? existing.muscleGroup,
        submuscles: o.submuscles ?? existing.submuscles,
        secondaryMuscles: o.secondary_muscles ?? existing.secondaryMuscles,
      });
    }

    // Hide duplicates: any entry whose name contains set/rep notation
    // (e.g. "Axelpress 2×10", "Bänkpress 3x10 @ RPE 7") is treated as a
    // dupe and hidden from the admin library entirely.
    const setRepRe = /\s+\d+\s*[x×*]\s*\d+/i;
    return Array.from(nameSet.values())
      .filter(e => !setRepRe.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));
  }, [customExercises, overrides]);

  const toggleSelected = (name: string) => {
    setSelectedExercises(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const bulkSetBodyweight = async (isBodyweight: boolean) => {
    if (selectedExercises.size === 0) return;
    setSavingBulk(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      for (const name of selectedExercises) {
        const custom = customExercises.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (custom) {
          await supabase.from("custom_exercises").update({ is_bodyweight_exercise: isBodyweight }).eq("id", custom.id);
        } else {
          const libEntry = exerciseLibrary.find(e => e.name.toLowerCase() === name.toLowerCase());
          await supabase.from("custom_exercises").insert({
            name,
            category: libEntry?.category || "styrka",
            muscle_group: libEntry?.muscleGroup || "Helkropp",
            created_by: user.id,
            is_bodyweight_exercise: isBodyweight,
          });
        }
      }
      await fetchCustomExercises();
      setSelectedExercises(new Set());
      toast.success(`${selectedExercises.size} övningar uppdaterade`);
    } catch (e) {
      console.error("Bulk update failed:", e);
      toast.error("Kunde inte uppdatera");
    }
    setSavingBulk(false);
  };

  const bulkSetCategory = async (category: string) => {
    if (selectedExercises.size === 0) return;
    setSavingBulk(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      for (const name of selectedExercises) {
        const custom = customExercises.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (custom) {
          await supabase.from("custom_exercises").update({ category }).eq("id", custom.id);
        } else {
          const libEntry = exerciseLibrary.find(e => e.name.toLowerCase() === name.toLowerCase());
          await supabase.from("custom_exercises").insert({
            name,
            category,
            muscle_group: libEntry?.muscleGroup || "Helkropp",
            created_by: user.id,
          });
        }
      }
      await fetchCustomExercises();
      setSelectedExercises(new Set());
      toast.success(`${selectedExercises.size} övningar uppdaterade`);
    } catch (e) {
      console.error("Bulk category update failed:", e);
      toast.error("Kunde inte uppdatera");
    }
    setSavingBulk(false);
  };

  /** Upsert muscle override for an exercise (works for built-in & custom). */
  const upsertOverride = async (
    exerciseName: string,
    payload: { muscle_group?: string; submuscles?: string[]; secondary_muscles?: SecondaryMuscle[] }
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Try update by name; if 0 rows, insert
    const { data: updated, error: updateErr } = await supabase
      .from("exercise_muscle_overrides" as any)
      .update({ ...payload, updated_by: user.id, updated_at: new Date().toISOString() } as any)
      .ilike("exercise_name", exerciseName)
      .select("id");
    if (updateErr) throw updateErr;
    if (!updated || updated.length === 0) {
      const { error: insertErr } = await supabase
        .from("exercise_muscle_overrides" as any)
        .insert({ exercise_name: exerciseName, updated_by: user.id, ...payload } as any);
      if (insertErr) throw insertErr;
    }
  };

  const saveMuscleData = async (exerciseName: string) => {
    setSavingMuscles(true);
    try {
      await upsertOverride(exerciseName, {
        muscle_group: editPrimaryGroup,
        submuscles: editSubmuscles,
        secondary_muscles: editSecondary,
      });
      await fetchOverrides();
      // Also bump custom_exercises if it's a custom one (so picker sees it)
      const custom = customExercises.find(c => c.name.toLowerCase() === exerciseName.toLowerCase());
      if (custom) {
        await supabase.from("custom_exercises").update({
          muscle_group: editPrimaryGroup,
          submuscles: editSubmuscles,
          secondary_muscles: editSecondary as any,
        } as any).eq("id", custom.id);
        await fetchCustomExercises();
      }
      setEditingMusclesFor(null);
      toast.success("Muskel-data sparad");
    } catch (e) {
      console.error("Failed to save muscle data:", e);
      toast.error("Kunde inte spara");
    }
    setSavingMuscles(false);
  };

  const bulkSetMuscles = async () => {
    if (selectedExercises.size === 0 || !bulkPrimaryGroup) return;
    setSavingBulk(true);
    try {
      for (const name of selectedExercises) {
        await upsertOverride(name, {
          muscle_group: bulkPrimaryGroup,
          submuscles: bulkSubmuscles,
          secondary_muscles: bulkSecondary,
        });
      }
      await fetchOverrides();
      setSelectedExercises(new Set());
      setShowBulkMuscle(false);
      setBulkPrimaryGroup("");
      setBulkSubmuscles([]);
      setBulkSecondary([]);
      toast.success(`${selectedExercises.size} övningar uppdaterade`);
    } catch (e) {
      console.error("Bulk muscle update failed:", e);
      toast.error("Kunde inte uppdatera");
    }
    setSavingBulk(false);
  };

  const mappingsByName = useMemo(() => {
    const map = new Map<string, Mapping>();
    for (const m of mappings) map.set(m.exercise_name.toLowerCase(), m);
    return map;
  }, [mappings]);

  // Build unified list with filtering
  const exerciseList = useMemo(() => {
    const filterLower = filter.toLowerCase();
    return allExercises
      .map((ex) => ({
        name: ex.name,
        category: ex.category,
        muscleGroup: ex.muscleGroup,
        submuscles: ex.submuscles,
        secondaryMuscles: ex.secondaryMuscles,
        isBodyweight: ex.isBodyweight,
        mapping: mappingsByName.get(ex.name.toLowerCase()) || null,
      }))
      .filter((item) => {
        if (filterLower && !item.name.toLowerCase().includes(filterLower) && !item.mapping?.exercisedb_name.toLowerCase().includes(filterLower)) return false;
        if (showOnlyMapped && !item.mapping) return false;
        if (showOnlyUnmapped && item.mapping) return false;
        if (muscleGroupFilter && item.muscleGroup !== muscleGroupFilter) return false;
        if (showOnlyMissingSubmuscle) {
          const hasSubmusclesAvailable = (submusclesByGroup[item.muscleGroup]?.length ?? 0) > 0;
          if (!hasSubmusclesAvailable) return false; // ignore groups with no submuscle options
          if (item.submuscles && item.submuscles.length > 0) return false;
        }
        return true;
      });
  }, [allExercises, mappingsByName, filter, showOnlyMapped, showOnlyUnmapped, muscleGroupFilter, showOnlyMissingSubmuscle]);

  const missingSubmuscleCount = useMemo(() =>
    allExercises.filter(e => (submusclesByGroup[e.muscleGroup]?.length ?? 0) > 0 && (!e.submuscles || e.submuscles.length === 0)).length,
    [allExercises]
  );

  const mappedCount = allExercises.filter((e) => mappingsByName.has(e.name.toLowerCase())).length;
  const totalCount = allExercises.length;

  // Get all unique muscle groups from exercises
  const availableMuscleGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const ex of allExercises) groups.add(ex.muscleGroup);
    return Array.from(groups).sort((a, b) => a.localeCompare(b, "sv"));
  }, [allExercises]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Övningsbibliotek</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {totalCount} övningar
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          {/* Search bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Sök övningar..."
                className="w-full bg-secondary text-foreground text-sm pl-8 pr-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* GIF filter chips */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setShowOnlyMapped(false); setShowOnlyUnmapped(false); }}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                !showOnlyMapped && !showOnlyUnmapped ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              Alla ({totalCount})
            </button>
            <button
              onClick={() => { setShowOnlyMapped(true); setShowOnlyUnmapped(false); }}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                showOnlyMapped ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              ✅ GIF ({mappedCount})
            </button>
            <button
              onClick={() => { setShowOnlyMapped(false); setShowOnlyUnmapped(true); }}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                showOnlyUnmapped ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              ❌ Utan GIF ({totalCount - mappedCount})
            </button>
            <button
              onClick={() => setShowOnlyMissingSubmuscle(!showOnlyMissingSubmuscle)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1 ${
                showOnlyMissingSubmuscle ? "bg-destructive text-destructive-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              <AlertCircle className="w-3 h-3" /> Saknar undergrupp ({missingSubmuscleCount})
            </button>
          </div>

          {/* Muscle group filter */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setMuscleGroupFilter(null)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                !muscleGroupFilter ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              Alla grupper
            </button>
            {availableMuscleGroups.map((mg) => (
              <button
                key={mg}
                onClick={() => setMuscleGroupFilter(muscleGroupFilter === mg ? null : mg)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                  muscleGroupFilter === mg ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {mg}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">{exerciseList.length} övningar visas</p>
            <button
              onClick={() => { setSelectMode(!selectMode); setSelectedExercises(new Set()); }}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                selectMode ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {selectMode ? "Avbryt markering" : "Markera"}
            </button>
          </div>

          {/* Bulk action bar */}
          {selectMode && selectedExercises.size > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-2">
              <p className="text-[11px] font-semibold text-foreground">{selectedExercises.size} markerade</p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => bulkSetBodyweight(true)}
                  disabled={savingBulk}
                  className="text-[11px] px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-40 flex items-center gap-1"
                >
                  {savingBulk ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  ✅ Kroppsvikt
                </button>
                <button
                  onClick={() => bulkSetBodyweight(false)}
                  disabled={savingBulk}
                  className="text-[11px] px-2.5 py-1.5 bg-secondary text-foreground rounded-lg font-semibold disabled:opacity-40 flex items-center gap-1"
                >
                  ❌ Ej kroppsvikt
                </button>
                <select
                  onChange={(e) => { if (e.target.value) bulkSetCategory(e.target.value); e.target.value = ""; }}
                  disabled={savingBulk}
                  className="text-[11px] px-2 py-1.5 bg-secondary text-foreground rounded-lg border-none outline-none disabled:opacity-40"
                  defaultValue=""
                >
                  <option value="" disabled>Ändra kategori…</option>
                  <option value="styrka">Styrka</option>
                  <option value="kondition">Kondition</option>
                  <option value="rörlighet">Rörlighet</option>
                  <option value="core">Core</option>
                </select>
                <button
                  onClick={() => { setShowBulkMuscle(true); setBulkPrimaryGroup(""); setBulkSubmuscles([]); }}
                  disabled={savingBulk}
                  className="text-[11px] px-2.5 py-1.5 bg-accent text-accent-foreground rounded-lg font-semibold disabled:opacity-40"
                >
                  Sätt muskelgrupp…
                </button>
              </div>

              {showBulkMuscle && (
                <div className="mt-2 bg-card border border-border rounded-lg p-2 space-y-2">
                  <p className="text-[11px] font-semibold">Muskelgrupp för {selectedExercises.size} övningar</p>
                  <div className="flex flex-wrap gap-1">
                    {muscleGroups.map(mg => (
                      <button key={mg} type="button"
                        onClick={() => { setBulkPrimaryGroup(mg); setBulkSubmuscles([]); }}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${bulkPrimaryGroup === mg ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                      >{mg}</button>
                    ))}
                  </div>
                  {bulkPrimaryGroup && (submusclesByGroup[bulkPrimaryGroup]?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {submusclesByGroup[bulkPrimaryGroup].map(sm => (
                        <button key={sm} type="button"
                          onClick={() => setBulkSubmuscles(p => p.includes(sm) ? p.filter(x => x !== sm) : [...p, sm])}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${bulkSubmuscles.includes(sm) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                        >{sm}</button>
                      ))}
                    </div>
                  )}

                  {/* Secondary muscles */}
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Övriga muskler (valfritt)</p>
                    {bulkSecondary.map(sec => (
                      <div key={sec.muscle} className="bg-secondary/40 rounded-lg p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold">{sec.muscle}</span>
                          <button type="button"
                            onClick={() => setBulkSecondary(p => p.filter(s => s.muscle !== sec.muscle))}
                            className="text-[10px] text-muted-foreground hover:text-destructive">Ta bort</button>
                        </div>
                        {(submusclesByGroup[sec.muscle]?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {submusclesByGroup[sec.muscle].map(sm => (
                              <button key={sm} type="button"
                                onClick={() => setBulkSecondary(p => p.map(s => s.muscle === sec.muscle
                                  ? { ...s, submuscles: s.submuscles.includes(sm) ? s.submuscles.filter(x => x !== sm) : [...s.submuscles, sm] }
                                  : s))}
                                className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${sec.submuscles.includes(sm) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                              >{sm}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <select
                      value=""
                      onChange={e => {
                        const v = e.target.value;
                        if (v && v !== bulkPrimaryGroup && !bulkSecondary.some(s => s.muscle === v)) {
                          setBulkSecondary(p => [...p, { muscle: v, submuscles: [] }]);
                        }
                        e.currentTarget.value = "";
                      }}
                      className="w-full bg-secondary text-foreground text-[11px] p-1.5 rounded-lg border-none outline-none"
                    >
                      <option value="">+ Lägg till muskel...</option>
                      {muscleGroups.filter(mg => mg !== bulkPrimaryGroup && !bulkSecondary.some(s => s.muscle === mg)).map(mg => (
                        <option key={mg} value={mg}>{mg}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowBulkMuscle(false)} className="flex-1 py-1.5 bg-secondary text-muted-foreground text-[11px] rounded-lg">Avbryt</button>
                    <button onClick={bulkSetMuscles} disabled={!bulkPrimaryGroup || savingBulk}
                      className="flex-1 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-lg disabled:opacity-40">Spara</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Exercise list */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {exerciseList.map((item) => {
                const m = item.mapping;
                const isExpanded = expandedId === (m?.id || item.name);
                const isEditing = editingInstructionsFor === item.name;
                const isEditingMuscle = editingMuscleFor === item.name;

                return (
                  <div key={item.name} className="rounded-lg border border-border overflow-hidden">
                    {/* Row header */}
                    <div
                      className={`flex items-center gap-2 p-2.5 cursor-pointer transition-colors ${
                        m ? "bg-secondary/50 hover:bg-secondary/70" : "bg-card hover:bg-secondary/30"
                      } ${selectedExercises.has(item.name) ? "ring-2 ring-primary" : ""}`}
                      onClick={() => selectMode ? toggleSelected(item.name) : setExpandedId(isExpanded ? null : (m?.id || item.name))}
                    >
                      {/* Select checkbox in select mode */}
                      {selectMode && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selectedExercises.has(item.name) ? "bg-primary border-primary" : "border-border"
                        }`}>
                          {selectedExercises.has(item.name) && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      )}
                      {/* GIF thumbnail */}
                      <div className="w-10 h-10 rounded bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                        {m?.gif_url ? (
                          <img src={m.gif_url} alt={m.exercisedb_name} className="w-full h-full object-contain bg-white" />
                        ) : (
                          <Image className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {item.muscleGroup}
                          {m && <> → {m.exercisedb_name}</>}
                        </p>
                      </div>

                      {/* Status badges */}
                      <div className="flex items-center gap-1 shrink-0">
                        {m && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> GIF
                          </span>
                        )}
                        {m?.custom_instructions && m.custom_instructions.length > 0 && (
                          <span className="text-[10px] bg-accent/50 text-accent-foreground px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                            <FileText className="w-2.5 h-2.5" /> Instr.
                          </span>
                        )}
                        {item.isBodyweight && (
                          <span className="text-[10px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                            BW
                          </span>
                        )}
                        {(submusclesByGroup[item.muscleGroup]?.length ?? 0) > 0 && (!item.submuscles || item.submuscles.length === 0) && (
                          <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5" title="Saknar undergrupp">
                            <AlertCircle className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {item.submuscles && item.submuscles.length > 0 && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium" title={item.submuscles.join(", ")}>
                            {item.submuscles.length} sub
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMusclesFor(item.name);
                            setEditPrimaryGroup(item.muscleGroup);
                            setEditSubmuscles(item.submuscles || []);
                            setEditSecondary(item.secondaryMuscles || []);
                          }}
                          className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded-full font-medium hover:bg-muted"
                          title="Redigera muskler"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border p-3 space-y-3 bg-secondary/20">
                        {/* GIF preview */}
                        {m?.gif_url && (
                          <div className="flex justify-center">
                            <img src={m.gif_url} alt={m.exercisedb_name} className="w-48 h-48 object-contain rounded-lg bg-white border border-border" />
                          </div>
                        )}

                        {/* Muscle group editing */}
                        {isEditingMuscle ? (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-foreground">Ändra muskelgrupp</span>
                            <div className="flex flex-wrap gap-1.5">
                              {muscleGroups.map((mg) => (
                                <button
                                  key={mg}
                                  onClick={() => setEditMuscleGroup(mg)}
                                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                                    editMuscleGroup === mg ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                                  }`}
                                >
                                  {mg}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingMuscleFor(null)}
                                className="flex-1 py-2 bg-secondary text-muted-foreground text-xs font-semibold rounded-lg"
                              >
                                Avbryt
                              </button>
                              <button
                                onClick={() => saveMuscleGroup(item.name, editMuscleGroup)}
                                disabled={savingMuscle || !editMuscleGroup}
                                className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1"
                              >
                                {savingMuscle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Spara
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="text-[11px]">
                              <span className="text-muted-foreground">Muskelgrupp: </span>
                              <span className="font-semibold text-foreground">{item.muscleGroup}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMuscleFor(item.name);
                                setEditMuscleGroup(item.muscleGroup);
                              }}
                              className="text-[10px] text-primary font-semibold flex items-center gap-1 hover:opacity-80"
                            >
                              <Pencil className="w-3 h-3" /> Ändra
                            </button>
                          </div>
                        )}

                        {/* Name editing */}
                        {m && editingNameFor === item.name ? (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-foreground">Redigera namn</span>
                            <div className="space-y-1.5">
                              <div>
                                <label className="text-[10px] text-muted-foreground">Svenskt namn</label>
                                <input
                                  type="text"
                                  value={editSwedishName}
                                  onChange={(e) => setEditSwedishName(e.target.value)}
                                  className="w-full bg-secondary text-foreground text-xs p-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground">Engelskt namn (ExerciseDB)</label>
                                <input
                                  type="text"
                                  value={editEnglishName}
                                  onChange={(e) => setEditEnglishName(e.target.value)}
                                  className="w-full bg-secondary text-foreground text-xs p-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingNameFor(null)}
                                className="flex-1 py-2 bg-secondary text-muted-foreground text-xs font-semibold rounded-lg"
                              >
                                Avbryt
                              </button>
                              <button
                                onClick={() => saveNames(m.id)}
                                disabled={savingName || !editSwedishName.trim() || !editEnglishName.trim()}
                                className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1"
                              >
                                {savingName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Spara
                              </button>
                            </div>
                          </div>
                        ) : m && (
                          <div className="flex items-center justify-between">
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">{m.exercise_name}</span> → {m.exercisedb_name}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNameFor(item.name);
                                setEditSwedishName(m.exercise_name);
                                setEditEnglishName(m.exercisedb_name);
                              }}
                              className="text-[10px] text-primary font-semibold flex items-center gap-1 hover:opacity-80"
                            >
                              <Pencil className="w-3 h-3" /> Redigera namn
                            </button>
                          </div>
                        )}

                        {/* Custom instructions */}
                        {m?.custom_instructions && m.custom_instructions.length > 0 && !isEditing && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-foreground">Instruktioner</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingInstructions(item.name, m.custom_instructions!);
                                }}
                                className="text-[10px] text-primary font-semibold flex items-center gap-1 hover:opacity-80"
                              >
                                <Pencil className="w-3 h-3" /> Redigera
                              </button>
                            </div>
                            <ol className="space-y-0.5 list-decimal list-inside">
                              {m.custom_instructions.map((inst, i) => (
                                <li key={i} className="text-[11px] text-muted-foreground">{inst}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Instruction editor */}
                        {isEditing && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-foreground">Redigera instruktioner</span>
                            {loadingInstructions ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground ml-2">Hämtar befintliga instruktioner...</span>
                              </div>
                            ) : (
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                placeholder="En instruktion per rad..."
                                className="w-full bg-secondary text-foreground text-xs p-2.5 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground min-h-[120px] resize-y"
                                rows={6}
                              />
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingInstructionsFor(null)}
                                className="flex-1 py-2 bg-secondary text-muted-foreground text-xs font-semibold rounded-lg"
                              >
                                Avbryt
                              </button>
                              <button
                                onClick={() => saveInstructions(item.name)}
                                disabled={savingInstructions || !editText.trim()}
                                className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1"
                              >
                                {savingInstructions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Spara
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLinkingExercise(item.name);
                              setSearchQuery(item.name);
                              setSearchResults([]);
                              setPreviewGif(null);
                            }}
                            className="text-[11px] px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center gap-1 hover:opacity-90"
                          >
                            <Link2 className="w-3 h-3" /> {m ? "Byt GIF" : "Koppla GIF"}
                          </button>

                          {!isEditing && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingInstructions(item.name, m?.custom_instructions || null);
                              }}
                              className="text-[11px] px-3 py-1.5 bg-secondary text-foreground rounded-lg font-semibold flex items-center gap-1 hover:opacity-90"
                            >
                              <Pencil className="w-3 h-3" /> {m?.custom_instructions?.length ? "Redigera instruktioner" : "Skriv instruktioner"}
                            </button>
                          )}

                          {m && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(m.id);
                              }}
                              className="text-[11px] px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg font-semibold flex items-center gap-1 hover:opacity-90"
                            >
                              <Trash2 className="w-3 h-3" /> Ta bort GIF
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {exerciseList.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Inga övningar matchar filtret.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Muscle editor dialog */}
      {editingMusclesFor && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/60" onClick={() => setEditingMusclesFor(null)} />
          <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 z-[90] max-w-md mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Redigera muskler</p>
                <p className="text-sm font-bold truncate">{editingMusclesFor}</p>
              </div>
              <button onClick={() => setEditingMusclesFor(null)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Primär muskelgrupp</p>
                <div className="flex flex-wrap gap-1">
                  {muscleGroups.map(mg => (
                    <button key={mg} type="button"
                      onClick={() => { setEditPrimaryGroup(mg); setEditSubmuscles([]); }}
                      className={`text-[11px] px-2 py-1 rounded-md font-medium ${editPrimaryGroup === mg ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                    >{mg}</button>
                  ))}
                </div>
              </div>
              {(submusclesByGroup[editPrimaryGroup]?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Undergrupper (valfritt)</p>
                  <div className="flex flex-wrap gap-1">
                    {submusclesByGroup[editPrimaryGroup].map(sm => (
                      <button key={sm} type="button"
                        onClick={() => setEditSubmuscles(p => p.includes(sm) ? p.filter(x => x !== sm) : [...p, sm])}
                        className={`text-[11px] px-2 py-1 rounded-md font-medium ${editSubmuscles.includes(sm) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                      >{sm}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Övriga muskler (valfritt)</p>
                {editSecondary.map(sec => (
                  <div key={sec.muscle} className="bg-secondary/40 rounded-lg p-2 space-y-1 mb-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{sec.muscle}</span>
                      <button type="button" onClick={() => setEditSecondary(p => p.filter(s => s.muscle !== sec.muscle))} className="text-[10px] text-muted-foreground hover:text-destructive">Ta bort</button>
                    </div>
                    {(submusclesByGroup[sec.muscle]?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {submusclesByGroup[sec.muscle].map(sm => (
                          <button key={sm} type="button"
                            onClick={() => setEditSecondary(p => p.map(s => s.muscle === sec.muscle ? { ...s, submuscles: s.submuscles.includes(sm) ? s.submuscles.filter(x => x !== sm) : [...s.submuscles, sm] } : s))}
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${sec.submuscles.includes(sm) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                          >{sm}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <select
                  value=""
                  onChange={e => { if (e.target.value && !editSecondary.some(s => s.muscle === e.target.value) && e.target.value !== editPrimaryGroup) { setEditSecondary(p => [...p, { muscle: e.target.value, submuscles: [] }]); } e.currentTarget.value = ""; }}
                  className="w-full bg-secondary text-foreground text-xs p-2 rounded-lg border-none outline-none"
                >
                  <option value="">+ Lägg till muskel...</option>
                  {muscleGroups.filter(mg => mg !== editPrimaryGroup && !editSecondary.some(s => s.muscle === mg)).map(mg => (
                    <option key={mg} value={mg}>{mg}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button onClick={() => setEditingMusclesFor(null)} className="flex-1 py-2 bg-secondary text-muted-foreground text-xs font-semibold rounded-lg">Avbryt</button>
              <button onClick={() => saveMuscleData(editingMusclesFor)} disabled={savingMuscles || !editPrimaryGroup}
                className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1">
                {savingMuscles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Spara
              </button>
            </div>
          </div>
        </>
      )}

      {/* Linking dialog overlay */}
      {linkingExercise && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/60" onClick={() => setLinkingExercise(null)} />
          <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 z-[90] max-w-md mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Koppla GIF till:</p>
                <p className="text-sm font-bold truncate">{linkingExercise}</p>
              </div>
              <button onClick={() => setLinkingExercise(null)} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Sök övningar (engelska)..."
                  className="flex-1 bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || searchQuery.length < 2}
                  className="px-3 py-2.5 bg-primary text-primary-foreground text-sm rounded-lg disabled:opacity-40 hover:opacity-90"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>

              {previewGif && (
                <div className="flex justify-center">
                  <img src={previewGif} alt="Preview" className="w-44 h-44 object-contain rounded-lg bg-white border border-border" />
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-1">
                {searchResults.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/80 cursor-pointer transition-colors"
                    onClick={() => setPreviewGif(result.gifUrl)}
                  >
                    {result.gifUrl && (
                      <img src={result.gifUrl} alt={result.name} className="w-10 h-10 object-contain rounded bg-white shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{result.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {result.targetMuscles.join(", ")} • {result.equipments.join(", ")}
                        {(result as any).source && (
                          <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-secondary font-medium">
                            {(result as any).source === "free-exercise-db" ? "FreeDB" : "ExerciseDB"}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleLink(result); }}
                      disabled={saving}
                      className="px-2.5 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center gap-1 shrink-0 font-semibold"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Länka
                    </button>
                  </div>
                ))}

                {searchResults.length === 0 && !searching && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sök efter en övning på engelska.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExerciseGifManager;
