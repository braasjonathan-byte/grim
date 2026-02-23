import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link2, Trash2, Loader2, ChevronDown, Check, FileText, Image, X, Pencil, Save, Eye } from "lucide-react";
import { exerciseLibrary } from "@/data/exerciseLibrary";

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

const ExerciseGifManager = () => {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [showOnlyMapped, setShowOnlyMapped] = useState(false);
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);

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

  const fetchMappings = async () => {
    const { data } = await supabase
      .from("exercise_gif_mappings")
      .select("id, exercise_name, exercisedb_name, gif_url, custom_instructions, created_at")
      .order("exercise_name");
    setMappings((data as Mapping[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchMappings();
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

  const saveInstructions = async (exerciseName: string) => {
    setSavingInstructions(true);
    const instructions = editText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    try {
      await supabase.functions.invoke("exercise-gif", {
        body: { exerciseName, action: "save_instructions", instructions },
      });
      await fetchMappings();
      setEditingInstructionsFor(null);
    } catch (e) {
      console.error("Failed to save instructions:", e);
    }
    setSavingInstructions(false);
  };

  // All exercises from library (non-cardio)
  const linkableExercises = useMemo(
    () =>
      exerciseLibrary
        .filter((e) => e.category !== "kondition" && e.category !== "rörlighet")
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, "sv")),
    []
  );

  const mappingsByName = useMemo(() => {
    const map = new Map<string, Mapping>();
    for (const m of mappings) map.set(m.exercise_name.toLowerCase(), m);
    return map;
  }, [mappings]);

  // Build unified list: every exercise from library, with mapping info if available
  const exerciseList = useMemo(() => {
    const filterLower = filter.toLowerCase();
    return linkableExercises
      .map((name) => ({
        name,
        mapping: mappingsByName.get(name.toLowerCase()) || null,
      }))
      .filter((item) => {
        if (filterLower && !item.name.toLowerCase().includes(filterLower) && !item.mapping?.exercisedb_name.toLowerCase().includes(filterLower)) return false;
        if (showOnlyMapped && !item.mapping) return false;
        if (showOnlyUnmapped && item.mapping) return false;
        return true;
      });
  }, [linkableExercises, mappingsByName, filter, showOnlyMapped, showOnlyUnmapped]);

  const mappedCount = linkableExercises.filter((n) => mappingsByName.has(n.toLowerCase())).length;
  const totalCount = linkableExercises.length;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">GIF-kopplingar</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {mappedCount}/{totalCount}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          {/* Search & filter bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrera övningar..."
                className="w-full bg-secondary text-foreground text-sm pl-8 pr-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Filter chips */}
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
              ✅ Kopplade ({mappedCount})
            </button>
            <button
              onClick={() => { setShowOnlyMapped(false); setShowOnlyUnmapped(true); }}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                showOnlyUnmapped ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              ❌ Ej kopplade ({totalCount - mappedCount})
            </button>
          </div>

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

                return (
                  <div key={item.name} className="rounded-lg border border-border overflow-hidden">
                    {/* Row header */}
                    <div
                      className={`flex items-center gap-2 p-2.5 cursor-pointer transition-colors ${
                        m ? "bg-secondary/50 hover:bg-secondary/70" : "bg-card hover:bg-secondary/30"
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : (m?.id || item.name))}
                    >
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
                        {m && (
                          <p className="text-[10px] text-muted-foreground truncate">→ {m.exercisedb_name}</p>
                        )}
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

                        {/* Custom instructions */}
                        {m?.custom_instructions && m.custom_instructions.length > 0 && !isEditing && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-foreground">Anpassade instruktioner</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingInstructionsFor(item.name);
                                  setEditText(m.custom_instructions!.join("\n"));
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
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              placeholder="En instruktion per rad..."
                              className="w-full bg-secondary text-foreground text-xs p-2.5 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground min-h-[120px] resize-y"
                              rows={6}
                            />
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
                            <Link2 className="w-3 h-3" /> {m ? "Byt GIF-koppling" : "Koppla GIF"}
                          </button>

                          {!isEditing && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingInstructionsFor(item.name);
                                setEditText(m?.custom_instructions?.join("\n") || "");
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
                              <Trash2 className="w-3 h-3" /> Ta bort koppling
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
