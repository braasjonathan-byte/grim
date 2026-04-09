import { useState, useEffect } from "react";
import { X, Info, Loader2, Pencil, Save, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ExerciseInfoDialogProps {
  exerciseName: string;
  onClose: () => void;
  isAdmin?: boolean;
  initialEditMode?: boolean;
}

interface ExerciseData {
  gifUrl: string | null;
  imageUrls?: string[];
  name: string;
  instructions: string[];
  targetMuscles: string[];
  equipments: string[];
  isCardio?: boolean;
  hasCustomInstructions?: boolean;
}

const ExerciseInfoDialog = ({ exerciseName, onClose, isAdmin = false, initialEditMode = false }: ExerciseInfoDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExerciseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("exercise-gif", {
          body: { exerciseName },
        });
        if (fnError) throw fnError;
        if (result?.isCardio) {
          setData(result);
        } else if (result?.gifUrl || (result?.instructions && result.instructions.length > 0)) {
          setData(result);
        } else {
          setError("Ingen demonstration hittades för denna övning.");
        }
      } catch (e) {
        setError("Kunde inte hämta övningsinformation.");
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    setError(null);
    setData(null);
    setEditing(false);
    fetchData();
  }, [exerciseName]);

  useEffect(() => {
    if (!loading && initialEditMode && isAdmin) {
      setEditing(true);
    }
  }, [loading, initialEditMode, isAdmin]);

  const startEditing = () => {
    const lines = data?.instructions || [];
    setEditText(lines.join("\n"));
    setEditing(true);
  };

  const saveInstructions = async () => {
    setSaving(true);
    const instructions = editText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    try {
      const { error: fnError } = await supabase.functions.invoke("exercise-gif", {
        body: { exerciseName, action: "save_instructions", instructions },
      });
      if (fnError) throw fnError;
      setData(prev => prev ? { ...prev, instructions, hasCustomInstructions: true } : prev);
      setEditing(false);
    } catch (e) {
      console.error("Failed to save instructions:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-t-2xl overflow-hidden animate-fade-in max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-4 h-4 text-primary flex-shrink-0" />
            <h3 className="font-bold text-sm truncate">{exerciseName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}

          {error && !data && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">{error}</p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setError(null);
                    setData({ gifUrl: null, name: exerciseName, instructions: [], targetMuscles: [], equipments: [] });
                    setEditText("");
                    setEditing(true);
                  }}
                  className="text-xs text-primary font-semibold flex items-center gap-1 mx-auto"
                >
                  <Pencil className="w-3 h-3" /> Skriv instruktioner
                </button>
              )}
            </div>
          )}

          {data && (
            <>
              {data.isCardio && !data.gifUrl && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Konditions- och rörlighetsövningar har ingen GIF-demonstration.
                  </p>
                </div>
              )}

              {data.gifUrl && (
                <div className="rounded-lg overflow-hidden bg-secondary border border-border">
                  <img
                    src={data.gifUrl}
                    alt={`Demonstration av ${exerciseName}`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              )}

              {!data.gifUrl && data.imageUrls && data.imageUrls.length > 0 && (
                <div className="space-y-1.5">
                  <div className={`grid ${data.imageUrls.length >= 2 ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                    {data.imageUrls.slice(0, 2).map((url, i) => (
                      <div key={i} className="rounded-lg overflow-hidden bg-white border border-border">
                        <img
                          src={url}
                          alt={`${exerciseName} position ${i + 1}`}
                          className="w-full h-auto"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {data.imageUrls.length >= 2 ? "Start- och slutposition" : "Illustration"}
                  </p>
                </div>
              )}

              {data.name && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Engelsk benämning:</span> {data.name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </p>
              )}

              {data.targetMuscles && data.targetMuscles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.targetMuscles.map((m, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold capitalize">
                      {m}
                    </span>
                  ))}
                  {data.equipments?.map((e, i) => (
                    <span key={`eq-${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                      {e}
                    </span>
                  ))}
                </div>
              )}

              {editing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground">Redigera instruktioner</h4>
                    {data.hasCustomInstructions && (
                      <span className="text-[10px] text-primary font-medium">Anpassad</span>
                    )}
                  </div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="Skriv en instruktion per rad..."
                    className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground min-h-[150px] resize-y"
                    rows={8}
                  />
                  <p className="text-[10px] text-muted-foreground">En instruktion per rad. Numrering läggs till automatiskt.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 py-2.5 bg-secondary text-muted-foreground text-sm font-semibold rounded-lg hover:bg-muted transition-colors"
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={saveInstructions}
                      disabled={saving || !editText.trim()}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Spara
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {data.instructions && data.instructions.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-foreground">Instruktioner</h4>
                        {isAdmin && (
                          <button onClick={startEditing} className="text-[10px] text-primary font-semibold flex items-center gap-1 hover:opacity-80">
                            <Pencil className="w-3 h-3" /> Redigera
                          </button>
                        )}
                      </div>
                      {data.hasCustomInstructions && (
                        <p className="text-[10px] text-primary font-medium">✏️ Anpassade instruktioner</p>
                      )}
                      <ol className="space-y-1 list-decimal list-inside">
                        {data.instructions.map((inst, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            {inst.replace(/^(Step|Steg)\s*:?\s*\d+\s*:?\s*/i, "")}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {(!data.instructions || data.instructions.length === 0) && isAdmin && (
                    <button
                      onClick={startEditing}
                      className="text-xs text-primary font-semibold flex items-center gap-1 mx-auto hover:opacity-80"
                    >
                      <Pencil className="w-3 h-3" /> Skriv instruktioner
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseInfoDialog;
