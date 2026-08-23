import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Sparkles, X, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { pickImage } from "@/lib/pickImage";
import { buildWorkoutFromAiExercises, type AiExercise } from "@/lib/aiWorkoutImport";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (workout: {
    name: string;
    details: string;
    tempo: string | null;
    loggedWeights: Record<string, string>;
  }) => void;
}

/**
 * Hedersmedlemmar kan läsa av en skärmdump från en annan träningsapp och
 * få den tolkad till ett pass som kan importeras direkt.
 */
export default function AiWorkoutScanDialog({ open, onClose, onConfirm }: Props) {
  const { toast } = useToast();
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<AiExercise[]>([]);
  const [tempo, setTempo] = useState("");
  const [hasResult, setHasResult] = useState(false);

  if (!open) return null;

  const reset = () => {
    setPhoto(null);
    setAnalyzing(false);
    setName("");
    setExercises([]);
    setTempo("");
    setHasResult(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const analyze = async (dataUrl: string) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-workout-screenshot", {
        body: { image: dataUrl },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setName((data as any).name || "Importerat pass");
      setExercises(((data as any).exercises || []) as AiExercise[]);
      setTempo((data as any).tempo || "");
      setHasResult(true);
    } catch (e: any) {
      toast({
        title: "Kunde inte läsa av bilden",
        description: e?.message || "Försök igen med en tydligare skärmdump.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const choose = async () => {
    const picked = await pickImage({ source: "prompt", quality: 80 });
    if (!picked) return;
    setPhoto(picked.dataUrl);
    setHasResult(false);
    void analyze(picked.dataUrl);
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={close} />
      <div className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3 z-10">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" /> AI: läs av skärmdump
          </h3>
          <button onClick={close} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Ta en skärmdump av passet i din andra träningsapp så tolkar AI:n övningar, set, reps och vikter.
        </p>

        {photo && (
          <img src={photo} alt="Skärmdump av träningspass" className="w-full max-h-52 object-contain rounded-lg bg-secondary" />
        )}

        <button
          onClick={choose}
          disabled={analyzing}
          className="w-full py-2.5 border border-dashed border-primary/40 rounded-lg text-xs text-primary hover:border-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ImagePlus className="w-4 h-4" /> {photo ? "Välj en annan bild" : "Välj skärmdump"}
        </button>

        {analyzing && (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Analyserar passet...
          </div>
        )}

        {hasResult && !analyzing && (
          <div className="space-y-2 animate-fade-in">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Passnamn</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Övningar (en per rad)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={8}
                className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary font-mono resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tempo/RPE (valfritt)</label>
              <input
                type="text"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Granska och justera innan du importerar.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const trimmed = details.trim();
                  if (!trimmed) return;
                  onConfirm({ name: name.trim() || "Importerat pass", details: trimmed, tempo: tempo.trim() || null });
                  reset();
                }}
                disabled={!details.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-40"
              >
                Importera pass
              </button>
              <button onClick={close} className="px-4 py-2.5 bg-secondary text-muted-foreground rounded-lg text-sm">
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
