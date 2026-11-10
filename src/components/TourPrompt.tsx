import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countTourSteps, startTour, type TourVariant } from "@/lib/tour";
import { Sparkles, X, Apple } from "lucide-react";
import { useDialogTurn } from "@/lib/dialogQueue";
import { defaultModulesFor, getModules, setGoal, setModules, type Goal, type ModuleKey } from "@/lib/modules";

const GOALS: { key: Goal; label: string; emoji: string; hint: string }[] = [
  { key: "strength", label: "Bli starkare", emoji: "🏋️", hint: "Progression, RPE och PR" },
  { key: "cardio", label: "Bättre kondition", emoji: "🏃", hint: "GPS, intervaller och puls" },
  { key: "weight", label: "Gå ner / gå upp i vikt", emoji: "⚖️", hint: "Kost, vikttrend och adaptivt mål" },
  { key: "general", label: "Må bra och hålla igång", emoji: "✨", hint: "Enkla pass och vanor" },
];
const MODULE_ROWS: [ModuleKey, string, string][] = [
  ["nutrition", "Kost", "Logga mat, makron och vatten"],
  ["social", "Socialt", "Vänner, flöde och hejarop"],
];

interface TourPromptProps {
  userId: string;
}

const NUTRITION_PROMPTED_KEY = "grim:nutrition-tour-prompted";

type Mode = "welcome" | "nutrition" | null;

const TourPrompt = ({ userId }: TourPromptProps) => {
  const [mode, setMode] = useState<Mode>(null);
  // Välkomstflödet står först i dialogkön; andra automatiska dialoger väntar.
  const myTurn = useDialogTurn("tour", mode !== null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"goal" | "tour">("goal");
  const [goal, setGoalState] = useState<Goal | null>(null);
  const [mods, setMods] = useState<Record<ModuleKey, boolean>>(getModules);
  const finishSetup = () => {
    if (goal) setGoal(goal);
    setModules(mods);
    // Ett flöde: hoppa över den separata träningsguiden när välkomstflödet körts.
    try { localStorage.setItem("grim_workout_tutorial_seen_v1", "1"); } catch { /* ignore */ }
    setStage("tour");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tour_prompted")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      if (!data.tour_prompted) {
        setTimeout(() => !cancelled && setMode("welcome"), 800);
      }
      // Nutrition tour is no longer auto-prompted — it's no longer a new feature.
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markPrompted = async (completed = false) => {
    const update: Record<string, boolean> = { tour_prompted: true };
    if (completed) update.tour_completed = true;
    await supabase.from("profiles").update(update).eq("user_id", userId);
    try { window.dispatchEvent(new CustomEvent("grim:tour-prompted")); } catch { /* ignore */ }
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

  if (!mode || !myTurn) return null;

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

        {mode === "welcome" && stage === "goal" && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Steg 1 av 2</p>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-base font-black font-serif text-foreground">Välkommen till GRIM!</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Vad vill du främst uppnå? Vi anpassar menyn efter det.</p>
            <div className="grid grid-cols-2 gap-2 mb-3" role="radiogroup" aria-label="Mål">
              {GOALS.map((g) => {
                const on = goal === g.key;
                return (
                  <button key={g.key} type="button" role="radio" aria-checked={on} disabled={busy}
                    onClick={() => { setGoalState(g.key); setMods(defaultModulesFor(g.key)); }}
                    className={`text-left px-3 py-2.5 border transition-colors active:scale-[0.98] ${on ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-secondary hover:border-primary/40"}`}>
                    <span className="block text-lg leading-none mb-1">{g.emoji}</span>
                    <span className="block text-xs font-bold text-foreground">{g.label}</span>
                    <span className="block text-[10px] text-muted-foreground leading-snug mt-0.5">{g.hint}</span>
                  </button>
                );
              })}
            </div>
            {goal && (
              <div className="mb-3 animate-fade-in">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1.5">Visa i menyn <span className="normal-case font-medium tracking-normal">· förvalt för ditt mål</span></p>
                <div className="space-y-1.5">
                  {MODULE_ROWS.map(([k, label, desc]) => (
                    <label key={k} className={`flex items-center justify-between gap-3 px-3 py-2 border cursor-pointer ${mods[k] ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block text-[11px] text-muted-foreground">{desc}</span>
                      </span>
                      <input type="checkbox" className="w-5 h-5 accent-primary shrink-0" checked={mods[k]} onChange={(e) => setMods((m) => ({ ...m, [k]: e.target.checked }))} />
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Hem, Träning och Statistik finns alltid. Ändra när som helst under Verktyg.</p>
              </div>
            )}
            <button onClick={finishSetup} disabled={busy || !goal}
              className="w-full bg-primary text-primary-foreground font-bold text-sm px-4 py-2.5 active:scale-95 transition-transform disabled:opacity-50">
              {goal ? "Fortsätt" : "Välj ett mål"}
            </button>
            <button onClick={skip} disabled={busy} className="w-full text-xs text-muted-foreground font-medium py-2">Hoppa över</button>
          </>
        )}

        {mode === "welcome" && stage === "tour" && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Steg 2 av 2</p>
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
                Kort rundtur ({countTourSteps("short")} steg)
              </button>
              <button
                onClick={() => run("long")}
                disabled={busy}
                className="w-full bg-secondary text-secondary-foreground border border-border font-bold text-sm px-4 py-2.5 active:scale-95 transition-transform"
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
