import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startTour, type TourVariant } from "@/lib/tour";
import { Sparkles, X, Apple } from "lucide-react";

interface TourPromptProps {
  userId: string;
}

const NUTRITION_PROMPTED_KEY = "grim:nutrition-tour-prompted";

type Mode = "welcome" | "nutrition" | null;

const TourPrompt = ({ userId }: TourPromptProps) => {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tour_prompted, tour_completed")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      if (!data.tour_prompted) {
        setTimeout(() => !cancelled && setMode("welcome"), 800);
      } else if (data.tour_completed && !localStorage.getItem(NUTRITION_PROMPTED_KEY)) {
        // Existing users who already did the original tour – offer the new kost tour once
        setTimeout(() => !cancelled && setMode("nutrition"), 1200);
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

  const markNutritionPrompted = () => {
    try { localStorage.setItem(NUTRITION_PROMPTED_KEY, "1"); } catch { /* ignore */ }
  };

  const skip = async () => {
    setBusy(true);
    if (mode === "welcome") await markPrompted(false);
    if (mode === "nutrition") markNutritionPrompted();
    setMode(null);
    setBusy(false);
  };

  const run = async (variant: TourVariant) => {
    setBusy(true);
    if (mode === "welcome") await markPrompted(false);
    if (mode === "nutrition") markNutritionPrompted();
    setMode(null);
    setBusy(false);
    setTimeout(() => {
      startTour(variant, () => {
        if (variant === "short" || variant === "long") markPrompted(true);
      });
    }, 200);
  };

  if (!mode) return null;

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

        {mode === "welcome" && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-base font-black font-serif text-foreground">Välkommen till GRIM!</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Vill du ha en kort rundtur så du snabbt kommer igång? Båda rundturerna täcker även kostfliken.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => run("short")}
                disabled={busy}
                className="w-full bg-primary text-primary-foreground font-bold text-sm px-4 py-2.5 active:scale-95 transition-transform"
              >
                Kort rundtur (~6 steg)
              </button>
              <button
                onClick={() => run("long")}
                disabled={busy}
                className="w-full bg-secondary text-foreground border border-border font-bold text-sm px-4 py-2.5 active:scale-95 transition-transform"
              >
                Lång rundtur (alla områden)
              </button>
              <button
                onClick={skip}
                disabled={busy}
                className="w-full text-xs text-muted-foreground font-medium py-2"
              >
                Hoppa över
              </button>
            </div>
          </>
        )}

        {mode === "nutrition" && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Apple className="w-5 h-5 text-primary" />
              <h3 className="text-base font-black font-serif text-foreground">Nyhet: Kost i appen</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Du kan nu logga måltider, följa makron och använda 200+ träningsanpassade recept – allt direkt i GRIM. Över 2 600 livsmedel finns tillgängliga i sökningen. Allt direkt i GRIM! Vill du se hur det funkar?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => run("nutrition")}
                disabled={busy}
                className="w-full bg-primary text-primary-foreground font-bold text-sm px-4 py-2.5 active:scale-95 transition-transform"
              >
                Visa kost-rundturen
              </button>
              <button
                onClick={skip}
                disabled={busy}
                className="w-full text-xs text-muted-foreground font-medium py-2"
              >
                Inte nu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TourPrompt;
