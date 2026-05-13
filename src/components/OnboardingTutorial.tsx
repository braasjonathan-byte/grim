import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";

const SEEN_KEY = "grim_workout_tutorial_seen_v1";

const STEPS = [
  {
    title: "Logga ett pass",
    body: "Tryck på en träningsdag i listan för att öppna passet och logga set, vikt och reps.",
  },
  {
    title: "Klarmarkera set",
    body: "Tryck på cirkeln bredvid varje set när du är klar. Om fältet är tomt används den grå förslagssiffran automatiskt.",
  },
  {
    title: "Vilotimer & verktyg",
    body: "Kör timern längst ner mellan set, eller gå till Verktyg-fliken för 1RM, kalorier och pulszoner.",
  },
];

/**
 * Three-step welcome tooltip shown the first time a user visits the workout tab.
 * Skippable and remembered in localStorage.
 */
const OnboardingTutorial = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (import.meta.env.DEV) {
      localStorage.setItem(SEEN_KEY, "1");
      return;
    }

    if (!localStorage.getItem(SEEN_KEY)) {
      // Slight delay so the page is rendered first
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[150] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-24 sm:pb-4 animate-fade-in">
      <div className="w-full max-w-sm bg-card border border-primary/40 p-5 relative">
        <button
          onClick={close}
          aria-label="Stäng"
          className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <h3 className="text-base font-black font-serif text-foreground mb-1.5">{cur.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{cur.body}</p>
        <div className="flex items-center justify-between mt-5">
          <button onClick={close} className="text-xs text-muted-foreground font-medium">
            Hoppa över
          </button>
          <button
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="bg-primary text-primary-foreground font-bold text-sm px-4 py-2 flex items-center gap-1 active:scale-95 transition-transform"
          >
            {isLast ? "Klart" : "Nästa"}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
