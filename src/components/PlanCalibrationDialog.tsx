import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";

interface PlanCalibrationDialogProps {
  userId: string;
  onDone: () => void;
}

const PlanCalibrationDialog = ({ userId, onDone }: PlanCalibrationDialogProps) => {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Update created_at on all plan rows for this user (non-single workouts)
      const { error } = await supabase
        .from("workout_plans")
        .update({ created_at: startDate.toISOString() })
        .eq("user_id", userId)
        .gt("week", 0);

      if (error) throw error;

      // Mark user as calibrated
      await supabase
        .from("profiles")
        .update({ plan_start_calibrated: true })
        .eq("user_id", userId);

      toast.success("Startdatum sparat!");
      onDone();
    } catch (err) {
      toast.error("Kunde inte spara startdatum");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <CalendarDays className="w-10 h-10 text-primary mx-auto" />
        <h2 className="text-xl font-black tracking-tight">Kalibrera din träningsplan</h2>
        <p className="text-sm text-muted-foreground">
          Välj det datum då din nuvarande träningsplan startade. 
          Detta behövs för att appen ska kunna beräkna rätt vecka och visa korrekt statistik.
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

      <button
        onClick={handleConfirm}
        disabled={saving}
        className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {saving ? "Sparar..." : "Bekräfta startdatum"}
      </button>
    </div>
  );
};

export default PlanCalibrationDialog;
