import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Check, ChevronDown, ChevronUp, Footprints, Info, Pencil, Play, X } from "lucide-react";
import RouteMap from "@/components/RouteMap";
import IntervalRunner from "@/components/IntervalRunner";
import GpsTrackerControl from "@/components/workout/GpsTrackerControl";
import { toTitleCase } from "@/lib/workoutIntervalUtils";
import { type CardioMode, getCardioModes, getCardioDistUnit, modeLabel, modeFieldLabel, modeDisplaySuffix, modePlaceholder, isPaceMode, isLinkedMode, formatPaceDisplay, kmPerTempoUnit } from "@/lib/cardioUnits";

// Enhetlig fältstil för alla konditionsvyer (samma känsla som styrkeövningarna)
export const condInputCls = "w-full min-w-0 bg-background text-foreground text-sm px-3 py-2.5 rounded-xl border border-border outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-center font-bold tabular-nums placeholder:text-muted-foreground/60 placeholder:font-normal placeholder:italic";
export const condUnitCls = "text-[9px] text-muted-foreground uppercase tracking-wider mt-1 block text-center";


export const ConditioningEditCard = ({ name, lineIndex, planId, planCondTime, planCondDist, planCondTempo, planCondPulse, savedData, hasSavedData, exerciseLinesCount, isCompleted = false, onToggleCompleted, onMoveUp, onMoveDown, onShowInfo, onDelete, onSave }: {
  name: string; lineIndex: number; planId: string;
  planCondTime: string; planCondDist: string; planCondTempo: string;
  planCondPulse?: string;
  savedData: Record<string, any> | null; hasSavedData: boolean;
  exerciseLinesCount: number;
  isCompleted?: boolean; onToggleCompleted?: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onShowInfo: () => void; onDelete: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
}) => {
  const isSwim = /simning|simma|sim\b/i.test(name);

  // Per-sport tempo modes (presentation only). First entry is the default.
  type TempoMode = CardioMode;
  const availableModes: TempoMode[] = getCardioModes(name);
  const TEMPO_MODE_KEY = `grim_tempo_mode__${(name || "default").toLowerCase().replace(/\s+/g, "_")}`;
  const [bikeMode, setBikeModeState] = useState<TempoMode>(() => {
    if (typeof window === "undefined") return availableModes[0];
    const v = localStorage.getItem(TEMPO_MODE_KEY) as TempoMode | null;
    return v && (availableModes as string[]).includes(v) ? v : availableModes[0];
  });
  const setBikeMode = (m: TempoMode) => {
    setBikeModeState(m);
    try { localStorage.setItem(TEMPO_MODE_KEY, m); } catch {}
  };
  // Show the mode picker whenever the sport has >1 relevant choice
  const showModePicker = availableModes.length > 1;
  // Effective unit semantics
  const tempoUnit = modeLabel(bikeMode);
  const tempoDisplayUnit = modeDisplaySuffix(bikeMode);
  const distUnitRaw = getCardioDistUnit(name);
  const showDistance = distUnitRaw !== null;
  const distUnit = distUnitRaw ?? "km";

  const [isEditing, setIsEditing] = useState(!hasSavedData);
  const initTime = savedData?.time || planCondTime || "";
  const initDist = savedData?.dist || planCondDist || "";
  const initTempo = savedData?.tempo || planCondTempo || "";
  const initPulse = savedData?.pulse || planCondPulse || "";

  const totalMin = parseFloat(initTime) || 0;
  const [hours, setHours] = useState(() => { const h = Math.floor(totalMin / 60); return h > 0 ? String(h) : ""; });
  const [minutes, setMinutes] = useState(() => { const m = Math.floor(totalMin % 60); return totalMin > 0 ? String(m) : ""; });
  const [seconds, setSeconds] = useState(() => { const s = Math.round((totalMin % 1) * 60); return s > 0 ? String(s) : ""; });
  const [tempo, setTempo] = useState(initTempo);
  const [distance, setDistance] = useState(initDist);
  const [pulse, setPulse] = useState(initPulse);
  const [route, setRoute] = useState<[number, number][]>(() => {
    const r = savedData?.route;
    return Array.isArray(r) ? r as [number, number][] : [];
  });
  const [autoField, setAutoField] = useState<"time" | "tempo" | "distance" | null>(null);
  const [showIntervalRunner, setShowIntervalRunner] = useState(false);
  const isIntervalRun = /intervall/i.test(name);

  const getTotalMin = () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    return h * 60 + m + s / 60;
  };

  const parseTempoToMin = (t: string): number | null => {
    const mm = t.trim().match(/^(\d+)[:\.](\d+)$/);
    if (mm) return parseInt(mm[1]) + parseInt(mm[2]) / 60;
    const mm2 = t.trim().match(/^(\d+(?:[.,]\d+)?)$/);
    if (mm2) return parseFloat(mm2[1].replace(",", "."));
    return null;
  };

  const fmtTempo = (minPerUnit: number): string => {
    const mn = Math.floor(minPerUnit);
    const sc = Math.round((minPerUnit - mn) * 60);
    return `${mn}:${sc.toString().padStart(2, "0")}`;
  };

  // Distance unit per tempo mode: min/100m → 0.1 km per "unit", min/500m → 0.5, others → 1 km
  const kmPerTempoUnit = bikeMode === "min100m" ? 0.1 : bikeMode === "min500m" ? 0.5 : 1;
  // Distansfältet anges i meter för simning, annars i km
  const distIsMeters = distUnit === "m";
  const distToKm = (d: number): number => (distIsMeters ? d / 1000 : d);
  const kmToDist = (km: number): number => (distIsMeters ? km * 1000 : km);
  const distToTempoUnits = (d: number): number => distToKm(d) / kmPerTempoUnit;
  const tempoUnitsToDist = (u: number): number => kmToDist(u * kmPerTempoUnit);

  // Watt / spm / kcal / nivå: ingen relation till tid & distans — endast manuell inmatning.
  const tempoIsLinked = isLinkedMode(bikeMode);


  const liveAutoCalc = (totalMin: number, tempoVal: string, distVal: string, changed: "time" | "tempo" | "distance") => {
    if (!tempoIsLinked) return;
    const t = totalMin;
    const d = parseFloat(distVal.replace(",", "."));
    // For km/h mode, tempo is plain number
    const isKmh = bikeMode === "kmh";
    const tempoNumeric = isKmh ? parseFloat(tempoVal.replace(",", ".")) : NaN;
    const p = isKmh ? (tempoNumeric > 0 ? tempoNumeric : null) : parseTempoToMin(tempoVal);
    const filled = {
      time: t > 0,
      tempo: tempoVal.trim().length > 0 && p !== null && p > 0,
      distance: distVal.trim().length > 0 && !isNaN(d) && d > 0,
    };
    if (!filled[changed]) { if (autoField === changed) setAutoField(null); return; }
    const filledCount = Object.values(filled).filter(Boolean).length;
    if (filledCount < 2) return;
    const missing = (["time", "tempo", "distance"] as const).find(f => !filled[f]);
    const calc = (field: "time" | "tempo" | "distance") => {
      const dUnits = distToTempoUnits(d);
      const dKm = distToKm(d);
      if (isKmh) {
        // km/h: hastighet = distans (km) / tid (timmar)
        if (field === "distance" && t > 0 && p && p > 0) {
          setDistance(String(Math.round(kmToDist(p * t / 60) * 100) / 100));
        } else if (field === "tempo" && t > 0 && dKm > 0) {
          setTempo((60 * dKm / t).toFixed(1));
        } else if (field === "time" && dKm > 0 && p && p > 0) {
          const tot = 60 * dKm / p;
          const hh = Math.floor(tot / 60);
          const rem = tot - hh * 60;
          const mm = Math.floor(rem);
          const ss = Math.round((rem - mm) * 60);
          setHours(hh > 0 ? String(hh) : "");
          setMinutes(String(mm));
          setSeconds(ss > 0 ? String(ss) : "");
        }
        return;
      }

      if (field === "distance" && t > 0 && p && p > 0) {
        const units = t / p;
        setDistance(String(Math.round(tempoUnitsToDist(units) * 100) / 100));
      } else if (field === "tempo" && t > 0 && d > 0) {
        setTempo(fmtTempo(t / dUnits));
      } else if (field === "time" && d > 0 && p && p > 0) {
        const tot = p * dUnits;
        const hh = Math.floor(tot / 60);
        const rem = tot - hh * 60;
        const mm = Math.floor(rem);
        const ss = Math.round((rem - mm) * 60);
        setHours(hh > 0 ? String(hh) : "");
        setMinutes(String(mm));
        setSeconds(ss > 0 ? String(ss) : "");
      }
    };
    if (filledCount === 2 && missing) { calc(missing); setAutoField(missing); return; }
    if (filledCount === 3 && autoField) {
      if (autoField === changed) { setAutoField(null); return; }
      calc(autoField);
    }
  };

  // Räkna om tempofältet till rätt format/värde när enheten byts.
  const prevModeRef = useRef(bikeMode);
  useEffect(() => {
    if (prevModeRef.current === bikeMode) return;
    prevModeRef.current = bikeMode;
    if (!isLinkedMode(bikeMode)) { setTempo(""); setAutoField(null); return; }
    const t = getTotalMin();
    const d = parseFloat(distance.replace(",", "."));
    if (!(t > 0) || !(d > 0)) { setTempo(""); setAutoField(null); return; }
    const dKm = distToKm(d);
    if (bikeMode === "kmh") setTempo((60 * dKm / t).toFixed(1));
    else setTempo(fmtTempo(t / distToTempoUnits(d)));
    setAutoField("tempo");
  }, [bikeMode]);



  const handleSave = async () => {
    const t = getTotalMin();
    const timeStr = t > 0 ? String(Math.round(t * 100) / 100) : "";
    const data: Record<string, any> = {};
    if (timeStr) data.time = timeStr;
    if (distance.trim()) data.dist = distance.trim();
    if (tempo.trim()) data.tempo = tempo.trim();
    if (pulse.trim()) data.pulse = pulse.trim();
    if (route.length > 1) data.route = route;
    // Auto-calc tempo if time + dist (only for linked modes)
    if (tempoIsLinked && data.time && data.dist && !data.tempo) {
      const tVal = parseFloat(data.time);
      const dVal = parseFloat(String(data.dist).replace(",", "."));
      if (tVal > 0 && dVal > 0) {
        if (bikeMode === "kmh") {
          data.tempo = (60 * distToKm(dVal) / tVal).toFixed(1);

        } else {
          const dUnits = distToTempoUnits(dVal);
          const tm = tVal / dUnits;
          const mn = Math.floor(tm);
          const sc = Math.round((tm - mn) * 60);
          data.tempo = `${mn}:${sc.toString().padStart(2, "0")}`;
        }
      }
    }
    await onSave(data);
    setIsEditing(false);
  };

  if (!isEditing) {
    // Compact read-only summary
    const displayTime = savedData?.time || initTime;
    const displayDist = savedData?.dist || initDist;
    const displayTempo = savedData?.tempo || initTempo;
    const displayPulse = savedData?.pulse || initPulse;
    return (
      <div className="bg-primary/10 border border-primary/20 rounded-2xl shadow-soft p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onToggleCompleted && (
              <button onClick={(e) => { e.stopPropagation(); onToggleCompleted(); }} className={`w-8 h-8 shrink-0 border-2 flex items-center justify-center transition-all ${isCompleted ? "bg-success border-success text-success-foreground" : "border-primary/30 text-muted-foreground hover:border-primary"}`} title="Klarmarkera">
                {isCompleted ? <Check className="w-4 h-4" /> : null}
              </button>
            )}
            <span className="font-semibold text-sm text-foreground flex items-center gap-1.5 min-w-0">
              <Footprints className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{toTitleCase(name)}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsEditing(true)} className="p-1 text-primary hover:text-primary/80"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive touch-manipulation"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {displayTime && <p className="text-xs">⏱ <span className="font-mono font-semibold">{displayTime} min</span></p>}
          {displayTempo && <p className="text-xs">🏃 <span className="font-mono font-semibold">{formatPaceDisplay(displayTempo, bikeMode)}{tempoDisplayUnit}</span></p>}
          {displayDist && showDistance && <p className="text-xs">📏 <span className="font-mono font-semibold">{displayDist} {distUnit}</span></p>}

          {displayPulse && <p className="text-xs">❤️ <span className="font-mono font-semibold">{displayPulse} bpm</span></p>}
        </div>
        {Array.isArray(savedData?.route) && (savedData!.route as any[]).length > 1 && (
          <RouteMap route={savedData!.route as [number, number][]} height={180} collapsible defaultOpen={false} />
        )}
      </div>
    );
  }

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-2xl shadow-soft p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleCompleted && (
            <button onClick={(e) => { e.stopPropagation(); onToggleCompleted(); }} className={`w-8 h-8 shrink-0 border-2 flex items-center justify-center transition-all ${isCompleted ? "bg-success border-success text-success-foreground" : "border-primary/30 text-muted-foreground hover:border-primary"}`} title="Klarmarkera">
              {isCompleted ? <Check className="w-4 h-4" /> : null}
            </button>
          )}
          <span className="text-xs font-bold text-primary flex items-center gap-1 min-w-0"><span className="shrink-0">✏️</span> <span className="truncate">{toTitleCase(name)}</span></span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="flex flex-col">
            <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={lineIndex === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={lineIndex === exerciseLinesCount - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onShowInfo(); }} className="p-0.5 text-muted-foreground hover:text-primary transition-colors"><Info className="w-3.5 h-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive touch-manipulation"><X className="w-4 h-4" /></button>
        </div>
      </div>
      {showModePicker && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Enhet</span>
          <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
          {availableModes.map((m) => {
            const label = modeLabel(m);

            return (
              <button
                key={m}
                type="button"
                onClick={(e) => { e.stopPropagation(); setBikeMode(m); }}
                className={`px-3 py-1.5 text-[10px] font-semibold rounded-full transition-all ${bikeMode === m ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
              >{label}</button>
            );
          })}
          </div>
        </div>

      )}
      <GpsTrackerControl
        onStop={(km, sec, gpsRoute) => {
          const totMin = sec / 60;
          const hh = Math.floor(totMin / 60);
          const rem = totMin - hh * 60;
          const mm = Math.floor(rem);
          const ss = Math.round((rem - mm) * 60);
          setHours(hh > 0 ? String(hh) : "");
          setMinutes(String(mm));
          setSeconds(ss > 0 ? String(ss) : "");
          // Swim: convert km → m for the distance field; others use km
          const distVal = isSwim ? Math.round(km * 1000) : Math.round(km * 100) / 100;
          const distStr = String(distVal);
          setDistance(distStr);
          if (gpsRoute.length > 1) setRoute(gpsRoute);
          liveAutoCalc(totMin, tempo, distStr, "distance");
        }}
      />
      {isIntervalRun && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowIntervalRunner(true); }}
          className="w-full h-11 flex items-center justify-center gap-2 px-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-soft hover:bg-primary/90 transition-colors"
        >
          <Play className="w-4 h-4" /> Starta intervallpass
        </button>
      )}
      {isIntervalRun && (
        <IntervalRunner
          open={showIntervalRunner}
          onClose={() => setShowIntervalRunner(false)}
          exerciseName={name}
          onComplete={async (res) => {
            const km = res.gpsDistanceKm && res.gpsDistanceKm > 0 ? res.gpsDistanceKm : res.totalDistKm;
            const totMin = res.totalTimeMin;
            const hh = Math.floor(totMin / 60);
            const rem = totMin - hh * 60;
            const mm = Math.floor(rem);
            const ss = Math.round((rem - mm) * 60);
            setHours(hh > 0 ? String(hh) : "");
            setMinutes(String(mm));
            setSeconds(ss > 0 ? String(ss) : "");
            const distStr = String(Math.round(km * 100) / 100);
            setDistance(distStr);
            setTempo(res.tempo);
            if (res.route && res.route.length > 1) setRoute(res.route);
            // Persist with intervals so per-interval stats work
            await onSave({
              time: String(Math.round(totMin * 100) / 100),
              dist: distStr,
              tempo: res.tempo,
              pulse: pulse.trim() || undefined,
              intervals: res.intervals,
              route: res.route && res.route.length > 1 ? res.route : undefined,
            });
            setIsEditing(false);
          }}
        />
      )}

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Tid</label>
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <input type="number" inputMode="numeric" min="0" value={hours} onChange={(e) => { setHours(e.target.value); const tot = (parseInt(e.target.value) || 0) * 60 + (parseInt(minutes) || 0) + (parseInt(seconds) || 0) / 60; liveAutoCalc(tot, tempo, distance, "time"); }} placeholder="0" className={condInputCls} />
              <span className={condUnitCls}>tim</span>
            </div>
            <div className="min-w-0">
              <input type="number" inputMode="numeric" min="0" max="59" value={minutes} onChange={(e) => { setMinutes(e.target.value); const tot = (parseInt(hours) || 0) * 60 + (parseInt(e.target.value) || 0) + (parseInt(seconds) || 0) / 60; liveAutoCalc(tot, tempo, distance, "time"); }} placeholder="0" className={condInputCls} />
              <span className={condUnitCls}>min</span>
            </div>
            <div className="min-w-0">
              <input type="number" inputMode="numeric" min="0" max="59" value={seconds} onChange={(e) => { setSeconds(e.target.value); const tot = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0) + (parseInt(e.target.value) || 0) / 60; liveAutoCalc(tot, tempo, distance, "time"); }} placeholder="0" className={condInputCls} />
              <span className={condUnitCls}>sek</span>
            </div>
          </div>
        </div>
        <div className={`grid gap-2 ${showDistance ? "grid-cols-2" : "grid-cols-1"}`}>
          <div className="min-w-0">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">{modeFieldLabel(bikeMode, name)}</label>
            <input
              type="text"
              inputMode={isPaceMode(bikeMode) ? "numeric" : "decimal"}
              pattern={isPaceMode(bikeMode) ? "[0-9:]*" : "[0-9.,]*"}
              value={tempo}
              onChange={(e) => { setTempo(e.target.value); liveAutoCalc(getTotalMin(), e.target.value, distance, "tempo"); }}
              onBlur={() => { if (isPaceMode(bikeMode)) { const f = formatPaceDisplay(tempo, bikeMode); if (f && f !== tempo) setTempo(f); } }}
              placeholder={modePlaceholder(bikeMode)}
              className={condInputCls}
            />
          </div>
          {showDistance && (
            <div className="min-w-0">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Distans ({distUnit})</label>
              <input type="number" inputMode="decimal" value={distance} onChange={(e) => { setDistance(e.target.value); liveAutoCalc(getTotalMin(), tempo, e.target.value, "distance"); }} placeholder={planCondDist || (distUnit === "m" ? "400" : "5.0")} className={condInputCls} />
            </div>
          )}
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Snittspuls (bpm)</label>
          <input type="number" inputMode="numeric" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="t.ex. 155" className={condInputCls} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} className="flex-1 h-11 bg-primary text-primary-foreground rounded-full text-sm font-semibold shadow-soft hover:bg-primary/90 active:scale-[0.98] transition-all">Spara</button>
        {hasSavedData && <button onClick={() => setIsEditing(false)} className="px-4 h-11 text-muted-foreground hover:text-foreground text-sm bg-secondary rounded-full transition-colors">Avbryt</button>}
      </div>

    </div>
  );
};

// Small HMS input group for inline conditioning cards (AutoSave-compatible)
export const ConditioningHMSInput = ({ initialH, initialM, initialS, onSave }: {
  initialH: string; initialM: string; initialS: string;
  onSave: (h: string, m: string, s: string) => void;
}) => {
  const [h, setH] = useState(initialH);
  const [m, setM] = useState(initialM);
  const [s, setS] = useState(initialS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = (nh: string, nm: string, ns: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSave(nh, nm, ns), 600);
  };
  const inputCls = "w-12 bg-primary/10 text-foreground text-xs px-1 py-1.5 rounded-md border border-primary/20 outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal";
  return (
    <div className="flex items-center gap-1">
      <input type="number" inputMode="numeric" min="0" value={h} onChange={(e) => { setH(e.target.value); save(e.target.value, m, s); }} placeholder="0" className={inputCls} />
      <span className="text-[10px] text-muted-foreground font-medium">h</span>
      <input type="number" inputMode="numeric" min="0" max="59" value={m} onChange={(e) => { setM(e.target.value); save(h, e.target.value, s); }} placeholder="0" className={inputCls} />
      <span className="text-[10px] text-muted-foreground font-medium">m</span>
      <input type="number" inputMode="numeric" min="0" max="59" value={s} onChange={(e) => { setS(e.target.value); save(h, m, e.target.value); }} placeholder="0" className={inputCls} />
      <span className="text-[10px] text-muted-foreground font-medium">s</span>
    </div>
  );
};

