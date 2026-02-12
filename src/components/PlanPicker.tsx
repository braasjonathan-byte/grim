import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Sparkles, Wrench } from "lucide-react";
import { planTemplates, type TemplatePlan } from "@/data/planTemplates";

interface PlanPickerProps {
  userId: string;
  onDone: () => void;
}

const PlanPicker = ({ userId, onDone }: PlanPickerProps) => {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const applyTemplate = async (template: TemplatePlan) => {
    setLoading(true);
    const rows = template.days.map((d) => ({
      user_id: userId,
      week: d.week,
      day: d.day,
      session_name: d.session_name,
      details: d.details,
      tempo: d.tempo,
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from("workout_plans").insert(rows.slice(i, i + 50));
    }

    setLoading(false);
    onDone();
  };

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
              <div>
                <h3 className="font-bold text-sm">{template.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
              </div>
            </div>
          </button>
        ))}

        {/* Build own */}
        <button
          onClick={() => { setSelected(-1); }}
          disabled={loading}
          className={`w-full text-left p-4 rounded-lg border transition-all ${
            selected === -1
              ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
              : "border-border bg-card hover:border-primary/50"
          }`}
        >
          <div className="flex items-start gap-3">
            <Wrench className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selected === -1 ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <h3 className="font-bold text-sm">🛠️ Bygg eget schema</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Starta tomt och lägg till dina egna pass, övningar och veckor.
              </p>
            </div>
          </div>
        </button>
      </div>

      {selected !== null && (
        <button
          onClick={() => {
            if (selected === -1) {
              onDone();
            } else {
              applyTemplate(planTemplates[selected]);
            }
          }}
          disabled={loading}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity animate-fade-in"
        >
          {loading
            ? "Skapar schema..."
            : selected === -1
            ? "Fortsätt utan plan"
            : "Använd denna plan"}
        </button>
      )}
    </div>
  );
};

export default PlanPicker;
