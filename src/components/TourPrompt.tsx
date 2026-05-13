import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startTour, type TourVariant } from "@/lib/tour";
import { Sparkles, X } from "lucide-react";

interface TourPromptProps {
  userId: string;
}

const TourPrompt = ({ userId }: TourPromptProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tour_prompted")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (data && !data.tour_prompted) {
        // Slight delay so the page renders first
        setTimeout(() => !cancelled && setOpen(true), 800);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markPrompted = async (completed = false) => {
    const update: Record<string, boolean> = { tour_prompted: true };
    if (completed) update.tour_completed = true;
    await supabase.from("profiles").update(update).eq("user_id", userId);
  };

  const skip = async () => {
    setBusy(true);
    await markPrompted(false);
    setOpen(false);
    setBusy(false);
  };

  const run = async (variant: TourVariant) => {
    setBusy(true);
    await markPrompted(false);
    setOpen(false);
    setBusy(false);
    setTimeout(() => {
      startTour(variant, () => {
        markPrompted(true);
      });
    }, 200);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-24 sm:pb-4 animate-fade-in">
      <div className="w-full max-w-sm bg-card border border-primary/40 p-5 relative">
        <button
          onClick={skip}
          aria-label="Stäng"
          disabled={busy}
          className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-base font-black font-serif text-foreground">Välkommen till GRIM!</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Vill du ha en kort rundtur så du snabbt kommer igång?
        </p>
        <div className="space-y-2">
          <button
            onClick={() => run("short")}
            disabled={busy}
            className="w-full bg-primary text-primary-foreground font-bold text-sm px-4 py-2.5 active:scale-95 transition-transform"
          >
            Kort rundtur (~5 steg)
          </button>
          <button
            onClick={() => run("long")}
            disabled={busy}
            className="w-full bg-secondary text-foreground border border-border font-bold text-sm px-4 py-2.5 active:scale-95 transition-transform"
          >
            Lång rundtur (~10 steg)
          </button>
          <button
            onClick={skip}
            disabled={busy}
            className="w-full text-xs text-muted-foreground font-medium py-2"
          >
            Hoppa över
          </button>
        </div>
      </div>
    </div>
  );
};

export default TourPrompt;
