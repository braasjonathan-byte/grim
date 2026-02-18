import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link2, Trash2, Loader2, ChevronDown, ExternalLink, Check } from "lucide-react";
import { exerciseLibrary } from "@/data/exerciseLibrary";

interface Mapping {
  id: string;
  exercise_name: string;
  exercisedb_name: string;
  gif_url: string | null;
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

  // Linking state
  const [selectedExercise, setSelectedExercise] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExerciseDBResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewGif, setPreviewGif] = useState<string | null>(null);

  const fetchMappings = async () => {
    const { data } = await supabase
      .from("exercise_gif_mappings")
      .select("id, exercise_name, exercisedb_name, gif_url, created_at")
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
    if (!selectedExercise) return;
    setSaving(true);

    const { data: existing } = await supabase
      .from("exercise_gif_mappings")
      .select("id")
      .ilike("exercise_name", selectedExercise)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("exercise_gif_mappings")
        .update({
          exercisedb_name: result.name,
          gif_url: result.gifUrl,
        })
        .eq("id", existing.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("exercise_gif_mappings")
        .insert({
          exercise_name: selectedExercise,
          exercisedb_name: result.name,
          gif_url: result.gifUrl,
          created_by: user!.id,
        });
    }

    await fetchMappings();
    setSelectedExercise("");
    setSearchQuery("");
    setSearchResults([]);
    setPreviewGif(null);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("exercise_gif_mappings").delete().eq("id", id);
    setMappings((prev) => prev.filter((m) => m.id !== id));
  };

  // All exercises from library that are NOT cardio/mobility
  const linkableExercises = exerciseLibrary
    .filter((e) => e.category !== "kondition" && e.category !== "rörlighet")
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "sv"));

  const mappedNames = new Set(mappings.map((m) => m.exercise_name.toLowerCase()));

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
            {mappings.length} st
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Select exercise to link */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Välj övning att koppla:</label>
            <select
              value={selectedExercise}
              onChange={(e) => {
                setSelectedExercise(e.target.value);
                setSearchQuery(e.target.value);
                setSearchResults([]);
                setPreviewGif(null);
              }}
              className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Välj övning...</option>
              {linkableExercises.map((name) => (
                <option key={name} value={name}>
                  {name} {mappedNames.has(name.toLowerCase()) ? "✅" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Search ExerciseDB */}
          {selectedExercise && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Sök i ExerciseDB (på engelska):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="t.ex. hip thrust, glute bridge..."
                  className="flex-1 bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || searchQuery.length < 2}
                  className="px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>

              {/* Preview */}
              {previewGif && (
                <div className="flex justify-center">
                  <img src={previewGif} alt="Preview" className="w-40 h-40 object-contain rounded-lg bg-white" />
                </div>
              )}

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {searchResults.map((result, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/80 cursor-pointer transition-colors"
                      onClick={() => setPreviewGif(result.gifUrl)}
                    >
                      {result.gifUrl && (
                        <img src={result.gifUrl} alt={result.name} className="w-10 h-10 object-contain rounded bg-white flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{result.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {result.targetMuscles.join(", ")} • {result.equipments.join(", ")}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLink(result);
                        }}
                        disabled={saving}
                        className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Länka
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Tryck sök för att hitta övningar i ExerciseDB.
                </p>
              )}
            </div>
          )}

          {/* Existing mappings */}
          <div className="border-t border-border pt-3 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Befintliga kopplingar:</h4>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : mappings.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Inga kopplingar ännu.</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {mappings.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
                    {m.gif_url && (
                      <img src={m.gif_url} alt={m.exercisedb_name} className="w-8 h-8 object-contain rounded bg-white flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{m.exercise_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">→ {m.exercisedb_name}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseGifManager;
