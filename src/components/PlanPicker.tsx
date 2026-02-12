import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Sparkles, Wrench, ChevronRight, ArrowLeft } from "lucide-react";
import { planTemplates, liftLabels, type TemplatePlan } from "@/data/planTemplates";
import FitnessProfileForm from "@/components/FitnessProfileForm";

interface PlanPickerProps {
  userId: string;
  onDone: () => void;
}

type Step = "profile" | "select" | "1rm" | "loading";

const PlanPicker = ({ userId, onDone }: PlanPickerProps) => {
  const [step, setStep] = useState<Step>("profile");
  const [selected, setSelected] = useState<number | null>(null);
  const [rms, setRms] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const selectedTemplate = selected !== null && selected >= 0 ? planTemplates[selected] : null;
  const needs1RM = selectedTemplate && selectedTemplate.requiredLifts.length > 0;

  const handleNext = () => {
    if (selected === -1) {
      onDone();
      return;
    }
    if (needs1RM) {
      // Pre-fill empty values
      const initial: Record<string, string> = {};
      for (const lift of selectedTemplate!.requiredLifts) {
        initial[lift] = rms[lift] || "";
      }
      setRms(initial);
      setStep("1rm");
    } else {
      applyTemplate(selectedTemplate!);
    }
  };

  const allRmsFilled = selectedTemplate
    ? selectedTemplate.requiredLifts.every((l) => {
        const v = parseFloat(rms[l] || "");
        return v > 0;
      })
    : false;

  const applyTemplate = async (template: TemplatePlan, rmValues?: Record<string, number>) => {
    setLoading(true);
    setStep("loading");

    let days = template.days;
    if (template.generateDays && rmValues) {
      days = template.generateDays(rmValues);
    }

    if (!days) {
      setLoading(false);
      onDone();
      return;
    }

    const rows = days.map((d) => ({
      user_id: userId,
      week: d.week,
      day: d.day,
      session_name: d.session_name,
      details: d.details,
      tempo: d.tempo,
    }));

    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from("workout_plans").insert(rows.slice(i, i + 50));
    }

    setLoading(false);
    onDone();
  };

  const handleApplyWith1RM = () => {
    const rmValues: Record<string, number> = {};
    for (const lift of selectedTemplate!.requiredLifts) {
      rmValues[lift] = parseFloat(rms[lift] || "0");
    }
    applyTemplate(selectedTemplate!, rmValues);
  };

  if (step === "profile") {
    return (
      <FitnessProfileForm
        userId={userId}
        onDone={() => setStep("select")}
      />
    );
  }

  if (step === "loading") {
    return (
      <div className="text-center py-16 space-y-4 animate-fade-in">
        <Dumbbell className="w-10 h-10 text-primary mx-auto animate-pulse" />
        <p className="font-semibold">Skapar ditt schema...</p>
        <p className="text-sm text-muted-foreground">Beräknar vikter och bygger alla veckor</p>
      </div>
    );
  }

  if (step === "1rm") {
    return (
      <div className="space-y-6 animate-fade-in">
        <button
          onClick={() => setStep("select")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tillbaka
        </button>

        <div className="text-center space-y-2">
          <Dumbbell className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-xl font-black tracking-tight">Ange din 1RM</h2>
          <p className="text-sm text-muted-foreground">
            Programmet beräknar alla vikter baserat på dina maxlyft
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-1">
          <p className="font-semibold text-sm">{selectedTemplate?.name}</p>
          <p className="text-xs text-muted-foreground">{selectedTemplate?.weeks} veckor</p>
        </div>

        <div className="space-y-3">
          {selectedTemplate?.requiredLifts.map((lift) => (
            <div key={lift} className="space-y-1">
              <label className="text-xs text-muted-foreground block">
                {liftLabels[lift] || lift} — 1RM (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={rms[lift] || ""}
                onChange={(e) => setRms((prev) => ({ ...prev, [lift]: e.target.value }))}
                placeholder="t.ex. 100"
                className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          ))}
        </div>

        <div className="bg-secondary/50 border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tips:</strong> Osäker på din 1RM? Använd 1RM-kalkylatorn (sista fliken) för att uppskatta den baserat på en vikt och antal reps du klarar.
          </p>
        </div>

        <button
          onClick={handleApplyWith1RM}
          disabled={!allRmsFilled || loading}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Skapa schema med beräknade vikter
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <Dumbbell className="w-10 h-10 text-primary mx-auto" />
        <h2 className="text-2xl font-black tracking-tight">Välj träningsplan</h2>
        <p className="text-sm text-muted-foreground">
          Välj en färdig plan eller bygg din egen från grunden
        </p>
      </div>

      <div className="space-y-3">
        {planTemplates.map((template, idx) => (
          <button
            key={idx}
            onClick={() => setSelected(idx)}
            disabled={loading}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              selected === idx
                ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <Sparkles className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selected === idx ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <h3 className="font-bold text-sm">{template.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                {template.requiredLifts.length > 0 && (
                  <p className="text-xs text-primary mt-1.5 font-medium">
                    📊 Beräknar vikter från din 1RM
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
            </div>
          </button>
        ))}

        <button
          onClick={() => setSelected(-1)}
          disabled={loading}
          className={`w-full text-left p-4 rounded-lg border transition-all ${
            selected === -1
              ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
              : "border-border bg-card hover:border-primary/50"
          }`}
        >
          <div className="flex items-start gap-3">
            <Wrench className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selected === -1 ? "text-primary" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <h3 className="font-bold text-sm">🛠️ Bygg eget schema</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Starta tomt och lägg till dina egna pass, övningar och veckor.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
          </div>
        </button>
      </div>

      {selected !== null && (
        <button
          onClick={handleNext}
          disabled={loading}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity animate-fade-in"
        >
          {selected === -1
            ? "Fortsätt utan plan"
            : needs1RM
            ? "Nästa – Ange din 1RM →"
            : "Använd denna plan"}
        </button>
      )}
    </div>
  );
};

export default PlanPicker;
