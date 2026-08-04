import { Route } from "lucide-react";
import {
  type CardioMode,
  getCardioModes,
  getCardioDistUnit,
  modeLabel,
  modePlaceholder,
  isPaceMode,
  formatPaceDisplay,
} from "@/lib/cardioUnits";

const inputCls =
  "w-full min-w-0 bg-background text-foreground text-sm px-3 py-2.5 rounded-xl border border-border outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors text-center font-bold tabular-nums placeholder:text-muted-foreground placeholder:font-normal";
const unitCls = "text-[9px] text-muted-foreground uppercase tracking-wider mt-1 block text-center";

interface CardioLogFieldsProps {
  exerciseName: string;
  mode: CardioMode;
  onModeChange: (m: CardioMode) => void;
  hours: string;
  minutes: string;
  seconds: string;
  onTimeChange: (part: "h" | "m" | "s", value: string) => void;
  tempo: string;
  onTempoChange: (value: string) => void;
  distance: string;
  onDistanceChange: (value: string) => void;
  pulse: string;
  onPulseChange: (value: string) => void;
}

/**
 * Delad inmatning för konditionsövningar: enhetsväljare + tid/tempo/distans/puls.
 * Används av alla vyer där ett konditionspass registreras, så att enheter och
 * etiketter alltid är identiska.
 */
const CardioLogFields = ({
  exerciseName,
  mode,
  onModeChange,
  hours,
  minutes,
  seconds,
  onTimeChange,
  tempo,
  onTempoChange,
  distance,
  onDistanceChange,
  pulse,
  onPulseChange,
}: CardioLogFieldsProps) => {
  const modes = getCardioModes(exerciseName);
  const distUnit = getCardioDistUnit(exerciseName) ?? "km";
  const showDistance = getCardioDistUnit(exerciseName) !== null;

  return (
    <div className="space-y-3">
      {modes.length > 1 && (
        <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1 overflow-x-auto">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={(e) => { e.stopPropagation(); onModeChange(m); }}
              className={`px-3 py-1.5 text-[10px] font-semibold rounded-full whitespace-nowrap transition-all ${
                mode === m ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {modeLabel(m)}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Tid</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="min-w-0">
            <input type="number" inputMode="numeric" min="0" value={hours} onChange={(e) => onTimeChange("h", e.target.value)} placeholder="0" className={inputCls} />
            <span className={unitCls}>tim</span>
          </div>
          <div className="min-w-0">
            <input type="number" inputMode="numeric" min="0" max="59" value={minutes} onChange={(e) => onTimeChange("m", e.target.value)} placeholder="0" className={inputCls} />
            <span className={unitCls}>min</span>
          </div>
          <div className="min-w-0">
            <input type="number" inputMode="numeric" min="0" max="59" value={seconds} onChange={(e) => onTimeChange("s", e.target.value)} placeholder="0" className={inputCls} />
            <span className={unitCls}>sek</span>
          </div>
        </div>
      </div>

      <div className={showDistance ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
        <div className="min-w-0">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block text-center">Tempo</label>
          <input
            type="text"
            inputMode={isPaceMode(mode) ? "numeric" : "decimal"}
            pattern={isPaceMode(mode) ? "[0-9:]*" : "[0-9.,]*"}
            value={tempo}
            onChange={(e) => onTempoChange(e.target.value)}
            onBlur={() => {
              if (isPaceMode(mode)) {
                const f = formatPaceDisplay(tempo, mode);
                if (f && f !== tempo) onTempoChange(f);
              }
            }}
            placeholder={modePlaceholder(mode).replace("t.ex. ", "")}
            className={inputCls}
          />
          <span className={unitCls}>{modeLabel(mode)}</span>
        </div>
        {showDistance && (
          <div className="min-w-0">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-center gap-0.5">
              <Route className="w-3 h-3" /> Distans
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={distance}
              onChange={(e) => onDistanceChange(e.target.value)}
              placeholder={distUnit === "m" ? "400" : "5"}
              className={inputCls}
            />
            <span className={unitCls}>{distUnit}</span>
          </div>
        )}
        <div className="min-w-0">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block text-center">Puls</label>
          <input type="number" inputMode="numeric" value={pulse} onChange={(e) => onPulseChange(e.target.value)} placeholder="155" className={inputCls} />
          <span className={unitCls}>bpm</span>
        </div>
      </div>
    </div>
  );
};

export default CardioLogFields;
