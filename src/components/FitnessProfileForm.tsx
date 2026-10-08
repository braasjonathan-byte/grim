import { useState } from "react";
import { parseNum, validateNumber } from "@/lib/inputValidation";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, ArrowRight, Footprints, Bike } from "lucide-react";
import type { FitnessProfile } from "@/data/planTemplates";
import { FieldError } from "@/components/ConfirmValueDialog";

interface FitnessProfileFormProps {
  userId: string;
  onDone: (profile: FitnessProfile) => void;
  runningOnly?: boolean;
  strengthOnly?: boolean;
  bodyweightOnly?: boolean;
  cyclingOnly?: boolean;
}

const experienceLevels = [
  { value: "nybörjare", label: "Nybörjare", description: "Tränat < 1 år regelbundet" },
  { value: "medel", label: "Medel", description: "Tränat 1–3 år regelbundet" },
  { value: "avancerad", label: "Avancerad", description: "Tränat 3+ år regelbundet" },
];

const FitnessProfileForm = ({ userId, onDone, runningOnly = false, strengthOnly = false, bodyweightOnly = false, cyclingOnly = false }: FitnessProfileFormProps) => {
  const [maxDistance, setMaxDistance] = useState("");
  const [time10km, setTime10km] = useState("");
  const [experience, setExperience] = useState("");
  const [trainingDays, setTrainingDays] = useState("");
  const [ftpWatt, setFtpWatt] = useState("");
  const [maxHeartRate, setMaxHeartRate] = useState("");
  const [avgSpeed, setAvgSpeed] = useState("");
  const [saving, setSaving] = useState(false);

  const ftpError = ftpWatt.trim() ? validateNumber(ftpWatt, { min: 50, max: 600, unit: "watt", optional: true }).error : null;
  const maxHrError = maxHeartRate.trim() ? validateNumber(maxHeartRate, { min: 80, max: 230, unit: "slag/min", integer: true, optional: true }).error : null;
  const avgSpeedError = avgSpeed.trim() ? validateNumber(avgSpeed, { min: 5, max: 70, unit: "km/h", optional: true }).error : null;

  const buildProfile = (): FitnessProfile => ({
    max_distance_km: maxDistance ? parseNum(maxDistance) : null,
    time_10km_min: time10km ? parseNum(time10km) : null,
    experience_level: experience || null,
    training_days_per_week: trainingDays ? parseInt(trainingDays) : null,
    ftp_watt: !ftpError && ftpWatt.trim() ? parseNum(ftpWatt) : null,
    max_heart_rate: !maxHrError && maxHeartRate.trim() ? parseNum(maxHeartRate) : null,
    avg_speed_kmh: !avgSpeedError && avgSpeed.trim() ? parseNum(avgSpeed) : null,
  });

  const handleSave = async () => {
    setSaving(true);
    const profile = buildProfile();
    await supabase
      .from("profiles")
      .update({
        max_distance_km: profile.max_distance_km,
        time_10km_min: profile.time_10km_min,
        experience_level: profile.experience_level,
        training_days_per_week: profile.training_days_per_week,
      })
      .eq("user_id", userId);
    setSaving(false);
    onDone(profile);
  };

  const handleSkip = () => {
    onDone(buildProfile());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        {runningOnly ? (
          <Footprints className="w-10 h-10 text-primary mx-auto" />
        ) : cyclingOnly ? (
          <Bike className="w-10 h-10 text-primary mx-auto" />
        ) : (
          <Dumbbell className="w-10 h-10 text-primary mx-auto" />
        )}
        <h2 className="text-xl font-black tracking-tight">
          {runningOnly ? "Dina löpförutsättningar" : cyclingOnly ? "Dina cykelförutsättningar" : bodyweightOnly ? "Dina träningsförutsättningar" : "Dina förutsättningar"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {runningOnly
            ? "Fyll i så anpassas tempo och distans efter din nivå."
            : cyclingOnly
            ? "Fyll i så anpassas intensiteten (watt, puls eller km/h) efter din nivå. Allt är valfritt."
            : bodyweightOnly
            ? "Fyll i så anpassas övningar och volym efter din nivå."
            : "Fyll i så anpassas planen efter dig. Du kan hoppa över om du vill."}
        </p>
      </div>

      <div className="space-y-4">
        {/* Max distance - hide for strength-only, bodyweight-only and cycling-only */}
        {!strengthOnly && !bodyweightOnly && !cyclingOnly && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground block">
              Max långdistans du kan springa (km)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={maxDistance}
              onChange={(e) => setMaxDistance(e.target.value)}
              placeholder="t.ex. 15"
              className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
        )}

        {/* 10km time - only for running plans, used for running pace */}
        {!strengthOnly && !bodyweightOnly && !cyclingOnly && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground block">
              Tid på 10 km (minuter)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={time10km}
              onChange={(e) => setTime10km(e.target.value)}
              placeholder="t.ex. 55"
              className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
        )}

        {/* Cycling fields - FTP, pulszon/maxpuls, snitthastighet (all optional) */}
        {cyclingOnly && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground block">
                FTP – tröskeleffekt (watt, frivilligt)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={ftpWatt}
                onChange={(e) => setFtpWatt(e.target.value)}
                placeholder="t.ex. 220"
                className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
              <FieldError error={ftpError} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground block">
                Maxpuls (slag/min, frivilligt)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={maxHeartRate}
                onChange={(e) => setMaxHeartRate(e.target.value)}
                placeholder="t.ex. 185"
                className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
              <FieldError error={maxHrError} />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground block">
                Vanlig snitthastighet (km/h, frivilligt)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={avgSpeed}
                onChange={(e) => setAvgSpeed(e.target.value)}
                placeholder="t.ex. 28"
                className="w-full bg-secondary text-foreground text-lg p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
              <FieldError error={avgSpeedError} />
            </div>
          </>
        )}

        {/* Experience level - always show */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground block">
            Träningserfarenhet
          </label>
          <div className="space-y-2">
            {experienceLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => setExperience(level.value)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  experience === level.value
                    ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <span className="font-semibold text-sm">{level.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{level.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Training days per week - show for bodyweight and general, hide for running-only, cycling-only and strength-only */}
        {!runningOnly && !strengthOnly && !cyclingOnly && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground block">
              Tillgängliga träningsdagar per vecka
            </label>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrainingDays(String(d))}
                  className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                    trainingDays === String(d)
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSkip}
          className="flex-1 py-3 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
        >
          Hoppa över
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          Spara & fortsätt <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FitnessProfileForm;
