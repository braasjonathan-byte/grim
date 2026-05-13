import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Sparkles, Wrench, ChevronRight, ArrowLeft, CalendarIcon, Trophy } from "lucide-react";
import { planTemplates, liftLabels, planCategoryLabels, padWeeksTo7Days, type TemplatePlan, type FitnessProfile, type PlanCategory } from "@/data/planTemplates";
import SchemaBuilder from "@/components/SchemaBuilder";
import FitnessProfileForm from "@/components/FitnessProfileForm";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { sv } from "date-fns/locale";

interface PlanPickerProps {
  userId: string;
  onDone: () => void;
  onBack?: () => void;
}

type Step = "select" | "profile" | "1rm" | "start-date" | "loading" | "builder";

const defaultProfile: FitnessProfile = {
  max_distance_km: null,
  time_10km_min: null,
  experience_level: null,
  training_days_per_week: null,
};

const PlanPicker = ({ userId, onDone, onBack }: PlanPickerProps) => {
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<number | null>(null);
  const [rms, setRms] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile>(defaultProfile);
  const [activeFilter, setActiveFilter] = useState<PlanCategory | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [pendingRmValues, setPendingRmValues] = useState<Record<string, number> | undefined>(undefined);
  const [pendingProfile, setPendingProfile] = useState<FitnessProfile | undefined>(undefined);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);

  const categories = Array.from(new Set(planTemplates.map(t => t.category)));
  const filteredTemplates = activeFilter
    ? planTemplates.filter(t => t.category === activeFilter)
    : planTemplates;

  const selectedTemplate = selected !== null && selected >= 0 ? planTemplates[selected] : null;
  const needs1RM = selectedTemplate && selectedTemplate.requiredLifts.length > 0;

  // Determine if selected plan needs running profile data (only actual running plans)
  const needsRunningProfile = selectedTemplate && (
    selectedTemplate.name.toLowerCase().includes("löp") ||
    selectedTemplate.name.toLowerCase().includes("löpning") ||
    selectedTemplate.description.toLowerCase().includes("löppass") ||
    selectedTemplate.description.toLowerCase().includes("löpnivå")
  );

  // Determine if selected plan is strength-only (no running fields, no training days selector)
  const isStrengthOnly = selectedTemplate && (
    selectedTemplate.name.toLowerCase().includes("styrke") ||
    selectedTemplate.name.toLowerCase().includes("styrka")
  ) && !needsRunningProfile;

  // Determine if selected plan is bodyweight/home workout
  const isBodyweightOnly = selectedTemplate && selectedTemplate.category === "kroppsvikt";

  // Determine if selected plan needs any profile data (experience level etc.)
  const needsProfile = selectedTemplate && (
    selectedTemplate.generateFromProfile !== undefined
  );

  const handleSelect = (index: number) => {
    if (index === -1) {
      setStep("builder");
      return;
    }
    const template = planTemplates[index];
    if (!template) return;
    setSelected(index);

    const templateNeedsProfile = template.generateFromProfile !== undefined;
    const templateNeeds1RM = template.requiredLifts.length > 0;

    if (templateNeedsProfile) {
      setStep("profile");
    } else if (templateNeeds1RM) {
      const initial: Record<string, string> = {};
      for (const lift of template.requiredLifts) {
        initial[lift] = rms[lift] || "";
      }
      setRms(initial);
      setStep("1rm");
    } else {
      setPendingRmValues(undefined);
      setPendingProfile(undefined);
      setStep("start-date");
    }
  };

  const handleProfileDone = (profile: FitnessProfile) => {
    setFitnessProfile(profile);
    if (needs1RM) {
      const initial: Record<string, string> = {};
      for (const lift of selectedTemplate!.requiredLifts) {
        initial[lift] = rms[lift] || "";
      }
      setRms(initial);
      setPendingProfile(profile);
      setStep("1rm");
    } else {
      setPendingRmValues(undefined);
      setPendingProfile(profile);
      setStep("start-date");
    }
  };

  const allRmsFilled = selectedTemplate
    ? selectedTemplate.requiredLifts.every((l) => {
        const v = parseFloat(rms[l] || "");
        return v > 0;
      })
    : false;

  const applyTemplate = async (template: TemplatePlan, rmValues?: Record<string, number>, profileOverride?: FitnessProfile) => {
    setLoading(true);
    setStep("loading");

    const profile = profileOverride || fitnessProfile;

    let days = template.days;
    if (template.generateFromProfile) {
      days = template.generateFromProfile(profile);
    } else if (template.generateDays && rmValues) {
      days = template.generateDays(rmValues, profile);
    }

    if (!days) {
      setLoading(false);
      onDone();
      return;
    }

    const paddedDays = padWeeksTo7Days(days);

    // Clear any existing plan rows (week > 0) so the new plan starts fresh at week 1.
    // Single workouts (week = 0) are preserved.
    await supabase.from("workout_plans").delete().eq("user_id", userId).gt("week", 0);

    const rows = paddedDays.map((d) => ({
      user_id: userId,
      week: d.week,
      day: d.day,
      session_name: d.session_name,
      details: d.details,
      tempo: d.tempo,
      created_at: startDate.toISOString(),
    }));

    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from("workout_plans").insert(rows.slice(i, i + 50));
    }

    // Save plan_start_date and mark as calibrated
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
    await supabase.from("profiles").update({ plan_start_calibrated: true, plan_start_date: startDateStr } as any).eq("user_id", userId);

    // Auto-create event countdown for event-prep plans
    if (template.isEventPrep && eventDate && eventName.trim()) {
      const evDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, "0")}-${String(eventDate.getDate()).padStart(2, "0")}`;
      await supabase.from("event_countdowns").insert({
        user_id: userId,
        event_name: eventName.trim(),
        event_date: evDateStr,
        event_type: template.defaultEventType || "annat",
      });
    }

    setLoading(false);
    onDone();
  };

  const handleApplyWith1RM = () => {
    const rmValues: Record<string, number> = {};
    for (const lift of selectedTemplate!.requiredLifts) {
      rmValues[lift] = parseFloat(rms[lift] || "0");
    }
    setPendingRmValues(rmValues);
    setStep("start-date");
  };

  const handleStartDateConfirm = () => {
    applyTemplate(selectedTemplate!, pendingRmValues, pendingProfile);
  };

  if (step === "builder") {
    return <SchemaBuilder userId={userId} onDone={onDone} onBack={() => setStep("select")} />;
  }

  if (step === "profile") {
    return (
      <FitnessProfileForm
        userId={userId}
        onDone={handleProfileDone}
        runningOnly={!!needsRunningProfile}
        strengthOnly={!!isStrengthOnly}
        bodyweightOnly={!!isBodyweightOnly}
      />
    );
  }

  if (step === "start-date") {
    const isEvent = selectedTemplate?.isEventPrep;

    // For event-prep plans, calculate start date from event date
    const computedStartDate = isEvent && eventDate
      ? addDays(eventDate, -(selectedTemplate!.weeks * 7))
      : startDate;

    const canConfirm = isEvent
      ? !!(eventDate && eventName.trim())
      : true;

    return (
      <div className="space-y-6 animate-fade-in">
        <button
          onClick={() => setStep("select")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tillbaka
        </button>

        <div className="bg-card border border-border rounded-lg p-4 space-y-1">
          <p className="font-semibold text-sm">{selectedTemplate?.name}</p>
          <p className="text-xs text-muted-foreground">{selectedTemplate?.weeks} veckor</p>
        </div>

        {isEvent ? (
          <>
            <div className="text-center space-y-2">
              <Trophy className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-xl font-black tracking-tight">När är ditt event?</h2>
              <p className="text-sm text-muted-foreground">
                Planen räknas bakåt så att du är i toppform på eventdagen. Nedräkning skapas automatiskt.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground block">Eventnamn</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="t.ex. Stockholm Halvmaraton"
                  className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground block">Eventdatum</label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={(d) => {
                    if (d) {
                      setEventDate(d);
                      setStartDate(addDays(d, -(selectedTemplate!.weeks * 7)));
                    }
                  }}
                  locale={sv}
                  disabled={(d) => d < new Date()}
                  className="p-3 pointer-events-auto bg-card border border-border rounded-lg"
                />
              </div>
            </div>

            {eventDate && eventName.trim() && (
              <>
                <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-1 text-center">
                  <p className="text-sm font-medium">
                    🎯 Event: <span className="text-primary">{format(eventDate, "EEEE d MMMM yyyy", { locale: sv })}</span>
                  </p>
                  <p className="text-sm font-medium">
                    📅 Rekommenderat startdatum: <span className="text-primary">{format(computedStartDate, "EEEE d MMMM yyyy", { locale: sv })}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block text-center">
                    Vill du starta ett annat datum? Välj nedan (programmet förkortas/förlängs)
                  </label>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => d && setStartDate(d)}
                      locale={sv}
                      disabled={(d) => d >= eventDate}
                      className="p-3 pointer-events-auto bg-card border border-border rounded-lg"
                    />
                  </div>
                  {startDate.getTime() !== computedStartDate.getTime() && (
                    <div className="bg-accent/30 border border-accent rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const diffDays = Math.round((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                          const diffWeeks = Math.round(diffDays / 7);
                          const origWeeks = selectedTemplate!.weeks;
                          if (diffWeeks > origWeeks) {
                            return `Programmet förlängs till ~${diffWeeks} veckor (normalt ${origWeeks})`;
                          } else if (diffWeeks < origWeeks) {
                            return `Programmet förkortas till ~${diffWeeks} veckor (normalt ${origWeeks})`;
                          }
                          return "";
                        })()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
                  <p className="text-sm font-medium">
                    📅 Valt startdatum: <span className="text-primary">{format(startDate, "EEEE d MMMM yyyy", { locale: sv })}</span>
                  </p>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="text-center space-y-2">
              <CalendarIcon className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-xl font-black tracking-tight">Välj startdatum</h2>
              <p className="text-sm text-muted-foreground">
                Välj vilket datum schemat ska börja från. Du kan starta mitt i en vecka.
              </p>
            </div>

            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(d) => d && setStartDate(d)}
                locale={sv}
                className="p-3 pointer-events-auto bg-card border border-border rounded-lg"
              />
            </div>

            <div className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
              <p className="text-sm font-medium">
                Startdatum: <span className="text-primary">{format(startDate, "EEEE d MMMM yyyy", { locale: sv })}</span>
              </p>
            </div>
          </>
        )}

        <button
          onClick={() => {
            handleStartDateConfirm();
          }}
          disabled={loading || !canConfirm}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {isEvent ? "Starta schemat mot eventet" : "Starta schemat"}
        </button>
      </div>
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
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tillbaka
        </button>
      )}
      <div className="text-center space-y-2">
        <Dumbbell className="w-10 h-10 text-primary mx-auto" />
        <h2 className="text-2xl font-black tracking-tight">Välj träningsplan</h2>
        <p className="text-sm text-muted-foreground">
          Antal pass/vecka är rekommenderat — du väljer själv hur många dagar du vill träna i nästa steg
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setActiveFilter(null); setSelected(null); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            activeFilter === null
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Alla
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveFilter(cat); setSelected(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeFilter === cat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {planCategoryLabels[cat]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredTemplates.map((template) => {
          const realIdx = planTemplates.indexOf(template);
          return (
            <button
              key={realIdx}
              onClick={() => handleSelect(realIdx)}
              disabled={loading}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selected === realIdx
                  ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="font-bold text-sm">{template.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {template.description.replace(/(\d+)\s*pass\/vecka/g, "rek. $1 pass/vecka").replace(/(\d+–\d+)\s*pass\/vecka/g, "rek. $1 pass/vecka")}
                  </p>
                  {template.requiredLifts.length > 0 && (
                    <p className="text-xs text-primary mt-1.5 font-medium">
                      📊 Beräknar vikter från din 1RM
                    </p>
                  )}
                  {template.generateFromProfile && (
                    <p className="text-xs text-primary mt-1.5 font-medium">
                      ✨ Anpassas efter dina förutsättningar
                    </p>
                  )}
                  {template.isEventPrep && (
                    <p className="text-xs text-primary mt-1.5 font-medium">
                      🎯 Anpassas till ditt eventdatum
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
              </div>
            </button>
          );
        })}

        <button
          onClick={() => handleSelect(-1)}
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

    </div>
  );
};

export default PlanPicker;
