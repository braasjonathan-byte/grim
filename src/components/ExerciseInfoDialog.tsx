import { useState, useEffect } from "react";
import { X, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ExerciseInfoDialogProps {
  exerciseName: string;
  onClose: () => void;
}

interface ExerciseData {
  gifUrl: string | null;
  name: string;
  instructions: string[];
  targetMuscles: string[];
  equipments: string[];
  isCardio?: boolean;
}

const ExerciseInfoDialog = ({ exerciseName, onClose }: ExerciseInfoDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExerciseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("exercise-gif", {
          body: { exerciseName },
        });
        if (fnError) throw fnError;
        if (result?.isCardio) {
          setData(result);
        } else if (result?.gifUrl) {
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
    fetchData();
  }, [exerciseName]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden animate-fade-in max-h-[85vh] flex flex-col">
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

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">{error}</p>
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

              {data.name && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Engelsk benämning:</span> {data.name}
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

              {data.instructions && data.instructions.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-foreground">Instruktioner</h4>
                  <ol className="space-y-1 list-decimal list-inside">
                    {data.instructions.map((inst, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {inst.replace(/^Step:\d+\s*/i, "")}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseInfoDialog;
