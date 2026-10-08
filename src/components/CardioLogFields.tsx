import { useState } from "react";
import { Route } from "lucide-react";
import {
  type CardioMode,
  getCardioModes,
  getCardioDistUnit,
  modeLabel,
  modeFieldLabel,
  modePlaceholder,
  isPaceMode,
  showCardioPulse,
  formatPaceDisplay,
} from "@/lib/cardioUnits";
import { sanitizePaceInput } from "@/lib/workoutIntervalUtils";
import HeartRateRecorder from "@/components/HeartRateRecorder";

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
  /** Snitt/max/lägsta puls från en inspelning. */
  onHrResult?: (r: { avg: number; max: number; min: number }) => void;
  pulseMax?: string;
  pulseMin?: string;
  /** Watt (t.ex. cykling) – visas parallellt med km/h, inte som ersättning. */
  watt?: string;
  onWattChange?: (value: string) => void;
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
  onHrResult,
  pulseMax,
  pulseMin,
  watt: wattProp,
  onWattChange,
}: CardioLogFieldsProps) => {
  const modes = getCardioModes(exerciseName);
  const distUnit = getCardioDistUnit(exerciseName) ?? "km";
  const showDistance = getCardioDistUnit(exerciseName) !== null;
  const showPulse = showCardioPulse(exerciseName);
  // Cykling (och andra sporter med både km/h och watt) ska alltid visa farten –
  // watt är ett tillägg, inte en ersättning för hastigheten.
  const isBikeLike = modes.includes("kmh") && modes.includes("watt");
  const pillModes = isBikeLike ? modes.filter((m) => m !== "watt") : modes;
  const effectiveMode: CardioMode = isBikeLike && mode === "watt" ? "kmh" : mode;
  const [wattInternal, setWattInternal] = useState("");
  const watt = wattProp ?? wattInternal;
  const setWatt = onWattChange ?? setWattInternal;

  return (
    <div className="space-y-3">
      {pillModes.length > 1 && (
        <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1 overflow-x-auto">
          {pillModes.map((m) => (
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
            <input type="text" inputMode="numeric" min="0" value={hours} onChange={(e) => onTimeChange("h", e.target.value)} placeholder="0" className={inputCls} />
            <span className={unitCls}>tim</span>
          </div>
          <div className="min-w-0">
            <input type="text" inputMode="numeric" min="0" max="59" value={minutes} onChange={(e) => onTimeChange("m", e.target.value)} placeholder="0" className={inputCls} />
            <span className={unitCls}>min</span>
          </div>
          <div className="min-w-0">
            <input type="text" inputMode="numeric" min="0" max="59" value={seconds} onChange={(e) => onTimeChange("s", e.target.value)} placeholder="0" className={inputCls} />
            <span className={unitCls}>sek</span>
          </div>
        </div>
      </div>

      <div className={`grid gap-2 ${[true, isBikeLike, showDistance, showPulse].filter(Boolean).length === 4 ? "grid-cols-2" : [true, isBikeLike, showDistance, showPulse].filter(Boolean).length === 3 ? "grid-cols-3" : [true, isBikeLike, showDistance, showPulse].filter(Boolean).length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        <div className="min-w-0">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block text-center">Tempo</label>
          <input
            type="text"
            inputMode={isPaceMode(effectiveMode) ? "numeric" : "decimal"}
            pattern={isPaceMode(effectiveMode) ? "[0-9:]*" : "[0-9.,]*"}
            value={tempo}
            onChange={(e) => onTempoChange(isPaceMode(effectiveMode) ? sanitizePaceInput(e.target.value) : e.target.value)}
            onBlur={() => {
              if (isPaceMode(effectiveMode)) {
                const f = formatPaceDisplay(tempo, effectiveMode);
                if (f && f !== tempo) onTempoChange(f);
              }
            }}
            placeholder={modePlaceholder(effectiveMode).replace("t.ex. ", "")}
            className={inputCls}
          />
          <span className={unitCls}>{modeLabel(effectiveMode)}</span>
        </div>
        {isBikeLike && (
          <div className="min-w-0">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block text-center">{modeFieldLabel("watt")}</label>
            <input
              type="text"
              inputMode="decimal"
              value={watt}
              onChange={(e) => setWatt(e.target.value)}
              placeholder={modePlaceholder("watt").replace("t.ex. ", "")}
              className={inputCls}
            />
            <span className={unitCls}>Watt</span>
          </div>
        )}
        {showDistance && (
          <div className="min-w-0">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-center gap-0.5">
              <Route className="w-3 h-3" /> Distans
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={distance}
              onChange={(e) => onDistanceChange(e.target.value)}
              placeholder={distUnit === "m" ? "400" : "5"}
              className={inputCls}
            />
            <span className={unitCls}>{distUnit}</span>
          </div>
        )}
        {showPulse && (
          <div className="min-w-0">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block text-center">Puls</label>
            <input type="text" inputMode="numeric" value={pulse} onChange={(e) => onPulseChange(e.target.value)} placeholder="155" className={inputCls} />
            <span className={unitCls}>bpm</span>
          </div>
        )}
      </div>

      {showPulse && onHrResult && (
        <div className="space-y-1.5">
          <HeartRateRecorder onResult={onHrResult} />
          {(pulseMax || pulseMin) && (
            <p className="text-[10px] text-muted-foreground text-center">
              Sparas med passet: snitt {pulse || "–"} bpm · max {pulseMax || "–"} · lägsta {pulseMin || "–"}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CardioLogFields;
