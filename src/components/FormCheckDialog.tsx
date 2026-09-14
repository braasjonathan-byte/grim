import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Aspect { rating?: string; comment?: string }
interface FormFeedback {
  exercise?: string;
  overall?: string;
  score?: number;
  depth?: Aspect;
  tempo?: Aspect;
  symmetry?: Aspect;
  cues?: string[];
  warnings?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName?: string;
}

const MAX_FRAMES = 6;

const ratingColor = (rating?: string) => {
  if (rating === "bra") return "text-primary";
  if (rating === "okej") return "text-warning";
  return "text-destructive";
};

/** Plockar jämnt fördelade stillbilder ur en inspelad film. */
async function extractFrames(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Kunde inte läsa filmen"));
    });

    const duration = isFinite(video.duration) && video.duration > 0 ? Math.min(video.duration, 20) : 5;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(video.videoWidth || 640, 1));
    canvas.width = Math.round((video.videoWidth || 640) * scale);
    canvas.height = Math.round((video.videoHeight || 360) * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Kunde inte behandla filmen");

    const frames: string[] = [];
    for (let i = 0; i < MAX_FRAMES; i++) {
      const time = (duration * (i + 0.5)) / MAX_FRAMES;
      await new Promise<void>((resolve) => {
        const onSeeked = () => { video.removeEventListener("seeked", onSeeked); resolve(); };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = Math.min(time, Math.max(duration - 0.05, 0));
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.7));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Filma ett set och få AI-feedback på djup, tempo och symmetri. */
export default function FormCheckDialog({ open, onOpenChange, exerciseName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFeedback(null);
    setLoading(true);
    try {
      const frames = await extractFrames(file);
      if (frames.length < 2) throw new Error("Filmen är för kort");
      const { data, error } = await supabase.functions.invoke("form-check", {
        body: { frames, exercise: exerciseName || "" },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setFeedback(data as FormFeedback);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysen misslyckades");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const aspect = (label: string, data?: Aspect) =>
    data && (
      <div className="bg-secondary/40 rounded-xl p-3 space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">{label}</span>
          <span className={`text-[11px] font-bold ${ratingColor(data.rating)}`}>{data.rating}</span>
        </div>
        {data.comment && <p className="text-xs text-muted-foreground">{data.comment}</p>}
      </div>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="w-4 h-4 text-primary" /> Formkoll
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Filma ett set rakt från sidan{exerciseName ? ` av ${exerciseName}` : ""} så får du feedback på djup, tempo
            och symmetri. Detta är träningstips, inte medicinsk rådgivning.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {loading ? (
            <Button className="w-full" disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyserar…
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => inputRef.current?.click()}>
                <Camera className="w-4 h-4 mr-2" /> Filma
              </Button>
              <Button variant="secondary" onClick={() => galleryRef.current?.click()}>
                <ImageIcon className="w-4 h-4 mr-2" /> Galleri
              </Button>
            </div>
          )}


          {feedback && (
            <div className="space-y-2 animate-fade-in">
              <div className="bg-card border border-border rounded-2xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{feedback.exercise || exerciseName || "Ditt set"}</span>
                  {typeof feedback.score === "number" && (
                    <span className="text-sm font-bold tabular-nums text-primary">{feedback.score}/10</span>
                  )}
                </div>
                {feedback.overall && <p className="text-xs text-muted-foreground">{feedback.overall}</p>}
              </div>

              {aspect("Djup", feedback.depth)}
              {aspect("Tempo", feedback.tempo)}
              {aspect("Symmetri", feedback.symmetry)}

              {!!feedback.cues?.length && (
                <div className="bg-card border border-border rounded-2xl p-3 space-y-1">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Tänk på nästa set
                  </span>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {feedback.cues.map((c, i) => <li key={i}>• {c}</li>)}
                  </ul>
                </div>
              )}

              {!!feedback.warnings?.length && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-3 space-y-1">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5" /> Se upp
                  </span>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {feedback.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
