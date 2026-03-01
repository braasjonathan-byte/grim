import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Check } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";

interface PlanCalibrationDialogProps {
  userId: string;
  onDone: () => void;
}

const DAY_ORDER = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const PlanCalibrationDialog = ({ userId, onDone }: PlanCalibrationDialogProps) => {
  const [sessions, setSessions] = useState<{ week: number; day: string; session_name: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState<{ week: number; day: string } | null>(null);
  const [sessionDate, setSessionDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      const { data } = await supabase
        .from("workout_plans")
        .select("week, day, session_name, details")
        .eq("user_id", userId)
        .gt("week", 0)
        .order("week")
        .order("day");

      if (data) {
        // Only include sessions with actual content
        const unique = data
          .filter(d => d.details && d.details.trim() !== "" && d.session_name.trim() !== "")
          .reduce((acc, d) => {
            const key = `${d.week}-${d.day}`;
            if (!acc.has(key)) {
              acc.set(key, { week: d.week, day: d.day, session_name: d.session_name });
            }
            return acc;
          }, new Map<string, { week: number; day: string; session_name: string }>());
        
        const sorted = Array.from(unique.values()).sort((a, b) => {
          if (a.week !== b.week) return a.week - b.week;
          return DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
        });
        setSessions(sorted);
      }
      setLoading(false);
    };
    fetchSessions();
  }, [userId]);

  const calculateStartDate = (selectedWeek: number, selectedDay: string, date: Date): Date => {
    // Calculate how many days from plan start this session is
    const dayIndex = DAY_ORDER.indexOf(selectedDay);
    const daysFromStart = (selectedWeek - 1) * 7 + (dayIndex >= 0 ? dayIndex : 0);
    return subDays(date, daysFromStart);
  };

  const handleConfirm = async () => {
    if (!selectedSession) return;
    setSaving(true);
    try {
      const startDate = calculateStartDate(selectedSession.week, selectedSession.day, sessionDate);

      const { error } = await supabase
        .from("workout_plans")
        .update({ created_at: startDate.toISOString() })
        .eq("user_id", userId)
        .gt("week", 0);

      if (error) throw error;

      await supabase
        .from("profiles")
        .update({ plan_start_calibrated: true })
        .eq("user_id", userId);

      toast.success("Kalibrering klar!");
      onDone();
    } catch (err) {
      toast.error("Kunde inte spara");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const computedStartDate = selectedSession
    ? calculateStartDate(selectedSession.week, selectedSession.day, sessionDate)
    : null;

  if (loading) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <CalendarDays className="w-10 h-10 text-primary mx-auto animate-pulse" />
        <p className="text-sm text-muted-foreground mt-4">Laddar pass...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <CalendarDays className="w-10 h-10 text-primary mx-auto" />
        <h2 className="text-xl font-black tracking-tight">Kalibrera din träningsplan</h2>
        <p className="text-sm text-muted-foreground">
          Välj ett pass du har gjort och ange datumet du körde det. Startdatumet beräknas automatiskt.
        </p>
      </div>

      {/* Session picker */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Välj ett pass:</p>
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {sessions.map((s) => {
            const isSelected = selectedSession?.week === s.week && selectedSession?.day === s.day;
            return (
              <button
                key={`${s.week}-${s.day}`}
                onClick={() => setSelectedSession({ week: s.week, day: s.day })}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                <span className="font-medium">V{s.week} {s.day}</span>
                <span className="text-muted-foreground truncate">— {s.session_name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedSession && (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              När körde du <span className="text-foreground">V{selectedSession.week} {selectedSession.day}</span>?
            </p>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={sessionDate}
                onSelect={(d) => d && setSessionDate(d)}
                locale={sv}
                className="p-3 pointer-events-auto bg-card border border-border rounded-lg"
              />
            </div>
          </div>

          {computedStartDate && (
            <div className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
              <p className="text-sm font-medium">
                Beräknat startdatum: <span className="text-primary">{format(computedStartDate, "EEEE d MMMM yyyy", { locale: sv })}</span>
              </p>
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saving ? "Sparar..." : "Bekräfta"}
          </button>
        </>
      )}
    </div>
  );
};

export default PlanCalibrationDialog;
