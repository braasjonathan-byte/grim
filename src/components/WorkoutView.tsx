import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queueOfflineUpsert } from "@/hooks/useOfflineSync";
import { Check, MessageSquare, ChevronDown, ChevronUp, Dumbbell, Footprints, Moon, Bike, ChevronLeft, ChevronRight, LogOut, Plus, Trash2, Search, CalendarIcon, X, TrendingUp, Equal, Weight, MessageCircle, XCircle, Timer, Route, Info, Pencil, Share2, Swords, ArrowLeftRight, Send, Settings, ArrowLeft, Flame, Download, Play, Save, Lock, RefreshCw } from "lucide-react";
import { format, getISOWeek } from "date-fns";
import { sv } from "date-fns/locale";
import PlanPicker from "@/components/PlanPicker";
import PlanCalibrationDialog from "@/components/PlanCalibrationDialog";
import ReplacementWorkoutDialog from "@/components/ReplacementWorkoutDialog";
import WorkoutLogDialog from "@/components/WorkoutLogDialog";
import ExercisePickerDialog from "@/components/ExercisePickerDialog";
import { exerciseLibrary, muscleGroups } from "@/data/exerciseLibrary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { notifyFriendsOfCompletion } from "@/hooks/usePushNotifications";
import ExerciseInfoDialog from "@/components/ExerciseInfoDialog";
import FireworksOverlay from "@/components/FireworksOverlay";
import { Checkbox } from "@/components/ui/checkbox";
import DailyChallenge from "@/components/DailyChallenge";
import WorkoutShareCard from "@/components/WorkoutShareCard";
import AutoSaveInput from "@/components/AutoSaveInput";
import { useSaveIndicator } from "@/components/SaveIndicator";
import EventProgressBar from "@/components/EventProgressBar";
import SpotifyWidget from "@/components/SpotifyWidget";
import { playSetDone, playWorkoutComplete } from "@/lib/sounds";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { normalizeImportedDetails, startsWithTimeNotation } from "@/lib/exerciseNormalization";
import CircuitTimerDialog from "@/components/CircuitTimerDialog";
import { readyWorkoutCategories } from "@/data/readyWorkouts";
import { calculateAchievementMetrics, unlockEarnedAchievements, type AchievementDefinition } from "@/lib/achievements";

const SHOW_STRAVA_INTEGRATION = false;

const toTitleCase = (str: string): string =>
  str.replace(/(^|\s)(\S)/g, (_, space, char) => space + char.toUpperCase());

interface WorkoutViewProps {
  userId: string;
  isAdmin?: boolean;
  isHonorary?: boolean;
  onBack?: () => void;
  adminViewNickname?: string;
}

interface PlanDay {
  id: string;
  week: number;
  day: string;
  session_name: string;
  details: string;
  tempo: string | null;
  is_circuit?: boolean;
}

interface Completion {
  week: number;
  day: string;
  done: boolean;
  skipped: boolean;
  user_comment: string;
  logged_tempo?: string | null;
  logged_pulse?: number | null;
  logged_distance_km?: number | null;
  logged_weights?: Record<string, number> | null;
}

interface FriendComment {
  id: string;
  author_id: string;
  target_user_id: string;
  week: number;
  day: string;
  plan_id: string | null;
  comment: string;
  created_at: string;
}

interface AchievementToastState {
  achievements: AchievementDefinition[];
}

interface CustomExercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
  created_by: string;
  is_bodyweight_exercise?: boolean;
  is_time_based?: boolean;
}

// Inline conditioning editing card (green, open by default)
const ConditioningEditCard = ({ name, lineIndex, planId, planCondTime, planCondDist, planCondTempo, savedData, hasSavedData, exerciseLinesCount, isCompleted = false, onToggleCompleted, onMoveUp, onMoveDown, onShowInfo, onDelete, onSave }: {
  name: string; lineIndex: number; planId: string;
  planCondTime: string; planCondDist: string; planCondTempo: string;
  savedData: Record<string, any> | null; hasSavedData: boolean;
  exerciseLinesCount: number;
  isCompleted?: boolean; onToggleCompleted?: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onShowInfo: () => void; onDelete: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
}) => {
  const [isEditing, setIsEditing] = useState(!hasSavedData);
  const initTime = savedData?.time || planCondTime || "";
  const initDist = savedData?.dist || planCondDist || "";
  const initTempo = savedData?.tempo || planCondTempo || "";
  const initPulse = savedData?.pulse || "";

  // H:M:S state from total minutes
  const totalMin = parseFloat(initTime) || 0;
  const [hours, setHours] = useState(() => { const h = Math.floor(totalMin / 60); return h > 0 ? String(h) : ""; });
  const [minutes, setMinutes] = useState(() => { const m = Math.floor(totalMin % 60); return totalMin > 0 ? String(m) : ""; });
  const [seconds, setSeconds] = useState(() => { const s = Math.round((totalMin % 1) * 60); return s > 0 ? String(s) : ""; });
  const [tempo, setTempo] = useState(initTempo);
  const [distance, setDistance] = useState(initDist);
  const [pulse, setPulse] = useState(initPulse);
  const [autoField, setAutoField] = useState<"time" | "tempo" | "distance" | null>(null);

  const getTotalMin = () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    return h * 60 + m + s / 60;
  };

  const parseTempoToMin = (t: string): number | null => {
    const mm = t.trim().match(/^(\d+)[:\.](\d+)$/);
    if (mm) return parseInt(mm[1]) + parseInt(mm[2]) / 60;
    const mm2 = t.trim().match(/^(\d+)$/);
    if (mm2) return parseInt(mm2[1]);
    return null;
  };

  const fmtTempo = (minPerKm: number): string => {
    const mn = Math.floor(minPerKm);
    const sc = Math.round((minPerKm - mn) * 60);
    return `${mn}:${sc.toString().padStart(2, "0")}`;
  };

  const liveAutoCalc = (totalMin: number, tempoVal: string, distVal: string, changed: "time" | "tempo" | "distance") => {
    const t = totalMin;
    const p = parseTempoToMin(tempoVal);
    const d = parseFloat(distVal.replace(",", "."));
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
      if (field === "distance" && t > 0 && p && p > 0) setDistance(String(Math.round((t / p) * 100) / 100));
      else if (field === "tempo" && t > 0 && d > 0) setTempo(fmtTempo(t / d));
      else if (field === "time" && d > 0 && p && p > 0) {
        const tot = p * d;
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

  const handleSave = async () => {
    const t = getTotalMin();
    const timeStr = t > 0 ? String(Math.round(t * 100) / 100) : "";
    const data: Record<string, any> = {};
    if (timeStr) data.time = timeStr;
    if (distance.trim()) data.dist = distance.trim();
    if (tempo.trim()) data.tempo = tempo.trim();
    if (pulse.trim()) data.pulse = pulse.trim();
    // Auto-calc tempo if time + dist
    if (data.time && data.dist && !data.tempo) {
      const tVal = parseFloat(data.time);
      const dVal = parseFloat(String(data.dist).replace(",", "."));
      if (tVal > 0 && dVal > 0) {
        const tm = tVal / dVal;
        const mn = Math.floor(tm);
        const sc = Math.round((tm - mn) * 60);
        data.tempo = `${mn}:${sc.toString().padStart(2, "0")}`;
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
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-1">
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
          {displayTempo && <p className="text-xs">🏃 <span className="font-mono font-semibold">{displayTempo}/km</span></p>}
          {displayDist && <p className="text-xs">📏 <span className="font-mono font-semibold">{displayDist} km</span></p>}
          {displayPulse && <p className="text-xs">❤️ <span className="font-mono font-semibold">{displayPulse} bpm</span></p>}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-2">
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
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid</label>
          <div className="flex items-center gap-1">
            <input type="number" inputMode="numeric" min="0" value={hours} onChange={(e) => { setHours(e.target.value); const tot = (parseInt(e.target.value) || 0) * 60 + (parseInt(minutes) || 0) + (parseInt(seconds) || 0) / 60; liveAutoCalc(tot, tempo, distance, "time"); }} placeholder="0" className="w-12 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
            <span className="text-[10px] text-muted-foreground font-medium">h</span>
            <input type="number" inputMode="numeric" min="0" max="59" value={minutes} onChange={(e) => { setMinutes(e.target.value); const tot = (parseInt(hours) || 0) * 60 + (parseInt(e.target.value) || 0) + (parseInt(seconds) || 0) / 60; liveAutoCalc(tot, tempo, distance, "time"); }} placeholder="0" className="w-12 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
            <span className="text-[10px] text-muted-foreground font-medium">m</span>
            <input type="number" inputMode="numeric" min="0" max="59" value={seconds} onChange={(e) => { setSeconds(e.target.value); const tot = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0) + (parseInt(e.target.value) || 0) / 60; liveAutoCalc(tot, tempo, distance, "time"); }} placeholder="0" className="w-12 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
            <span className="text-[10px] text-muted-foreground font-medium">s</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo (min/km)</label>
          <input type="text" value={tempo} onChange={(e) => { setTempo(e.target.value); liveAutoCalc(getTotalMin(), e.target.value, distance, "tempo"); }} placeholder="t.ex. 5:30" className="w-24 bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Distans (km)</label>
          <input type="number" inputMode="decimal" value={distance} onChange={(e) => { setDistance(e.target.value); liveAutoCalc(getTotalMin(), tempo, e.target.value, "distance"); }} placeholder={planCondDist || "—"} className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
          <input type="number" inputMode="numeric" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">Spara</button>
        {hasSavedData && <button onClick={() => setIsEditing(false)} className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">Avbryt</button>}
      </div>
    </div>
  );
};

// Small HMS input group for inline conditioning cards (AutoSave-compatible)
const ConditioningHMSInput = ({ initialH, initialM, initialS, onSave }: {
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

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];
const SWEDISH_MONTHS_SHORT = ["jan.", "feb.", "mars", "apr.", "maj", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "dec."];
const MS_PER_DAY = 86400000;

const parseDateKey = (value: string | null | undefined): Date | null => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
};

const toUtcDateKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

const toSafeLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const addUtcDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY);

const formatUtcDate = (date: Date) =>
  `${date.getUTCDate()} ${SWEDISH_MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

const getTodayInfo = () => {
  const now = new Date();
  const dateKey = toSafeLocalDateKey(now);
  const date = parseDateKey(dateKey) ?? new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return {
    date,
    dateKey,
    dayName: DAYS[(date.getUTCDay() + 6) % 7],
    isoWeek: getISOWeek(date),
  };
};

const getSessionIcon = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return Dumbbell;
  if (s.includes("löpning") || s.includes("jogg") || s.includes("långpass") || s.includes("tröskel")) return Footprints;
  if (s.includes("cykel") || s.includes("återhämtning") || s.includes("crosstrainer")) return Bike;
  return Moon;
};

const getSessionColor = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return "text-primary";
  if (s.includes("löpning") || s.includes("tröskel")) return "text-warning";
  if (s.includes("långpass")) return "text-destructive";
  if (s.includes("vila")) return "text-muted-foreground";
  return "text-secondary-foreground";
};

// Format a day key for display - if it looks like an ISO date, format it nicely
const formatDayDisplay = (day: string) => {
  const date = parseDateKey(day);
  if (date) return formatUtcDate(date);
  // Strip any suffix like _abc1 or _1771393847859
  return day.replace(/_[a-z0-9]+$/i, "");
};

const getBaseDay = (day: string) => day.replace(/_[a-z0-9]+$/i, "");

const getDayIndex = (day: string) => {
  const baseDay = getBaseDay(day).trim();
  if (baseDay === "Tor") return 3;
  return DAYS.indexOf(baseDay);
};

const sameWorkoutDay = (a: string, b: string) => {
  const aIndex = getDayIndex(a);
  const bIndex = getDayIndex(b);
  return aIndex >= 0 && bIndex >= 0 ? aIndex === bIndex : getBaseDay(a) === getBaseDay(b);
};

const normalizeExerciseKey = (name: string) =>
  name
    .trim()
    .replace(/\s*—\s*.*$/u, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const isAssistedBodyweightExercise = (name: string) => /assisterad|assisted/i.test(name) && /pull\s*-?\s*ups?|pullups?|chins?|dips/i.test(name);

const isDailyChallengeLabel = (label: string) => label.trim().startsWith("⚔️") || /utmaning:/i.test(label);

const sanitizeCopiedLoggedWeights = (loggedWeights: Record<string, any> | null | undefined) => {
  if (!loggedWeights) return null;

  const cleanedWeights: Record<string, any> = {};
  const copiedExerciseNames: string[] = [];

  for (const [key, value] of Object.entries(loggedWeights)) {
    if (
      key.startsWith("__sets__") ||
        key.startsWith("__cond_done__") ||
      key.startsWith("__wod_rounds_done_") ||
      key.startsWith("__timer_started_") ||
      key.startsWith("__timer_elapsed_") ||
      key.startsWith("__copied_ex__")
    ) {
      continue;
    }

    if (key.startsWith("__setdata__")) {
      const exName = key.substring("__setdata__".length);
      if (isDailyChallengeLabel(exName)) continue;
      if (exName) copiedExerciseNames.push(exName);
    }

    if (isDailyChallengeLabel(key)) continue;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const { checked, done, completed, ...rest } = value as Record<string, any>;
      cleanedWeights[key] = rest;
      continue;
    }

    cleanedWeights[key] = value;
  }

  // Mark each copied exercise so UI can show a progression-reminder note
  for (const exName of copiedExerciseNames) {
    cleanedWeights[`__copied_ex__${exName}`] = "1";
  }

  return Object.keys(cleanedWeights).length > 0 ? cleanedWeights : null;
};

const WEEKDAY_NAMES_SV = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

// Extract date from a single workout day key and return weekday name
const getWeekdayFromDayKey = (day: string): string | null => {
  const date = parseDateKey(day);
  return date ? WEEKDAY_NAMES_SV[date.getUTCDay()] : null;
};

// Compute virtual week number for a single workout based on the earliest workout's Monday
const computeSingleWeek = (dayKey: string, firstMonday: Date): number => {
  const date = parseDateKey(dayKey);
  if (!date) return 1;
  const monday = getMonday(date);
  const diffDays = Math.floor((monday.getTime() - firstMonday.getTime()) / MS_PER_DAY);
  return Math.floor(diffDays / 7) + 1;
};

const getMonday = (d: Date) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  return addUtcDays(date, -day + 1);
};

const toLocalDateKey = toSafeLocalDateKey;

const calendarDayNumber = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY;

const daysBetweenCalendarDates = (from: Date, to: Date) =>
  calendarDayNumber(to) - calendarDayNumber(from);

const getPlanDayDateValue = (planStart: string | null, week: number, dayAbbr: string): Date | null => {
  if (!planStart || week <= 0) return null;

  const startDate = parseDateKey(planStart);
  if (!startDate) return null;
  const startMonday = getMonday(startDate);
  const dayIndex = getDayIndex(dayAbbr);
  if (dayIndex < 0) return null;

  return addUtcDays(startMonday, (week - 1) * 7 + dayIndex);
};

const resolveTodayDayIndex = (weekPlans: PlanDay[], currentWeek: number, planStart: string | null) => {
  if (weekPlans.length === 0) {
    return { index: 0, matchedToday: false };
  }

  const today = getTodayInfo();

  if (planStart && currentWeek > 0) {
    const dateMatchedIndex = weekPlans.findIndex((plan) => {
      const planDate = getPlanDayDateValue(planStart, currentWeek, plan.day);
      return planDate?.getTime() === today.date.getTime();
    });

    if (dateMatchedIndex >= 0) {
      return { index: dateMatchedIndex, matchedToday: true };
    }
  }

  if (!planStart) {
    const todayIndex = getDayIndex(today.dayName);
    const labelMatchedIndex = weekPlans.findIndex((plan) => getDayIndex(plan.day.trim()) === todayIndex);

    if (labelMatchedIndex >= 0) {
      return { index: labelMatchedIndex, matchedToday: true };
    }
  }

  return { index: 0, matchedToday: false };
};

const WorkoutView = ({ userId, isAdmin = false, isHonorary = false, onBack }: WorkoutViewProps) => {
  const { triggerSave } = useSaveIndicator();
  const isMobile = useIsMobile();
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const swipeKey = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [plans, setPlans] = useState<PlanDay[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [currentWeek, setCurrentWeek] = useState(1);
  const [activePlanWeek, setActivePlanWeek] = useState<number | null>(null);
  const [initialWeekSet, setInitialWeekSet] = useState(false);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Archived completions for weight history lookup
  const [archivedCompletions, setArchivedCompletions] = useState<Record<string, any>[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"loading" | "choose" | "plan" | "single">("loading");

  // Single workout form
  const [showAddSingle, setShowAddSingle] = useState(false);
  const [singleName, setSingleName] = useState("");
  const [singleIsCircuit, setSingleIsCircuit] = useState(false);
  const [singleCircuitSeconds, setSingleCircuitSeconds] = useState("40");
  const [singleCircuitRounds, setSingleCircuitRounds] = useState("3");
  const [singleCircuitRest, setSingleCircuitRest] = useState("30");
  const [singleDate, setSingleDate] = useState<Date>(new Date());
  const [showCopyPicker, setShowCopyPicker] = useState(false);
  const [singleCurrentWeek, setSingleCurrentWeek] = useState(getISOWeek(new Date()));
  const [singleActiveDayIdx, setSingleActiveDayIdx] = useState(0);

  // Add extra workout to an already-completed day in plan-week view
  const [addExtraDay, setAddExtraDay] = useState<{ week: number; day: string } | null>(null);
  const [extraName, setExtraName] = useState("");
  const [extraIsCircuit, setExtraIsCircuit] = useState(false);
  const [extraCircuitSeconds, setExtraCircuitSeconds] = useState("40");
  const [extraCircuitRounds, setExtraCircuitRounds] = useState("3");
  const [extraCircuitRest, setExtraCircuitRest] = useState("30");
  const [showExtraCopyPicker, setShowExtraCopyPicker] = useState(false);

  // Exercise browser for single workouts
  const [showExercisePicker, setShowExercisePicker] = useState<string | null>(null); // plan id
  const [isWarmupMode, setIsWarmupMode] = useState(false);
  const [deleteExerciseConfirm, setDeleteExerciseConfirm] = useState<{planId: string; lineIndex: number; name: string} | null>(null);
  const [replaceExerciseTarget, setReplaceExerciseTarget] = useState<{planId: string; lineIndex: number; name: string} | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [showAddCustomExercise, setShowAddCustomExercise] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExCategory, setNewExCategory] = useState("styrka");
  const [newExMuscle, setNewExMuscle] = useState("Helkropp");
  const [stravaSyncing, setStravaSyncing] = useState(false);

  // Weight/reps/sets selection for exercises
  const [weightDialog, setWeightDialog] = useState<{planId: string;exerciseName: string;lastWeight: string | null;} | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("10");
  const [repsUnit, setRepsUnit] = useState<"reps" | "sek">("reps");
  const [setsInput, setSetsInput] = useState("3");

  // Inline editing of existing exercise
  const [editingExercise, setEditingExercise] = useState<{planId: string;lineIndex: number;name: string;originalName: string;sets: string;reps: string;weight: string;} | null>(null);

  // Conditioning exercise dialog
  const [conditioningDialog, setConditioningDialog] = useState<{planId: string;exerciseName: string;} | null>(null);
  const [condTempoInput, setCondTempoInput] = useState("");
  const [condTimeHours, setCondTimeHours] = useState("");
  const [condTimeMinutes, setCondTimeMinutes] = useState("");
  const [condTimeSeconds, setCondTimeSeconds] = useState("");
  const [condDistanceInput, setCondDistanceInput] = useState("");
  const [condAutoField, setCondAutoField] = useState<"time" | "tempo" | "distance" | null>(null);

  // Compute total minutes from H:M:S
  const condTimeTotalMin = (() => {
    const h = parseInt(condTimeHours) || 0;
    const m = parseInt(condTimeMinutes) || 0;
    const s = parseInt(condTimeSeconds) || 0;
    const total = h * 60 + m + s / 60;
    return total > 0 ? total : 0;
  })();
  const condTimeTotalMinStr = condTimeTotalMin > 0 ? String(Math.round(condTimeTotalMin * 100) / 100) : "";

  const setCondTimeFromMinutes = (totalMin: number) => {
    if (totalMin <= 0) { setCondTimeHours(""); setCondTimeMinutes(""); setCondTimeSeconds(""); return; }
    const h = Math.floor(totalMin / 60);
    const rem = totalMin - h * 60;
    const m = Math.floor(rem);
    const s = Math.round((rem - m) * 60);
    setCondTimeHours(h > 0 ? String(h) : "");
    setCondTimeMinutes(String(m));
    setCondTimeSeconds(s > 0 ? String(s) : "");
  };

  const resetCondTime = () => { setCondTimeHours(""); setCondTimeMinutes(""); setCondTimeSeconds(""); };

  const handleCondTimeChange = (field: 'h' | 'm' | 's', value: string, withAutoCalc = true) => {
    if (field === 'h') setCondTimeHours(value);
    else if (field === 'm') setCondTimeMinutes(value);
    else setCondTimeSeconds(value);
    if (withAutoCalc) {
      const h = field === 'h' ? (parseInt(value) || 0) : (parseInt(condTimeHours) || 0);
      const m = field === 'm' ? (parseInt(value) || 0) : (parseInt(condTimeMinutes) || 0);
      const s = field === 's' ? (parseInt(value) || 0) : (parseInt(condTimeSeconds) || 0);
      const total = h * 60 + m + s / 60;
      autoCalcCond(total, condTempoInput, condDistanceInput, "time");
    }
  };
  const [condIntervalsInput, setCondIntervalsInput] = useState("");
  const [condRestInput, setCondRestInput] = useState("");
  const [condPulseInput, setCondPulseInput] = useState("");
  const [condSpmInput, setCondSpmInput] = useState("");

  // Friend comments on own workouts
  const [friendComments, setFriendComments] = useState<FriendComment[]>([]);
  const [commentNicknames, setCommentNicknames] = useState<Record<string, string>>({});

  // Likes on own workouts
  const [workoutLikes, setWorkoutLikes] = useState<{ id: string; user_id: string; week: number; day: string }[]>([]);

  // Replacement workout dialog state
  const [replacementTarget, setReplacementTarget] = useState<{planId: string;sessionName: string;week: number;day: string;} | null>(null);
  const [runLogTarget, setRunLogTarget] = useState<{week: number;day: string;sessionName: string;details: string;} | null>(null);

  // Exercise info dialog
  const [exerciseInfoState, setExerciseInfoState] = useState<{ name: string; editMode?: boolean } | null>(null);

  // Fireworks celebration
  const [showFireworks, setShowFireworks] = useState(false);

  // Edit plan propagation dialog
  const [propagateDialog, setPropagateDialog] = useState<{
    entry: string;
    originalName: string;
    newName: string;
    plan: PlanDay;
    lineIndex: number;
  } | null>(null);

  // Replace exercise propagation dialog
  const [replacePropagateDialog, setReplacePropagateDialog] = useState<{
    oldExerciseName: string;
    newEntry: string;
    sourcePlanId: string;
  } | null>(null);

  // Confirm unchecked sets dialog
  const [uncheckedSetsDialog, setUncheckedSetsDialog] = useState<{
    week: number;
    day: string;
    uncheckedCount: number;
  } | null>(null);

  // Share card
  const [shareTarget, setShareTarget] = useState<{
    plan: PlanDay;
    completion: Completion;
  } | null>(null);
  const [userNickname, setUserNickname] = useState("");

  // Change day / rename session dialogs
  const [changeDayDialog, setChangeDayDialog] = useState<{planId: string; currentDay: string; week: number; sessionName: string} | null>(null);
  const [renameDialog, setRenameDialog] = useState<{planId: string; currentName: string; week: number; day: string; sessionName: string} | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [settingCurrentDay, setSettingCurrentDay] = useState(false);

  // Share to chat
  const [chatShareTarget, setChatShareTarget] = useState<PlanDay | null>(null);
  const [chatFriends, setChatFriends] = useState<{user_id: string; nickname: string}[]>([]);
  const [chatShareSending, setChatShareSending] = useState(false);

  // Copy to date
  const [copyToDateSource, setCopyToDateSource] = useState<PlanDay | null>(null);
  const [copyToDateSelected, setCopyToDateSelected] = useState<Date>(new Date());
  const [copyToDateConflict, setCopyToDateConflict] = useState<"ask" | "replace" | "add" | null>(null);
  const [copyToDateSaving, setCopyToDateSaving] = useState(false);

  // Add week by copying dialog
  const [showAddWeekDialog, setShowAddWeekDialog] = useState(false);
  const [addWeekSourceWeek, setAddWeekSourceWeek] = useState<number | null>(null);
  const [addWeekSaving, setAddWeekSaving] = useState(false);

  // Circuit timer state
  const [circuitTimer, setCircuitTimer] = useState<{ exercises: string[]; workSeconds: number; exerciseSeconds?: number[][]; roundCount: number; restSeconds?: number; weekDayKey: string; headerIndex: number } | null>(null);

  const triggerSetRestTimer = useCallback((wasChecked: boolean) => {
    const setRestTimerEnabled = localStorage.getItem("grim_set_rest_timer_enabled") === "true";
    const setRestTimerSeconds = localStorage.getItem("grim_set_rest_timer_seconds") || "90";
    if (!wasChecked || !setRestTimerEnabled) return;
    const seconds = Math.max(1, Math.round(Number(setRestTimerSeconds) || 0));
    if (!seconds) return;
    window.dispatchEvent(new CustomEvent("grim:start-rest-timer", { detail: { seconds, label: "Vila" } }));
  }, []);

  // Ready workout circuit config from DB
  const [circuitConfigs, setCircuitConfigs] = useState<Set<string>>(new Set());
  useEffect(() => {
    supabase
      .from("ready_workout_config")
      .select("workout_name")
      .eq("is_circuit", true)
      .then(({ data }) => {
        if (data) setCircuitConfigs(new Set(data.map((d: any) => d.workout_name)));
      });
  }, []);

  // Import workout dialog
  const [importWorkoutTarget, setImportWorkoutTarget] = useState<{ planId: string; week: number; day: string } | null>(null);
  // Pending import that needs user choice (replace vs append, then propagation)
  const [pendingImport, setPendingImport] = useState<{
    target: { planId: string; week: number; day: string };
    workout: { name: string; details: string; tempo: string | null };
    step: "conflict" | "propagate";
    mode?: "replace" | "append";
  } | null>(null);

  // Save workout state
  const [saveWorkoutSource, setSaveWorkoutSource] = useState<{ details: string; tempo: string | null; defaultName: string } | null>(null);
  const [saveWorkoutName, setSaveWorkoutName] = useState("");
  const [saveWorkoutVisibility, setSaveWorkoutVisibility] = useState<"private" | "public">("private");
  const [saveWorkoutIsCircuit, setSaveWorkoutIsCircuit] = useState(false);
  const [saveWorkoutSaving, setSaveWorkoutSaving] = useState(false);

  // Saved workouts for import
  const [savedWorkouts, setSavedWorkouts] = useState<{ id: string; name: string; details: string; tempo: string | null; visibility: string; user_id: string }[]>([]);
  useEffect(() => {
    supabase
      .from("saved_workouts")
      .select("id, name, details, tempo, visibility, user_id")
      .then(({ data }) => {
        if (data) setSavedWorkouts(data as any);
      });
  }, []);

  const [openExerciseMenuId, setOpenExerciseMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openExerciseMenuId) return;
    const handleScroll = () => setOpenExerciseMenuId(null);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [openExerciseMenuId]);

  // Profile data for calorie estimation
  const [profileWeight, setProfileWeight] = useState<number | null>(null);
  const [profileGender, setProfileGender] = useState<string | null>(null);
  const [profileAge, setProfileAge] = useState<number | null>(null);
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weightPromptValue, setWeightPromptValue] = useState("");

  // Users allowed to edit exercise descriptions (admin or specific users)
  const EXERCISE_EDITOR_IDS = ["4ddd1300-eeb9-4b33-9c9e-59e3d12c0c04"]; // test2
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      console.log("[WorkoutView] authUser:", data?.user?.id, "isAdmin:", isAdmin);
      if (data?.user) setAuthUserId(data.user.id);
    });
  }, []);
  const canEditExercises = isAdmin || (authUserId ? EXERCISE_EDITOR_IDS.includes(authUserId) : false);

  // Calibration state
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [achievementToast, setAchievementToast] = useState<AchievementToastState | null>(null);

  // Fetch archived completion data for weight history
  useEffect(() => {
    supabase.from("archived_plans").select("completion_data, plan_data").eq("user_id", userId).then(({ data }) => {
      if (data) {
        const allComps: Record<string, any>[] = [];
        for (const archive of data) {
          const completionData = archive.completion_data as any[];
          const planData = archive.plan_data as any[];
          if (completionData) {
            for (const c of completionData) {
              if (c.done && c.logged_weights && Object.keys(c.logged_weights).length > 0) {
                // Attach plan details for fallback text search
                const matchingPlan = planData?.find((p: any) => p.week === c.week && p.day === c.day);
                allComps.push({ ...c, _plan_details: matchingPlan?.details || "", _plan_session_name: matchingPlan?.session_name || "" });
              }
            }
          }
        }
        setArchivedCompletions(allComps);
      }
    });
  }, [userId]);

  // Plan start date from profile (timezone-safe)
  const [planStartDate, setPlanStartDate] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Fetch user nickname + calibration status + body data
  useEffect(() => {
    supabase.from("profiles").select("nickname, plan_start_calibrated, plan_start_date, weight_kg, gender, age").eq("user_id", userId).single().then(({ data }) => {
      if (data) {
        setUserNickname(data.nickname);
        if ((data as any).plan_start_date) {
          setPlanStartDate((data as any).plan_start_date);
        }
        if (!(data as any).plan_start_calibrated) {
          setNeedsCalibration(true);
        }
        if ((data as any).weight_kg) setProfileWeight(parseFloat((data as any).weight_kg));
        if (data.gender) setProfileGender(data.gender);
        if (data.age) setProfileAge(data.age);
      }
      setProfileLoaded(true);
    });
  }, [userId]);

  const fetchData = useCallback(async () => {
    const [{ data: planData }, { data: compData }, { data: friendCommentsData }, { data: likesData }] = await Promise.all([
    supabase.from("workout_plans").select("*").eq("user_id", userId).order("week").order("day"),
    supabase.from("workout_completions").select("*").eq("user_id", userId),
    supabase.from("workout_comments").select("*").eq("target_user_id", userId).order("created_at", { ascending: true }),
    supabase.from("workout_likes").select("*").eq("target_user_id", userId)]
    );

    if (planData) {
      setPlans(planData);
      const wks = [...new Set(planData.map((p) => p.week))].sort((a, b) => a - b);
      setWeeks(wks);

      // Calculate active plan week based on plan start date (timezone-safe)
      const nonSinglePlans = planData.filter(p => p.week > 0);

      // Helper: compute week number from a plan start date string (YYYY-MM-DD) or fallback to created_at
      const computeWeekFromStart = (planWeeks: number[]) => {
        let planStartMonday: Date | null = null;

        // Prefer the explicit plan_start_date (timezone-safe, no UTC conversion issues)
        if (planStartDate) {
          const startDate = parseDateKey(planStartDate);
          planStartMonday = startDate ? getMonday(startDate) : null;
        } else if (nonSinglePlans.length > 0) {
          // Fallback to created_at (may have timezone issues)
          const earliest = nonSinglePlans.reduce((min, p) =>
            (p as any).created_at < (min as any).created_at ? p : min
          );
          planStartMonday = getMonday(new Date((earliest as any).created_at));
        }

        if (!planStartMonday) return null;

        const now = parseDateKey(toLocalDateKey(new Date())) ?? new Date();
        const daysSinceStart = daysBetweenCalendarDates(planStartMonday, now);
        const calcWeek = Math.floor(daysSinceStart / 7) + 1;
        const maxWeek = Math.max(...planWeeks);
        return Math.min(Math.max(calcWeek, 1), maxWeek);
      };

      if (nonSinglePlans.length > 0) {
        const planWeeks = wks.filter(w => w > 0);
        const activeWeek = computeWeekFromStart(planWeeks);
        if (activeWeek) setActivePlanWeek(activeWeek);
      }

      // Auto-navigate to the active (date-based) week on initial load
      if (wks.length > 0 && !initialWeekSet && profileLoaded) {
        // Prefer the date-based active week
        const planWeeks = wks.filter(w => w > 0);
        const dateBasedWeek = computeWeekFromStart(planWeeks);

        let targetWeek: number | undefined;

        if (dateBasedWeek && planWeeks.includes(dateBasedWeek)) {
          // Always use the date-based active week so today's day is shown
          targetWeek = dateBasedWeek;
        } else {
          // Fallback: first week with scheduled workouts forward from dateBasedWeek (or from start if no dateBasedWeek)
          const startFrom = dateBasedWeek ?? 0;
          targetWeek = wks.filter(w => w >= startFrom).find(w => {
            const weekPlans = planData.filter(p => p.week === w && p.session_name.trim() !== "" && p.details.trim() !== "");
            return weekPlans.length > 0;
          });
        }

        setCurrentWeek(targetWeek ?? wks[wks.length - 1]);
        setInitialWeekSet(true);
      }

      if (planData.length === 0) {
        setMode(prev => (prev === "loading" || prev === "choose") ? "choose" : prev);
      } else {
        const allSingle = planData.every((p) => p.week === 0);
        setMode(allSingle ? "single" : "plan");
      }
    }
    // If planData is null (query failed / auth not ready), stay in "loading" and retry
    if (!planData) {
      return;
    }

    if (compData) {
      const map: Record<string, Completion> = {};
      for (const c of compData) {
        map[`${c.week}-${c.day}`] = {
          ...c,
          skipped: (c as any).skipped || false,
          logged_weights: c.logged_weights as Record<string, number> | null
        };
      }
      setCompletions(map);
      const commentMap: Record<string, string> = {};
      for (const c of compData) {
        commentMap[`${c.week}-${c.day}`] = c.user_comment || "";
      }
      setComments((prev) => ({ ...commentMap, ...prev }));
    }

    // Set likes
    setWorkoutLikes((likesData || []) as any);

    // Collect all author IDs from comments and likes
    const allAuthorIds = new Set<string>();
    if (friendCommentsData) friendCommentsData.forEach((c) => allAuthorIds.add(c.author_id));
    if (likesData) (likesData as any[]).forEach((l) => allAuthorIds.add(l.user_id));

    if (friendCommentsData && friendCommentsData.length > 0) {
      setFriendComments(friendCommentsData);
    } else {
      setFriendComments([]);
    }

    if (allAuthorIds.size > 0) {
      const { data: authorProfiles } = await supabase
        .from("profiles")
        .select("user_id, nickname")
        .in("user_id", [...allAuthorIds]);
      if (authorProfiles) {
        const map: Record<string, string> = {};
        for (const p of authorProfiles) map[p.user_id] = p.nickname;
        setCommentNicknames(map);
      }
    }
  }, [userId, initialWeekSet, planStartDate, profileLoaded]);

  useEffect(() => {
    fetchData();
    // Retry once after a short delay if auth session may not be ready yet
    const retryTimer = setTimeout(() => {
      if (mode === "loading") fetchData();
    }, 1500);
    return () => clearTimeout(retryTimer);
  }, [fetchData]);

  // Backfill disabled: automatic plan mutations caused data corruption for users.
  // Tröskellöpning details should be set at plan creation time, not retroactively.

  useEffect(() => {
    if (mode === "single" || mode === "plan") {
      supabase.from("custom_exercises").select("*").order("name").then(({ data }) => {
        if (data) setCustomExercises(data);
      });
    }
  }, [mode]);

  // Sync exercises from plans into custom_exercises so they appear in the picker
  useEffect(() => {
    if (plans.length === 0 || customExercises.length === 0 && plans.length === 0) return;
    const libraryNames = new Set(exerciseLibrary.map(e => e.name.toLowerCase()));
    const customNames = new Set(customExercises.map(e => e.name.toLowerCase()));
    const missing: string[] = [];
    for (const plan of plans) {
      if (!plan.details) continue;
      const lines = plan.details.split(/[\n;]/).map(s => s.trim()).filter(Boolean);
      for (const line of lines) {
        const { name } = parseExerciseWeight(line);
        if (!name || /^vila$/i.test(name.trim()) || /^\d+\s*rundor/i.test(name.trim())) continue;
        const lower = name.trim().toLowerCase();
        if (!libraryNames.has(lower) && !customNames.has(lower) && !missing.includes(lower)) {
          missing.push(lower);
          // Insert with proper casing
          const properName = name.trim();
          supabase.from("custom_exercises").insert({
            name: properName,
            category: "styrka",
            muscle_group: "Helkropp",
            created_by: userId,
          } as any).then(() => {
            customNames.add(lower);
          });
        }
      }
    }
    if (missing.length > 0) {
      // Refresh custom exercises after inserts
      setTimeout(() => {
        supabase.from("custom_exercises").select("*").order("name").then(({ data }) => {
          if (data) setCustomExercises(data);
        });
      }, 1000);
    }
  }, [plans, customExercises.length, userId]);

  const skipDayResetRef = useRef(false);
  const prevWeekRef = useRef(currentWeek);
  const didInitialDayPickRef = useRef(false);
  const pendingInitialDateRealignRef = useRef(false);
  const autoSelectedSingleTodayRef = useRef(false);
  // Reset active day index when week changes — navigate to today's day.
  // Also runs once on initial mount after plans load, so the app opens on today.
  useEffect(() => {
    if (skipDayResetRef.current) {
      skipDayResetRef.current = false;
      return;
    }
    const weekChanged = prevWeekRef.current !== currentWeek;
    const isInitialPick = !didInitialDayPickRef.current && plans.length > 0;
    const shouldRetryInitialDateAlignment = pendingInitialDateRealignRef.current && !!planStartDate;
    if (!weekChanged && !isInitialPick && !shouldRetryInitialDateAlignment) return;

    prevWeekRef.current = currentWeek;

    const weekPlans = plans.filter((p) => p.week === currentWeek);
    const currentWeekDays = DAYS
      .map((dayName) => weekPlans.find((p) => sameWorkoutDay(p.day, dayName)))
      .filter(Boolean) as PlanDay[];

    const { index, matchedToday } = resolveTodayDayIndex(currentWeekDays, currentWeek, planStartDate);

    if (isInitialPick) {
      didInitialDayPickRef.current = true;
      pendingInitialDateRealignRef.current = !matchedToday && currentWeek > 0 && !planStartDate;
    } else if (shouldRetryInitialDateAlignment) {
      pendingInitialDateRealignRef.current = false;
    }

    setActiveDayIndex(index);
    setExpandedDay(null);
  }, [currentWeek, plans, planStartDate]);


  // Auto-expand if the currently shown day has only one session
  useEffect(() => {
    if (!isMobile) return;
    const currentWeekDays = plans
      .filter((p) => p.week === currentWeek)
      .sort((a, b) => getDayIndex(a.day) - getDayIndex(b.day));
    const activePlan = currentWeekDays[activeDayIndex];
    if (!activePlan) return;
    const sameDayPlans = currentWeekDays.filter(p => sameWorkoutDay(p.day, activePlan.day));
    if (sameDayPlans.length === 1) {
      setExpandedDay(`${activePlan.week}-${activePlan.day}`);
    }
  }, [activeDayIndex, currentWeek, plans, isMobile]);

  const allExercises = useMemo(() => {
    const customMap = new Map(customExercises.map(e => [e.name.toLowerCase(), e]));
    const merged = exerciseLibrary
      .filter(e => !customMap.has(e.name.toLowerCase()))
      .map(e => ({ ...e, id: "", isCustom: false, isBodyweightExercise: false }));
    const custom = customExercises.map(e => ({ name: e.name, category: e.category, muscleGroup: e.muscle_group, id: e.id, isCustom: true, isBodyweightExercise: !!e.is_bodyweight_exercise }));
    return [...merged, ...custom].filter(e => !startsWithTimeNotation(e.name));
  }, [customExercises]);

// Compute date for a plan week/day given a plan start date
const getPlanDayDate = (planStart: string | null, week: number, dayAbbr: string): string | null => {
  if (week <= 0) return null;
  if (!planStart) {
    // Fallback: show week + day abbreviation when no start date is set
    return `v${week} ${dayAbbr}`;
  }
  const targetDate = getPlanDayDateValue(planStart, week, dayAbbr);
  if (!targetDate) return null;
  return formatUtcDate(targetDate);
};

// Estimate calories burned for a workout based on exercises, weight, gender, and pulse
const estimateCalories = (
  details: string,
  loggedWeights: Record<string, any> | null,
  loggedPulse: number | null,
  weightKg: number,
  gender: string | null,
  age: number | null
): number => {
  const stravaCalories = Number((loggedWeights as any)?.__strava_calories);
  if (Number.isFinite(stravaCalories) && stravaCalories > 0) {
    return Math.round(stravaCalories);
  }

  let totalMinutes = 0;
  let runDistanceKm = 0; // accumulated running/jogging distance from logged cond data
  const lines = details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  const condRegex = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|(?<![-\w])gång(?![-\w])|intervallträning|stair\s*machine|trappmaskin/i;
  const runRegex = /löpning|jogg|spring|run/i;

  // Collect conditioning time from __cond__ logged data (stored in minutes)
  const condNamesWithTime = new Set<number>();
  if (loggedWeights) {
    for (const [k, v] of Object.entries(loggedWeights)) {
      if (k.startsWith('__cond__')) {
        try {
          const data = typeof v === 'string' ? JSON.parse(v) : v;
          const t = parseFloat(data?.time);
          if (t > 0) {
            totalMinutes += t;
            // Extract line index from key if possible
            const idxMatch = k.match(/__cond__(\d+)$/);
            if (idxMatch) condNamesWithTime.add(parseInt(idxMatch[1]));
          }
          // Capture distance for running activities (Strava-aligned kcal calc)
          const dist = parseFloat(data?.dist);
          if (dist > 0 && runRegex.test(k)) {
            runDistanceKm += dist;
          }
        } catch {}
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip conditioning lines — their time is counted from __cond__ data above
    if (condRegex.test(line)) {
      // Only add time from details text if no __cond__ data was found for this exercise
      if (loggedWeights) {
        // Check if any __cond__ key matches this exercise name
        const hasCondData = Object.keys(loggedWeights).some(k =>
          k.startsWith('__cond__') && (() => {
            try {
              const data = typeof loggedWeights[k] === 'string' ? JSON.parse(loggedWeights[k]) : loggedWeights[k];
              return data?.time && parseFloat(data.time) > 0;
            } catch { return false; }
          })()
        );
        if (hasCondData) continue; // Skip — already counted from __cond__
      }
      // Fallback: parse time from details text
      const timeMatch = line.match(/(\d+(?:[.,]\d+)?)\s*min/i);
      if (timeMatch) {
        totalMinutes += parseFloat(timeMatch[1].replace(",", "."));
      } else {
        totalMinutes += 10; // Default for conditioning without time info
      }
      continue;
    }
    // Check for sets×reps format
    const setsMatch = line.match(/(\d+)\s*[×x]\s*(\d+)/i);
    if (setsMatch) {
      const sets = parseInt(setsMatch[1]);
      // ~1.5 min per set (including rest)
      totalMinutes += sets * 1.5;
      continue;
    }
    // Default: assume ~2 min per exercise line
    totalMinutes += 2;
  }

  if (totalMinutes <= 0) return 0;

  // Sanity cap: max 4 hours for a single session
  totalMinutes = Math.min(totalMinutes, 240);

  // Distance-based calc for running (matches Strava: ~1.036 kcal/kg/km gross).
  // This is the most accurate for outdoor running and is what Strava uses when
  // GPS distance is available. Use it as the primary signal when distance exists.
  const runKcalFromDistance = runDistanceKm > 0
    ? Math.round(1.036 * weightKg * runDistanceKm)
    : 0;

  // Use heart rate based formula if pulse is available (more accurate)
  if (loggedPulse && loggedPulse > 0 && loggedPulse < 250 && age) {
    // Keytel et al. formula (kcal/min)
    let kcalPerMin: number;
    if (gender === 'male') {
      kcalPerMin = (-55.0969 + 0.6309 * loggedPulse + 0.1988 * weightKg + 0.2017 * age) / 4.184;
    } else {
      kcalPerMin = (-20.4022 + 0.4472 * loggedPulse - 0.1263 * weightKg + 0.074 * age) / 4.184;
    }
    if (kcalPerMin > 0) {
      const hrKcal = Math.round(kcalPerMin * totalMinutes);
      // For running, prefer the higher of HR-based and distance-based to align with Strava
      return Math.max(hrKcal, runKcalFromDistance);
    }
  }

  // If we have running distance but no usable pulse, use distance-based estimate
  if (runKcalFromDistance > 0) {
    return runKcalFromDistance;
  }

  // Fallback: MET-based estimate
  // Strength training: MET ~5.0, Cardio: MET ~8.0, average ~6.0
  const avgMET = 6.0;
  const hours = totalMinutes / 60;
  return Math.round(avgMET * weightKg * hours);
};

  const filteredExercises = allExercises.filter((e) => {
    const matchesSearch = !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  // Helper: count unchecked sets for a workout
  const countUncheckedSets = (week: number, day: string): number => {
    const k = `${week}-${day}`;
    // Check ALL plans for this week+day, not just the first one
    const dayPlans = plans.filter(p => p.week === week && p.day === day);
    if (dayPlans.length === 0) return 0;
    let unchecked = 0;
    for (const plan of dayPlans) {
      if (!plan.details) continue;
      const parts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        // Skip daily challenge exercises
        if (part.startsWith("⚔️")) continue;
        // Check if conditioning exercise — skip set tracking for those
        const isCondExercise = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|(?<![-\w])gång(?![-\w])|intervallträning|stair\s*machine|trappmaskin/i.test(part);
        if (isCondExercise) continue;
        // Skip rest/rest day markers
        if (/^(vila|vilodag)/i.test(part)) continue;

        // Use the same name extraction logic as the rendering code
        const { clean: cleanPart } = extractRpe(part);
        const partStructMatch = cleanPart.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
        const fallbackSetsMatch = !partStructMatch ? cleanPart.match(/(\d+)\s*[×x]\s*\S+/) : null;
        const nameMatch = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d)/);
        const exerciseName = nameMatch ? nameMatch[1].trim() : null;
        const pName = partStructMatch ? partStructMatch[1].trim().replace(/\s*—\s*$/, '') : exerciseName || cleanPart;

        const sc = partStructMatch ? parseInt(partStructMatch[2]) : fallbackSetsMatch ? parseInt(fallbackSetsMatch[1]) : 1;
        const setsVal = getSetsDone(k, pName);
        for (let i = 0; i < sc; i++) {
          if (setsVal[i] !== "1") unchecked++;
        }
      }
    }
    return unchecked;
  };

  // Auto-check all sets for a given week/day (used when marking workout as done)
  const autoCheckAllSets = async (week: number, day: string) => {
    const dayPlans = plans.filter(p => p.week === week && p.day === day);
    for (const plan of dayPlans) {
      if (!plan.details) continue;
      const parts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (part.startsWith("⚔️")) continue;
        const isCondExercise = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|(?<![-\w])gång(?![-\w])|intervallträning|stair\s*machine|trappmaskin/i.test(part);
        if (isCondExercise) continue;
        if (/^(vila|vilodag)/i.test(part)) continue;
        const { clean: cleanPart } = extractRpe(part);
        const partStructMatch = cleanPart.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
        const fallbackSetsMatch = !partStructMatch ? cleanPart.match(/(\d+)\s*[×x]\s*\S+/) : null;
        const nameMatch = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d)/);
        const exerciseName = nameMatch ? nameMatch[1].trim() : null;
        const pName = partStructMatch ? partStructMatch[1].trim().replace(/\s*—\s*$/, '') : exerciseName || cleanPart;
        const sc = partStructMatch ? parseInt(partStructMatch[2]) : fallbackSetsMatch ? parseInt(fallbackSetsMatch[1]) : 1;
        const k = `${week}-${day}`;
        const currentSets = getSetsDone(k, pName);
        const allChecked = "1".repeat(sc);
        if (currentSets !== allChecked) {
          const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
          const updated = { ...existing, [`__sets__${pName}`]: allChecked };
          const setDataKey = `__setdata__${pName}`;
          if (!updated[setDataKey]) {
            const circuitSecMatch = plan.is_circuit ? plan.tempo?.match(/^circuit:(\d+)(?::\d+)?(?::\d+)?$/) : null;
            const defReps = partStructMatch ? partStructMatch[3] : (circuitSecMatch ? circuitSecMatch[1] : "10");
            const defKg = partStructMatch && partStructMatch[4] ? partStructMatch[4] : "";
            const initData = Array.from({ length: sc }, () => ({ kg: defKg, reps: defReps }));
            updated[setDataKey] = JSON.stringify(initData);
          }
          await safeUpsertCompletion(week, day, { logged_weights: updated });
        }
      }
    }
  };

  const toggleDone = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newDone = !current?.done;

    // If marking as done, check for unchecked sets first and show dialog
    if (newDone) {
      const unchecked = countUncheckedSets(week, day);
      if (unchecked > 0) {
        setUncheckedSetsDialog({ week, day, uncheckedCount: unchecked });
        return;
      }
    }

    await performToggleDone(week, day);
  };

  const performToggleDone = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newDone = !current?.done;

    setCompletions((prev) => ({
      ...prev,
      [key]: { ...prev[key], week, day, done: newDone, skipped: false, user_comment: comments[key] || "" }
    }));

    await safeUpsertCompletion(week, day, {
      done: newDone,
      skipped: false,
      user_comment: comments[key] || "",
    });

    if (newDone) {
      const plan = plans.find((p) => p.week === week && p.day === day);
      notifyFriendsOfCompletion(day, week, plan?.session_name || day, planStartDate);
      checkAchievementUnlocks({ ...completions, [key]: { ...current, week, day, done: true, skipped: false, user_comment: comments[key] || "" } });

      if (week > 0) {
        const weekPlans = plans.filter((p) => p.week === week);
        const scheduledPlans = weekPlans.filter((p) => p.session_name.trim() !== "" && p.details.trim() !== "");
        const updatedCompletions = { ...completions, [key]: { week, day, done: true, skipped: false, user_comment: comments[key] || "" } };
        const allDone = scheduledPlans.length > 0 && scheduledPlans.every((p) => {
          const k = `${p.week}-${p.day}`;
          return updatedCompletions[k]?.done;
        });
        if (allDone) {
          setShowFireworks(true);
        }
      }
    }
  };

  const checkAchievementUnlocks = async (nextCompletions: Record<string, Completion>) => {
    const [{ count: challengeCount }, { data: planData }, { data: archiveData }] = await Promise.all([
      supabase.from("daily_challenge_completions").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("workout_plans").select("week, day, details, tempo").eq("user_id", userId),
      supabase.from("archived_plans").select("completion_data, plan_data").eq("user_id", userId),
    ]);
    const detailMap = new Map((planData || []).map((p: any) => [`${p.week}-${p.day}`, JSON.stringify({ details: p.details || "", tempo: p.tempo || "" })]));
    const archivedCompletions = ((archiveData || []) as any[]).flatMap((archive) => {
      const archivePlans = Array.isArray(archive.plan_data) ? archive.plan_data : [];
      return (Array.isArray(archive.completion_data) ? archive.completion_data : []).map((completion: any) => {
        const plan = archivePlans.find((p: any) => Number(p.week) === Number(completion.week) && String(p.day) === String(completion.day));
        return { ...completion, plan_details: plan ? JSON.stringify({ details: plan.details || "", tempo: plan.tempo || "" }) : null };
      });
    });
    const metrics = calculateAchievementMetrics(
      [...Object.entries(nextCompletions).map(([entryKey, completion]) => ({
        ...completion,
        plan_details: detailMap.get(entryKey) ?? null,
      })), ...archivedCompletions],
      challengeCount || 0,
    );
    const newAchievements = await unlockEarnedAchievements(userId, metrics);
    if (newAchievements.length > 0) {
      setAchievementToast({ achievements: newAchievements });
      toast.success(`Achievement upplåst: ${newAchievements[0].title}`);
    }
  };

  const toggleSkipped = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newSkipped = !current?.skipped;

    setCompletions((prev) => ({
      ...prev,
      [key]: { ...prev[key], week, day, done: false, skipped: newSkipped, user_comment: comments[key] || "" }
    }));

    await safeUpsertCompletion(week, day, {
      done: false,
      skipped: newSkipped,
      user_comment: comments[key] || "",
    });
  };

  const saveComment = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const newText = commentInput[key]?.trim();
    if (!newText) return;

    const existing = comments[key]?.trim();
    const updated = existing ? `${existing}\n${newText}` : newText;

    setComments((prev) => ({ ...prev, [key]: updated }));
    setCommentInput((prev) => ({ ...prev, [key]: "" }));

    await safeUpsertCompletion(week, day, { user_comment: updated });
  };

  const deleteCommentLine = async (week: number, day: string, lineIndex: number) => {
    const key = `${week}-${day}`;
    const lines = (comments[key] || "").split("\n").filter(Boolean);
    lines.splice(lineIndex, 1);
    const updated = lines.join("\n");
    setComments((prev) => ({ ...prev, [key]: updated }));
    await safeUpsertCompletion(week, day, { user_comment: updated });
  };

  const deleteFriendComment = async (commentId: string) => {
    await supabase.from("workout_comments").delete().eq("id", commentId);
    setFriendComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const syncStravaNow = async (plan: PlanDay) => {
    setStravaSyncing(true);
    const { data, error } = await supabase.functions.invoke("strava-sync", {
      body: {
        mode: "user",
        limit: 1,
        source: "workout-card",
        targetWorkout: { week: plan.week, day: plan.day },
      },
    });
    setStravaSyncing(false);
    if (error || data?.error || data?.results?.[0]?.error) {
      toast.error("Kunde inte synka från Strava.");
      return;
    }
    const imported = data?.results?.[0]?.imported ?? 0;
    const applied = data?.results?.[0]?.applied ?? imported;
    toast.success(applied > 0 ? "Strava-pass synkat till kortet." : "Inget matchande Strava-pass hittades för kortet.");
    fetchData();
  };

  // Set completion tracking helpers
  const getSetsDone = (weekDayKey: string, exerciseName: string): string => {
    const comp = completions[weekDayKey];
    const weights = comp?.logged_weights as Record<string, any> | null;
    return (weights?.[`__sets__${exerciseName}`] as string) || "";
  };

  const isConditioningDone = (weekDayKey: string, condName: string): boolean => {
    const weights = completions[weekDayKey]?.logged_weights as Record<string, any> | null;
    return weights?.[`__cond_done__${condName}`] === "1";
  };

  const toggleConditioningDone = async (week: number, day: string, condName: string) => {
    const key = `${week}-${day}`;
    const currentlyDone = isConditioningDone(key, condName);
    if (!currentlyDone) { playSetDone(); hapticLight(); }
    await updateCompletionWeights(week, day, (existing) => ({
      ...existing,
      [`__cond_done__${condName}`]: currentlyDone ? "0" : "1",
    }));
  };

  // Safe upsert that always preserves ALL existing fields to prevent data loss
  const safeUpsertCompletion = async (
    week: number,
    day: string,
    updates: Partial<Completion & { logged_weights: Record<string, any> | null }>
  ) => {
    const entryKey = `${week}-${day}`;

    // Build payload from current state synchronously using a promise that resolves inside setState
    const payload = await new Promise<Record<string, any>>((resolve) => {
      setCompletions((prev: Record<string, any>) => {
        const prevComp = prev[entryKey] || {};
        const merged = {
          week,
          day,
          done: prevComp.done || false,
          skipped: prevComp.skipped || false,
          user_comment: prevComp.user_comment || "",
          logged_tempo: prevComp.logged_tempo ?? null,
          logged_pulse: prevComp.logged_pulse ?? null,
          logged_distance_km: prevComp.logged_distance_km ?? null,
          logged_weights: prevComp.logged_weights ?? null,
          ...updates,
        };

        resolve(merged);

        return {
          ...prev,
          [entryKey]: merged as any,
        };
      });
    });

    const upsertData = {
        user_id: userId,
        week,
        day,
        done: payload.done,
        skipped: payload.skipped,
        user_comment: payload.user_comment,
        logged_tempo: payload.logged_tempo,
        logged_pulse: payload.logged_pulse,
        logged_distance_km: payload.logged_distance_km,
        logged_weights: payload.logged_weights,
      };

    // Queue to localStorage first so data survives if the page is killed before network completes
    queueOfflineUpsert("workout_completions", upsertData as any, "user_id,week,day");

    const { error } = await supabase.from("workout_completions").upsert(
      upsertData as any,
      { onConflict: "user_id,week,day" }
    );

    // If network save succeeded, remove from offline queue (it will be a duplicate but harmless)
    if (!error) {
      // Clear the queued item since it saved successfully
      try {
        const raw = localStorage.getItem("grim_offline_queue");
        if (raw) {
          const queue = JSON.parse(raw) as any[];
          // Remove matching items (same table + user + week + day)
          const filtered = queue.filter((item: any) =>
            !(item.table === "workout_completions" &&
              item.data.user_id === userId &&
              item.data.week === week &&
              item.data.day === day)
          );
          localStorage.setItem("grim_offline_queue", JSON.stringify(filtered));
        }
      } catch { /* ignore */ }
    }
    triggerSave();
  };

  const updateCompletionWeights = async (
    week: number,
    day: string,
    updater: (current: Record<string, any>) => Record<string, any>
  ) => {
    const entryKey = `${week}-${day}`;

    // Compute the new weights using current state via promise
    const nextWeights = await new Promise<Record<string, any>>((resolve) => {
      setCompletions((prev: Record<string, any>) => {
        const prevComp = prev[entryKey] || {};
        const currentWeights = (prevComp.logged_weights || {}) as Record<string, any>;
        resolve(updater(currentWeights));
        return prev; // Don't update yet - safeUpsertCompletion will do it
      });
    });

    await safeUpsertCompletion(week, day, { logged_weights: nextWeights });
  };

  const toggleSetDone = async (week: number, day: string, exerciseName: string, setIndex: number, totalSets: number, defaultKg?: string, defaultReps?: string) => {
    const k = `${week}-${day}`;
    const current = getSetsDone(k, exerciseName);
    const arr = Array.from({ length: totalSets }, (_, i) => current[i] === "1");
    arr[setIndex] = !arr[setIndex];
    if (arr[setIndex]) {
      playSetDone();
      hapticLight();
      triggerSetRestTimer(true);
    }
    const setsStr = arr.map(b => b ? "1" : "0").join("");

    const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
    const updated = { ...existing, [`__sets__${exerciseName}`]: setsStr };

    // Circuit sync: if this exercise belongs to a circuit, check if all exercises' set at setIndex are done
    const plan0 = plans.find(p => p.week === week && p.day === day);
    if (plan0) {
      const syncParts = plan0.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      // Find which circuit block this exercise belongs to
      let circuitHeader: { headerIndex: number; roundCount: number; exerciseNames: string[] } | null = null;
      let currentCirc: { headerIndex: number; roundCount: number; exerciseNames: string[] } | null = null;
      for (let pi = 0; pi < syncParts.length; pi++) {
        const p = syncParts[pi].trim();
        const cm = p.match(/^(\d+)\s+(?:rundor|cirklar)(?:\s+à\s+\d+\s*min)?\s*:(.*)/i);
        const am = !cm ? p.match(/^(\d+)\s*(min\s+)?amrap\s*:(.*)/i) : null;
        if (cm || am) {
          const inlineExs = ((cm ? cm[2] : am![3]) || "").trim();
          if (!inlineExs) {
            currentCirc = { headerIndex: pi, roundCount: parseInt((cm || am)![1]), exerciseNames: [] };
          } else {
            currentCirc = null;
          }
        } else if (currentCirc) {
          const { name: eName } = parseExerciseWeight(p);
          if (!/^vila$/i.test(eName.trim())) {
            currentCirc.exerciseNames.push(eName);
            if (eName.toLowerCase() === exerciseName.toLowerCase()) {
              circuitHeader = currentCirc;
            }
          } else {
            currentCirc = null;
          }
        }
      }
      if (circuitHeader) {
        const roundKey = `__wod_rounds_done_${circuitHeader.headerIndex}__`;
        const currentRoundsStr = (updated[roundKey] as string) || "";
        // Check if all exercises in this circuit have set setIndex done
        const allDoneForSet = circuitHeader.exerciseNames.every(en => {
          const setKey = `__sets__${en}`;
          const val = en.toLowerCase() === exerciseName.toLowerCase() ? setsStr : ((updated[setKey] as string) || "");
          return val[setIndex] === "1";
        });
        const newRounds = Array.from({ length: circuitHeader.roundCount }, (_, ri) => {
          if (ri === setIndex) return allDoneForSet ? "1" : "0";
          return currentRoundsStr[ri] || "0";
        }).join("");
        updated[roundKey] = newRounds;
      }
    }

    // Ensure __setdata__ exists so kg/reps are always persisted for stats
    const setDataKey = `__setdata__${exerciseName}`;
    if (!updated[setDataKey]) {
      const dkg = defaultKg || "";
      const dreps = defaultReps || "10";
      const initData = Array.from({ length: totalSets }, () => ({ kg: dkg, reps: dreps }));
      updated[setDataKey] = JSON.stringify(initData);
      if (isAssistedBodyweightExercise(exerciseName)) updated[`__bw_mode__${exerciseName}`] = "sub";
    }

    // Do NOT auto-complete the whole workout when all sets are checked.
    // The user must explicitly mark the workout as done.
    const plan = plans.find(p => p.week === week && p.day === day);
    const allExercisesDone = false;

    const newDone = completions[k]?.done || false;

    setCompletions(prev => ({
      ...prev,
      [k]: { ...prev[k], week, day, done: newDone, skipped: prev[k]?.skipped || false, user_comment: prev[k]?.user_comment || "", logged_weights: updated }
    }));

    await safeUpsertCompletion(week, day, {
      done: newDone,
      logged_weights: updated,
    });

    // Notify friends and check fireworks if workout was just completed
    if (allExercisesDone && !completions[k]?.done && plan0) {
      playWorkoutComplete();
      notifyFriendsOfCompletion(day, week, plan.session_name || day, planStartDate);

      // Check if all scheduled workouts in this week are now done
      if (week > 0) {
        const weekPlans = plans.filter(p => p.week === week);
        const scheduledPlans = weekPlans.filter(p => p.session_name.trim() !== "" && p.details.trim() !== "");
        const updatedCompletions = { ...completions, [k]: { ...completions[k], week, day, done: true } };
        const allWeekDone = scheduledPlans.length > 0 && scheduledPlans.every(p => {
          const wk = `${p.week}-${p.day}`;
          return updatedCompletions[wk]?.done;
        });
        if (allWeekDone) {
          setShowFireworks(true);
        }
      }
    }
  };

  // Modify set count for an exercise in a plan
  const modifySetCount = async (planId: string, exerciseIndex: number, delta: number, week: number, day: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    const line = lines[exerciseIndex];
    if (!line) return;

    // Match "NxM" pattern (sets x reps)
    const setsMatch = line.match(/(\d+)\s*([×x])\s*(\S+)/i);
    if (setsMatch) {
      const oldSets = parseInt(setsMatch[1]);
      const newSets = Math.max(1, oldSets + delta);
      if (newSets === oldSets) return;
      lines[exerciseIndex] = line.replace(/\d+\s*[×x]/i, `${newSets}×`);
    } else {
      // No sets pattern found - add one
      const { name, weight } = parseExerciseWeight(line);
      if (delta > 0) {
        const newSets = 1 + delta;
        lines[exerciseIndex] = weight ? `${name} — ${newSets}×10 @ ${weight}` : `${name} — ${newSets}×10`;
      } else return;
    }

    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", planId);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, details: newDetails } : p));
    triggerSave();

    // Adjust set tracking data
    const k = `${week}-${day}`;
    const partName = parseExerciseWeight(lines[exerciseIndex]).name;
    const currentSetsStr = getSetsDone(k, partName);
    const currentSetData = getSetData(k, partName);
    
    if (delta > 0) {
      // Add a set - extend tracking
      const newSetsStr = currentSetsStr + "0";
      const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
      const updated = { ...existing, [`__sets__${partName}`]: newSetsStr };
      delete updated[`__copied_ex__${partName}`];
      setCompletions(prev => ({
        ...prev,
        [k]: { ...prev[k], week, day, done: prev[k]?.done || false, skipped: prev[k]?.skipped || false, user_comment: prev[k]?.user_comment || "", logged_weights: updated }
      }));
      await safeUpsertCompletion(week, day, { logged_weights: updated });
    } else if (delta < 0 && currentSetsStr.length > 1) {
      // Remove last set
      const newSetsStr = currentSetsStr.slice(0, -1);
      const newSetData = currentSetData.slice(0, -1);
      const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
      const updated = { ...existing, [`__sets__${partName}`]: newSetsStr, [`__setdata__${partName}`]: JSON.stringify(newSetData) };
      delete updated[`__copied_ex__${partName}`];
      setCompletions(prev => ({
        ...prev,
        [k]: { ...prev[k], week, day, done: prev[k]?.done || false, skipped: prev[k]?.skipped || false, user_comment: prev[k]?.user_comment || "", logged_weights: updated }
      }));
      await safeUpsertCompletion(week, day, { logged_weights: updated });
    }
  };

  // Get per-set logged data (kg/reps)
  const getSetData = (weekDayKey: string, exerciseName: string): Array<{kg: string; reps: string}> => {
    const comp = completions[weekDayKey];
    const weights = comp?.logged_weights as Record<string, any> | null;
    const raw = weights?.[`__setdata__${exerciseName}`] ?? weights?.[`__setdata__${normalizeExerciseKey(exerciseName)}`];
    if (raw) {
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
      }
      if (Array.isArray(raw)) return raw;
    }
    return [];
  };

  const saveSetFieldData = async (week: number, day: string, exerciseName: string, setIndex: number, field: 'kg' | 'reps', value: string, totalSets: number, defaultKg: string, defaultReps: string) => {
    const k = `${week}-${day}`;
    const currentData = getSetData(k, exerciseName);
    const data = Array.from({ length: totalSets }, (_, i) => currentData[i] || { kg: defaultKg, reps: defaultReps });
    data[setIndex] = { ...data[setIndex], [field]: value };

    await updateCompletionWeights(week, day, (existing) => {
      const next = {
        ...existing,
        [`__setdata__${exerciseName}`]: JSON.stringify(data),
      };
      // User adjusted kg/reps -> clear progression reminder for this exercise
      delete next[`__copied_ex__${exerciseName}`];
      if (field === 'kg' && isAssistedBodyweightExercise(exerciseName)) next[`__bw_mode__${exerciseName}__${setIndex}`] = "sub";
      return next;
    });
  };

  // Check if exercise was copied from a previous workout and not yet adjusted
  const isCopiedExercise = (weekDayKey: string, exerciseName: string): boolean => {
    const comp = completions[weekDayKey];
    const weights = comp?.logged_weights as Record<string, any> | null;
    return weights?.[`__copied_ex__${exerciseName}`] === "1" || weights?.[`__copied_ex__${normalizeExerciseKey(exerciseName)}`] === "1";
  };

  // Extract RPE from exercise text
  const extractRpe = (text: string): { clean: string; rpe: string | null } => {
    const m = text.match(/(?:\s*@\s*|\s+)RPE\s*([\d.]+)/i);
    if (m) return { clean: text.replace(m[0], '').trim(), rpe: `RPE ${m[1]}` };
    return { clean: text, rpe: null };
  };

  // Helper: parse tempo string like "5:30" to seconds
  const tempoToSeconds = (t: string): number | null => {
    const m = t.match(/^(\d+)[:\.](\d+)$/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
    const m2 = t.match(/^(\d+)$/);
    if (m2) return parseInt(m2[1]) * 60;
    return null;
  };

  // Helper: seconds back to "m:ss"
  const secondsToTempo = (s: number): string => {
    const totalSec = Math.round(s);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  // Adaptive progression: adjust ALL future weeks based on logged results
  // adaptProgression removed: automatic plan mutations caused data corruption.
  // Progression is now only applied when the user explicitly chooses "Alla framtida" in the edit dialog.

  // Add a new week by copying from a source week
  const addWeekByCopy = async (sourceWeek: number) => {
    setAddWeekSaving(true);
    try {
      const planWeeks = weeks.filter(w => w > 0);
      const newWeekNum = planWeeks.length > 0 ? Math.max(...planWeeks) + 1 : 1;
      const sourcePlans = plans.filter(p => p.week === sourceWeek);
      
      if (sourcePlans.length === 0) {
        toast.error("Inga pass att kopiera från den veckan");
        return;
      }

      const inserts = sourcePlans.map(p => ({
        user_id: userId,
        week: newWeekNum,
        day: p.day,
        session_name: p.session_name,
        details: stripChallengeLines(p.details || ""),
        tempo: p.tempo || "",
        is_circuit: p.is_circuit || false,
      } as any));

      const { error } = await supabase.from("workout_plans").insert(inserts);
      if (error) throw error;

      toast.success(`Vecka ${newWeekNum} skapad (kopierad från V${sourceWeek})`);
      setShowAddWeekDialog(false);
      setAddWeekSourceWeek(null);
      await fetchData();
      setCurrentWeek(newWeekNum);
    } catch (err) {
      toast.error("Kunde inte lägga till vecka");
    } finally {
      setAddWeekSaving(false);
    }
  };

  const leavePlan = async () => {
    if (!confirm("Är du säker? Schemat arkiveras under din profil innan det tas bort.")) return;

    // Archive plan data before deleting
    try {
      const [{ data: planData }, { data: compData }] = await Promise.all([
        supabase.from("workout_plans").select("*").eq("user_id", userId),
        supabase.from("workout_completions").select("*").eq("user_id", userId),
      ]);

      if (planData && planData.length > 0) {
        // Derive plan name from first non-empty session
        const firstSession = planData.find(p => p.session_name.trim() !== "");
        const planName = firstSession ? `Schema (${planData.filter(p => p.session_name.trim() !== "").length} pass, ${[...new Set(planData.map(p => p.week))].length} veckor)` : "Schema";

        await supabase.from("archived_plans").insert({
          user_id: userId,
          plan_name: planName,
          plan_data: planData as any,
          completion_data: (compData || []) as any,
          plan_start_date: planStartDate,
        } as any);
      }
    } catch (e) {
      console.error("Failed to archive plan:", e);
    }

    // Only delete plans, keep completions so stats (done count, distance) persist
    await supabase.from("workout_plans").delete().eq("user_id", userId);
    setPlans([]);
    setWeeks([]);
    setCompletions({});
    setMode("choose");
  };

  const addSingleWorkout = async (copyFrom?: PlanDay) => {
    const name = copyFrom ? copyFrom.session_name : singleName.trim();
    if (!name) return;

    // Use date + short random suffix for unique day key
    const dateStr = format(singleDate, "yyyy-MM-dd");
    const uniqueKey = `${dateStr}_${Math.random().toString(36).slice(2, 6)}`;

    // Copy details without daily challenges (no progression for single sessions)
    let details = "";
    if (copyFrom && copyFrom.details) {
      details = stripChallengeLines(copyFrom.details);
    }

    await supabase.from("workout_plans").insert({
      user_id: userId,
      week: 0,
      day: uniqueKey,
      session_name: name,
      details,
      tempo: (copyFrom ? copyFrom.tempo : (singleIsCircuit ? `circuit:${parseInt(singleCircuitSeconds) || 40}:${parseInt(singleCircuitRounds) || 3}:${parseInt(singleCircuitRest) || 0}` : null)),
      is_circuit: copyFrom ? (copyFrom.is_circuit || false) : singleIsCircuit
    } as any);
    setSingleIsCircuit(false);
    setSingleCircuitSeconds("40");
    setSingleCircuitRounds("3");
    setSingleCircuitRest("30");

    // Copy logged weights/reps from the source workout's completion,
    // but strip per-set "checked" flags so the new pass starts unmarked.
    if (copyFrom) {
      const sourceKey = `${copyFrom.week}-${copyFrom.day}`;
      const sourceCompletion = completions[sourceKey];
      const cleanedWeights = sanitizeCopiedLoggedWeights(sourceCompletion?.logged_weights as Record<string, any> | null | undefined);
      if (cleanedWeights) {
        await supabase.from("workout_completions").upsert({
          user_id: userId,
          week: 0,
          day: uniqueKey,
          done: false,
          skipped: false,
          logged_weights: cleanedWeights,
        }, { onConflict: "user_id,week,day" });
      }
    }

    // Navigate to the week of the new workout
    const dateMatch = uniqueKey.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const newWeek = getISOWeek(parseDateKey(dateMatch[1]) ?? new Date());
      setSingleCurrentWeek(newWeek);
    }

    setSingleName("");
    setSingleDate(new Date());
    setShowAddSingle(false);
    setShowCopyPicker(false);
    if (copyFrom) {
      toast.success("Pass kopierat med vikter & reps från förra gången. Öka själv för progression! 💪");
    }
    fetchData();
  };

  // Add an EXTRA workout to an already-existing plan day (week>0 plan view)
  const addExtraWorkoutToDay = async (week: number, day: string, copyFrom?: PlanDay) => {
    const name = copyFrom ? copyFrom.session_name : extraName.trim();
    if (!name) return;

    const baseDay = getBaseDay(day);
    const uniqueDay = `${baseDay}_${Date.now().toString(36)}`;

    let details = "";
    if (copyFrom && copyFrom.details) {
      details = stripChallengeLines(copyFrom.details);
    }

    await supabase.from("workout_plans").insert({
      user_id: userId,
      week,
      day: uniqueDay,
      session_name: name,
      details,
      tempo: copyFrom
        ? copyFrom.tempo
        : (extraIsCircuit
            ? `circuit:${parseInt(extraCircuitSeconds) || 40}:${parseInt(extraCircuitRounds) || 3}:${parseInt(extraCircuitRest) || 0}`
            : null),
      is_circuit: copyFrom ? (copyFrom.is_circuit || false) : extraIsCircuit,
    } as any);

    // Copy logged set data (per-set kg/reps) from the source workout so reps
    // per set are preserved identically when copying onto the same day.
    if (copyFrom) {
      const sourceKey = `${copyFrom.week}-${copyFrom.day}`;
      const sourceCompletion = completions[sourceKey];
      const cleanedWeights = sanitizeCopiedLoggedWeights(sourceCompletion?.logged_weights as Record<string, any> | null | undefined);
      if (cleanedWeights) {
        await supabase.from("workout_completions").upsert({
          user_id: userId,
          week,
          day: uniqueDay,
          done: false,
          skipped: false,
          logged_weights: cleanedWeights,
        }, { onConflict: "user_id,week,day" });
      }
    }

    setExtraName("");
    setExtraIsCircuit(false);
    setExtraCircuitSeconds("40");
    setExtraCircuitRounds("3");
    setExtraCircuitRest("30");
    setShowExtraCopyPicker(false);
    setAddExtraDay(null);
    if (copyFrom) {
      toast.success("Pass tillagt på samma dag 💪");
    } else {
      toast.success("Nytt pass tillagt – lägg till övningar nedan");
    }
    fetchData();
  };

  const mapDateToPlanWeekDay = (date: Date): { week: number; day: string } | null => {
    if (mode !== "plan" || !planStartDate) return null;
    const startDate = parseDateKey(planStartDate);
    if (!startDate) return null;
    const planStartMonday = getMonday(startDate);
    const targetDate = parseDateKey(toLocalDateKey(date));
    if (!targetDate) return null;

    const diffDays = daysBetweenCalendarDates(planStartMonday, targetDate);
    if (diffDays < 0) return null;

    const weekNum = Math.floor(diffDays / 7) + 1;
    const dayIndex = ((targetDate.getUTCDay() + 6) % 7); // 0=Mon, 6=Sun
    const dayName = DAYS[dayIndex];
    if (weekNum < 1) return null;
    return { week: weekNum, day: dayName };
  };

  const handleCopyToDateConfirm = async () => {
    if (!copyToDateSource) return;

    const planTarget = mapDateToPlanWeekDay(copyToDateSelected);

    if (planTarget) {
      // Plan mode: check if plan has exercises on that week/day
      const existingOnDay = plans.filter(p => p.week === planTarget.week && p.day === planTarget.day && p.details.trim() !== "");
      if (existingOnDay.length > 0) {
        setCopyToDateConflict("ask");
        return;
      }
    } else {
      // Standalone mode: check for existing standalone exercises on date
      const dateStr = format(copyToDateSelected, "yyyy-MM-dd");
      const existingOnDate = plans.filter(p => p.week === 0 && p.day.startsWith(dateStr) && p.details.trim() !== "");
      if (existingOnDate.length > 0) {
        setCopyToDateConflict("ask");
        return;
      }
    }

    await executeCopyToDate("add");
  };

  const executeCopyToDate = async (conflictMode: "replace" | "add") => {
    if (!copyToDateSource) return;
    setCopyToDateSaving(true);

    const planTarget = mapDateToPlanWeekDay(copyToDateSelected);
    const details = stripChallengeLines(copyToDateSource.details || "");

    if (planTarget) {
      // --- Plan mode: insert into plan week/day ---
      const existingOnDay = plans.filter(p => p.week === planTarget.week && p.day === planTarget.day);

      // Always clear any existing completion (done/skipped) on the target day when pasting
      await supabase.from("workout_completions").delete().eq("user_id", userId).eq("week", planTarget.week).eq("day", planTarget.day);

      if (conflictMode === "replace") {
        // Clear existing details on that day
        for (const p of existingOnDay) {
          await supabase.from("workout_plans").update({ details, session_name: copyToDateSource.session_name }).eq("id", p.id);
        }
        if (existingOnDay.length === 0) {
          await supabase.from("workout_plans").insert({
            user_id: userId,
            week: planTarget.week,
            day: planTarget.day,
            session_name: copyToDateSource.session_name,
            details,
            tempo: copyToDateSource.tempo || null,
            is_circuit: copyToDateSource.is_circuit || false,
          });
        }
      } else {
        // Add mode
        const withDetails = existingOnDay.filter(p => p.details.trim() !== "");
        if (withDetails.length > 0) {
          const target = withDetails[0];
          const combined = [target.details.trim(), details.trim()].filter(Boolean).join("\n");
          await supabase.from("workout_plans").update({ details: combined }).eq("id", target.id);
        } else if (existingOnDay.length > 0) {
          // Day exists but empty details
          await supabase.from("workout_plans").update({ details, session_name: copyToDateSource.session_name }).eq("id", existingOnDay[0].id);
        } else {
          await supabase.from("workout_plans").insert({
            user_id: userId,
            week: planTarget.week,
            day: planTarget.day,
            session_name: copyToDateSource.session_name,
            details,
            tempo: copyToDateSource.tempo || null,
            is_circuit: copyToDateSource.is_circuit || false,
          });
        }
      }

      // Copy logged weights if available
      const sourceKey = `${copyToDateSource.week}-${copyToDateSource.day}`;
      const sourceCompletion = completions[sourceKey];
      const cleanedWeights = sanitizeCopiedLoggedWeights(sourceCompletion?.logged_weights as Record<string, any> | null | undefined);
      if (cleanedWeights) {
        await supabase.from("workout_completions").upsert({
          user_id: userId,
          week: planTarget.week,
          day: planTarget.day,
          done: false,
          skipped: false,
          logged_weights: cleanedWeights,
        }, { onConflict: "user_id,week,day" });
      }

      toast.success(`Pass kopierat till v${planTarget.week} ${planTarget.day}!`);
    } else {
      // --- Standalone mode (fallback) ---
      const dateStr = format(copyToDateSelected, "yyyy-MM-dd");

      if (conflictMode === "replace") {
        const existingOnDate = plans.filter(p => p.week === 0 && p.day.startsWith(dateStr));
        for (const p of existingOnDate) {
          if (p.id) {
            await supabase.from("workout_plans").delete().eq("id", p.id);
            await supabase.from("workout_completions").delete().eq("user_id", userId).eq("week", 0).eq("day", p.day);
          }
        }
      }

      const uniqueKey = `${dateStr}_${Math.random().toString(36).slice(2, 6)}`;

      if (conflictMode === "add") {
        const existingOnDate = plans.filter(p => p.week === 0 && p.day.startsWith(dateStr) && p.details.trim() !== "");
        if (existingOnDate.length > 0) {
          const target = existingOnDate[0];
          const combined = [target.details.trim(), details.trim()].filter(Boolean).join("\n");
          await supabase.from("workout_plans").update({ details: combined }).eq("id", target.id);
          // Clear any completion marker on the merged target
          await supabase.from("workout_completions").delete().eq("user_id", userId).eq("week", 0).eq("day", target.day);
          toast.success("Övningar tillagda!");
          setCopyToDateSource(null);
          setCopyToDateConflict(null);
          setCopyToDateSaving(false);
          fetchData();
          return;
        }
      }

      await supabase.from("workout_plans").insert({
        user_id: userId,
        week: 0,
        day: uniqueKey,
        session_name: copyToDateSource.session_name,
        details,
        tempo: copyToDateSource.tempo || null,
        is_circuit: copyToDateSource.is_circuit || false,
      });

      const sourceKey = `${copyToDateSource.week}-${copyToDateSource.day}`;
      const sourceCompletion = completions[sourceKey];
      const cleanedWeights = sanitizeCopiedLoggedWeights(sourceCompletion?.logged_weights as Record<string, any> | null | undefined);
      if (cleanedWeights) {
        await supabase.from("workout_completions").upsert({
          user_id: userId,
          week: 0,
          day: uniqueKey,
          done: false,
          skipped: false,
          logged_weights: cleanedWeights,
        }, { onConflict: "user_id,week,day" });
      }

      toast.success("Pass kopierat!");
    }

    setCopyToDateSource(null);
    setCopyToDateConflict(null);
    setCopyToDateSaving(false);
    fetchData();
  };

  // Handle import of a workout into a plan slot. If existing exercises and target is a real plan,
  // ask whether to replace or append. Then if it's a recurring plan (week>0), ask about propagation.
  const applyLastLoggedWeightsToImportedDetails = (details: string): string => {
    return details.split("\n").map((line) => {
      const match = line.trim().match(/^(.+?)(?:\s+|\s*—\s*)((\d+)\s*[×x]\s*(\d+)(?:s)?)(?:\s*@\s*-?\d+(?:[.,]\d+)?\s*kg)?$/i);
      if (!match) return line;
      const exerciseName = match[1].trim().replace(/\s*—\s*$/, "");
      const setCount = parseInt(match[3]) || 1;
      const templateReps = parseInt(match[4]) || 10;
      const lastSetData = findLastSetData(exerciseName);
      if (lastSetData.length === 0) return `${exerciseName} — ${setCount}×${templateReps}`;

      const repsForPlan = lastSetData[0]?.reps || String(templateReps);
      const firstKg = lastSetData[0]?.kg;
      const kgSuffix = firstKg ? ` @ ${Math.abs(parseFloat(firstKg.replace(",", ".")))} kg` : "";
      return `${exerciseName} — ${setCount}×${repsForPlan}${kgSuffix}`;
    }).join("\n");
  };

  const buildImportedSetWeights = (details: string, existing: Record<string, any> = {}) => {
    const next = { ...existing };
    for (const line of details.split("\n")) {
      const match = line.trim().match(/^(.+?)(?:\s+|\s*—\s*)((\d+)\s*[×x]\s*(\d+)(?:s)?)(?:\s*@\s*-?\d+(?:[.,]\d+)?\s*kg)?$/i);
      if (!match) continue;
      const exerciseName = match[1].trim().replace(/\s*—\s*$/, "");
      const setCount = parseInt(match[3]) || 1;
      const templateReps = match[4] || "10";
      const lastSetData = findLastSetData(exerciseName);
      if (lastSetData.length === 0) continue;

      const importedSetData = Array.from({ length: setCount }, (_, si) => {
        const source = lastSetData[si] ?? lastSetData[lastSetData.length - 1];
        return { kg: source?.kg || "", reps: source?.reps || templateReps };
      });

      next[`__setdata__${exerciseName}`] = JSON.stringify(importedSetData);
      delete next[`__copied_ex__${exerciseName}`];
      importedSetData.forEach((_, si) => {
        const mode = (lastSetData[si] ?? lastSetData[lastSetData.length - 1])?.mode;
        if (mode) next[`__bw_mode__${exerciseName}__${si}`] = mode;
      });
    }
    return next;
  };

  const handleImportWorkout = (rawWorkout: { name: string; details: string; tempo: string | null }) => {
    const normalizedDetails = normalizeImportedDetails(rawWorkout.details);
    // Keep original details line — per-set kg/reps are populated from history
    // via buildImportedSetWeights so each set gets its own data, not just set 1
    const workout = { ...rawWorkout, details: normalizedDetails };
    const target = importWorkoutTarget;
    if (!target) return;

    if (target.planId === "__single__" || target.planId === "__new__") {
      void executeImport(target, workout, "replace", false);
      return;
    }

    const existingPlan = plans.find(p => p.id === target.planId);
    const hasExisting = !!(existingPlan && existingPlan.details && existingPlan.details.trim() !== "");

    if (!hasExisting) {
      if (target.week > 0) {
        setImportWorkoutTarget(null);
        setPendingImport({ target, workout, step: "propagate", mode: "replace" });
      } else {
        void executeImport(target, workout, "replace", false);
      }
      return;
    }

    setImportWorkoutTarget(null);
    setPendingImport({ target, workout, step: "conflict" });
  };

  const executeImport = async (
    target: { planId: string; week: number; day: string },
    workout: { name: string; details: string; tempo: string | null },
    mode: "replace" | "append",
    propagate: boolean,
  ) => {
    const isCirc = !!(workout.tempo && workout.tempo.startsWith("circuit:"));

    if (target.planId === "__single__") {
      const dateStr = format(singleDate, "yyyy-MM-dd");
      const uniqueKey = `${dateStr}_${Math.random().toString(36).slice(2, 6)}`;
      const importedWeights = buildImportedSetWeights(workout.details);
      await supabase.from("workout_plans").insert({
        user_id: userId, week: 0, day: uniqueKey,
        session_name: workout.name, details: workout.details, tempo: workout.tempo || null, is_circuit: isCirc,
      });
      if (Object.keys(importedWeights).length > 0) {
        await safeUpsertCompletion(0, uniqueKey, { done: false, logged_weights: importedWeights });
      }
      setSingleName(""); setSingleDate(new Date()); setShowAddSingle(false); setShowCopyPicker(false);
      setImportWorkoutTarget(null); setPendingImport(null);
      toast.success(`"${workout.name}" importerat!`);
      fetchData();
      return;
    }

    if (target.planId === "__new__") {
      const importedWeights = buildImportedSetWeights(workout.details);
      const { data: inserted } = await supabase.from("workout_plans").insert({
        user_id: userId, week: target.week, day: target.day,
        session_name: workout.name, details: workout.details, tempo: workout.tempo || null, is_circuit: isCirc,
      }).select().single();
      if (inserted) setPlans(prev => [...prev, inserted as any]);
      if (Object.keys(importedWeights).length > 0) {
        await safeUpsertCompletion(target.week, target.day, { done: false, logged_weights: importedWeights });
      }
      setImportWorkoutTarget(null); setPendingImport(null);
      toast.success(`"${workout.name}" importerat!`);
      fetchData();
      return;
    }

    const currentPlan = plans.find(p => p.id === target.planId);
    const targetPlans: typeof plans = [];
    if (currentPlan) targetPlans.push(currentPlan);
    if (propagate && currentPlan && target.week > 0) {
      const matchingFuture = plans.filter(p => p.week > target.week && p.day === target.day);
      targetPlans.push(...matchingFuture);
    }

    for (const p of targetPlans) {
      const newDetails = mode === "append" && p.details.trim()
        ? `${p.details}\n${workout.details}`
        : workout.details;
      const newSessionName = mode === "append" && p.session_name.trim()
        ? p.session_name
        : workout.name;
      await supabase.from("workout_plans").update({
        session_name: newSessionName,
        details: newDetails,
        tempo: workout.tempo || null,
        is_circuit: isCirc,
      }).eq("id", p.id);
      if (mode === "replace") {
        const importedWeights = buildImportedSetWeights(workout.details);
        await safeUpsertCompletion(p.week, p.day, { done: false, logged_weights: Object.keys(importedWeights).length > 0 ? importedWeights : null });
      } else {
        await updateCompletionWeights(p.week, p.day, (existing) => buildImportedSetWeights(workout.details, existing));
      }
      setPlans(prev => prev.map(pp => pp.id === p.id ? { ...pp, session_name: newSessionName, details: newDetails, tempo: workout.tempo || null, is_circuit: isCirc } : pp));
    }

    setImportWorkoutTarget(null);
    setPendingImport(null);
    toast.success(propagate ? `"${workout.name}" importerat på ${targetPlans.length} pass!` : `"${workout.name}" importerat!`);
    triggerSave();
  };

  const deleteSingleWorkout = async (plan: PlanDay) => {
    if (!confirm("Ta bort detta pass?")) return;
    if (plan.id) {
      await supabase.from("workout_plans").delete().eq("id", plan.id);
      await supabase.from("workout_completions").delete().
      eq("user_id", userId).
      eq("week", plan.week).
      eq("day", plan.day);
      fetchData();
    }
  };

  // Strip daily challenge lines from workout details
  const stripChallengeLines = (details: string): string => {
    return details.split("\n").filter(line => !isDailyChallengeLabel(line)).join("\n");
  };

  // Change weekday for a workout in a plan week
  const changeWorkoutDay = async (planId: string, newDay: string, week: number) => {
    // Strip challenge lines before moving — challenges stay on their original day
    const plan = plans.find(p => p.id === planId);
    const cleanDetails = plan ? stripChallengeLines(plan.details) : undefined;
    await supabase.from("workout_plans").update({ day: newDay, ...(cleanDetails !== undefined ? { details: cleanDetails } : {}) }).eq("id", planId);

    // Also move any completion data to the new day
    const oldPlan = plans.find(p => p.id === planId);
    if (oldPlan) {
      const oldKey = `${week}-${oldPlan.day}`;
      const comp = completions[oldKey];
      if (comp) {
        // Delete old completion, insert new one with new day
        await supabase.from("workout_completions").delete()
          .eq("user_id", userId).eq("week", week).eq("day", oldPlan.day);
        await supabase.from("workout_completions").upsert({
          user_id: userId, week, day: newDay, done: comp.done, skipped: comp.skipped,
          user_comment: comp.user_comment || "",
          logged_tempo: comp.logged_tempo, logged_pulse: comp.logged_pulse,
          logged_distance_km: comp.logged_distance_km, logged_weights: comp.logged_weights as any,
        }, { onConflict: "user_id,week,day" });
      }
    }

    setChangeDayDialog(null);
    triggerSave();
    fetchData();
  };

  const setWorkoutAsCurrentDay = async () => {
    if (!renameDialog || renameDialog.week <= 0) return;

    const targetDate = parseDateKey(toLocalDateKey(new Date()));
    if (!targetDate) return;
    const dayIndex = getDayIndex(renameDialog.day);
    if (dayIndex < 0) return;

    const newPlanStartDate = addUtcDays(targetDate, -((renameDialog.week - 1) * 7 + dayIndex));
    const newDateStr = toUtcDateKey(newPlanStartDate);

    setSettingCurrentDay(true);
    const { error } = await supabase
      .from("profiles")
      .update({ plan_start_date: newDateStr, plan_start_calibrated: true } as any)
      .eq("user_id", userId);
    setSettingCurrentDay(false);

    if (error) {
      toast.error("Kunde inte uppdatera aktuell träningsdag");
      return;
    }

    setPlanStartDate(newDateStr);
    setActivePlanWeek(renameDialog.week);
    setCurrentWeek(renameDialog.week);
    const updatedWeekDays = plans
      .filter((p) => p.week === renameDialog.week)
      .sort((a, b) => getDayIndex(a.day) - getDayIndex(b.day));
    const updatedDayIndex = updatedWeekDays.findIndex((p) => sameWorkoutDay(p.day, renameDialog.day));
    if (updatedDayIndex >= 0) setActiveDayIndex(updatedDayIndex);
    setExpandedDay(null);
    setRenameDialog(null);
    triggerSave();
    toast.success("Aktuell träningsdag uppdaterad");
  };

  // Rename a session
  const renameSession = async (planId: string, newName: string) => {
    if (!newName.trim()) return;
    const trimmed = newName.trim();
    // Check if the plan's details is just a suggested distance (e.g. "Löpning 8.5 km")
    // If the new name is no longer a running session, clear the suggested distance from details
    const plan = plans.find(p => p.id === planId);
    const newLower = trimmed.toLowerCase();
    const isNewRunning = newLower.includes("löpning") || newLower.includes("jogg") || newLower.includes("långpass") || newLower.includes("tröskel");
    let detailsUpdate: Record<string, string> = {};
    if (plan && !isNewRunning) {
      const detMatch = plan.details.trim().match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*km\s*$/i);
      if (detMatch) {
        const exName = detMatch[1].trim();
        const isCondEx = allExercises.some(e => e.name.toLowerCase() === exName.toLowerCase() && e.category === "kondition");
        if (isCondEx) {
          detailsUpdate = { details: "" };
        }
      }
    }
    await supabase.from("workout_plans").update({ session_name: trimmed, ...detailsUpdate }).eq("id", planId);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, session_name: trimmed, ...(detailsUpdate.details !== undefined ? { details: detailsUpdate.details } : {}) } : p));
    setRenameDialog(null);
    setRenameInput("");
    triggerSave();
  };

  const parseExerciseWeight = (line: string): {name: string;weight: string | null;} => {
    const match = line.match(/^(.+?)\s*—\s*(.+)$/);
    if (match) return { name: match[1].trim(), weight: match[2].trim() };
    return { name: line.trim(), weight: null };
  };

  // Find the most recent reps logged for an exercise (any kg, including 0/empty).
  // Used in circuit workouts to show "last time you did X reps" as a placeholder.
  const findLastReps = useCallback((exerciseName: string, setIndex: number): string | null => {
    const exLower = exerciseName.toLowerCase();
    const candidates: Array<{ key: string; reps: string; ts: number }> = [];
    const collect = (weights: Record<string, any> | null, ts: number) => {
      if (!weights) return;
      const setDataRaw = weights[`__setdata__${exerciseName}`] ?? weights[`__setdata__${exLower}`];
      if (!setDataRaw) return;
      try {
        const setData = typeof setDataRaw === "string" ? JSON.parse(setDataRaw) : setDataRaw;
        if (Array.isArray(setData) && setData[setIndex]?.reps) {
          const r = String(setData[setIndex].reps).trim();
          if (r) candidates.push({ key: "", reps: r, ts });
        }
      } catch {}
    };
    for (const [k, comp] of Object.entries(completions)) {
      if (!comp?.done) continue;
      collect(comp.logged_weights as any, k.localeCompare("") );
    }
    for (const archComp of archivedCompletions) {
      collect(archComp.logged_weights as any, 0);
    }
    if (candidates.length === 0) return null;
    return candidates[candidates.length - 1].reps;
  }, [completions, archivedCompletions]);

  // Find last weight used for an exercise across ALL workouts (single + plan + archived),
  // preferring matching rep count. Returns e.g. "3×10 @ 80 kg" or "80 kg (8 reps)"
  type LoggedSetInfo = { kg: string; reps: string; mode?: "add" | "sub" };

  const getExerciseSetDataFromWeights = (weights: Record<string, any> | null | undefined, exerciseName: string): LoggedSetInfo[] => {
    if (!weights) return [];
    const wantedKey = normalizeExerciseKey(exerciseName);
    let storedName = exerciseName;
    let raw: any = null;

    for (const [key, value] of Object.entries(weights)) {
      if (!key.startsWith("__setdata__")) continue;
      const candidateName = key.substring("__setdata__".length);
      if (normalizeExerciseKey(candidateName) === wantedKey) {
        storedName = candidateName;
        raw = value;
        break;
      }
    }

    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed)) return [];

      const storedKey = normalizeExerciseKey(storedName);
      return parsed.map((set, si) => {
        const kgRaw = set?.kg !== undefined && set?.kg !== null ? String(set.kg).trim() : "";
        const reps = set?.reps !== undefined && set?.reps !== null ? String(set.reps).trim() : "";
        const kgNum = parseFloat(kgRaw.replace(",", "."));
        const modeRaw = weights[`__bw_mode__${storedName}__${si}`] ?? weights[`__bw_mode__${storedKey}__${si}`] ?? weights[`__bw_mode__${exerciseName}__${si}`] ?? weights[`__bw_mode__${wantedKey}__${si}`] ?? weights[`__bw_mode__${storedName}`] ?? weights[`__bw_mode__${storedKey}`] ?? weights[`__bw_mode__${exerciseName}`] ?? weights[`__bw_mode__${wantedKey}`];
        const mode: LoggedSetInfo["mode"] = modeRaw === "sub" || (!isNaN(kgNum) && kgNum < 0) ? "sub" : modeRaw === "add" ? "add" : undefined;
        const kg = kgRaw && !isNaN(kgNum) ? String(Math.abs(kgNum)) : kgRaw;
        return { kg, reps, mode };
      }).filter((set) => set.kg || set.reps);
    } catch {
      return [];
    }
  };

  const getCompletionSortValue = (week: number, day: string, fallbackIndex: number) => {
    if (week === 0) {
      const dateMatch = getBaseDay(day).match(/^\d{4}-\d{2}-\d{2}/);
      if (dateMatch) return new Date(`${dateMatch[0]}T00:00:00`).getTime() + fallbackIndex;
    }

    const planDate = getPlanDayDateValue(planStartDate, week, day);
    if (planDate) return planDate.getTime() + fallbackIndex;

    const dayIndex = getDayIndex(day);
    return week * 10 + (dayIndex >= 0 ? dayIndex : fallbackIndex / 1000);
  };

  const findLastSetData = (exerciseName: string): LoggedSetInfo[] => {
    const candidates: Array<{ sort: number; data: LoggedSetInfo[] }> = [];

    archivedCompletions.forEach((archComp, index) => {
      const data = getExerciseSetDataFromWeights(archComp.logged_weights as Record<string, any> | null, exerciseName);
      if (data.length > 0) candidates.push({ sort: -1000000 + index, data });
    });

    Object.entries(completions).forEach(([key, comp], index) => {
      if (!comp?.done) return;
      const data = getExerciseSetDataFromWeights(comp.logged_weights as Record<string, any> | null, exerciseName);
      if (data.length === 0) return;
      const [weekRaw, ...dayParts] = key.split("-");
      const week = Number(comp.week ?? weekRaw);
      const day = comp.day ?? dayParts.join("-");
      candidates.push({ sort: getCompletionSortValue(week, day, index), data });
    });

    candidates.sort((a, b) => a.sort - b.sort);
    return candidates[candidates.length - 1]?.data ?? [];
  };

  const findLastWeight = (exerciseName: string, targetReps?: number): string | null => {
    const exLower = exerciseName.toLowerCase();

    // Collect all logged set data across all completed workouts
    type SetInfo = { kg: number; reps: number; label: string };
    const allSets: SetInfo[] = [];

    // Helper to extract sets from a weights record
    const extractSets = (weights: Record<string, any>) => {
      const setDataRaw = weights[`__setdata__${exerciseName}`] ?? weights[`__setdata__${exLower}`];
      if (setDataRaw) {
        try {
          const setData = typeof setDataRaw === 'string' ? JSON.parse(setDataRaw) : setDataRaw;
          if (Array.isArray(setData) && setData.length > 0) {
            for (let si = 0; si < setData.length; si++) {
              const s = setData[si];
              const rawKg = parseFloat(s.kg);
              const mode = weights[`__bw_mode__${exerciseName}__${si}`] ?? weights[`__bw_mode__${exLower}__${si}`] ?? weights[`__bw_mode__${exerciseName}`] ?? weights[`__bw_mode__${exLower}`];
              const kg = mode === "sub" && rawKg > 0 ? -rawKg : rawKg;
              const reps = parseInt(s.reps);
              if (kg !== 0 && !isNaN(kg)) {
                allSets.push({ kg, reps: reps || 0, label: `${kg} kg (${reps || '?'} reps)` });
              }
            }
          }
        } catch {}
      }
    };

    // Search active completions
    for (const [k, comp] of Object.entries(completions)) {
      if (!comp?.done) continue;
      const weights = comp.logged_weights as Record<string, any> | null;
      if (!weights) continue;
      extractSets(weights);
    }

    // Search archived completions
    for (const archComp of archivedCompletions) {
      const weights = archComp.logged_weights as Record<string, any> | null;
      if (!weights) continue;
      extractSets(weights);
    }

    // If we found logged sets, prefer matching rep count
    if (allSets.length > 0) {
      if (targetReps) {
        const matching = allSets.filter(s => s.reps === targetReps);
        if (matching.length > 0) {
          const best = matching[matching.length - 1];
          return `${best.kg} kg (${best.reps} reps)`;
        }
      }
      // Fallback: latest set
      const last = allSets[allSets.length - 1];
      return `${last.kg} kg (${last.reps || '?'} reps)`;
    }

    // Fallback: search plan details text for weight info (active plans)
    const allPlans = [...plans].sort((a, b) => {
      if (a.week !== b.week) return b.week - a.week;
      return b.day.localeCompare(a.day);
    });
    for (const plan of allPlans) {
      if (!plan.details) continue;
      for (const line of plan.details.split("\n")) {
        const { name, weight } = parseExerciseWeight(line);
        if (name.toLowerCase() === exLower && weight) {
          return weight;
        }
      }
    }

    // Fallback: search archived plan details text
    for (const archComp of archivedCompletions) {
      if (!archComp._plan_details) continue;
      for (const line of (archComp._plan_details as string).split("\n")) {
        const { name, weight } = parseExerciseWeight(line);
        if (name.toLowerCase() === exLower && weight) {
          return weight;
        }
      }
    }
    return null;
  };

  // Find last logged tempo for a conditioning exercise across all workouts
  const findLastCondTempo = (exerciseName: string): string | null => {
    // Check single workouts (week 0)
    const singlePlans = plans.filter((p) => p.week === 0).sort((a, b) => b.day.localeCompare(a.day));
    for (const plan of singlePlans) {
      if (!plan.details) continue;
      const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      for (const line of lines) {
        const { name } = parseExerciseWeight(line);
        if (name.toLowerCase() === exerciseName.toLowerCase()) {
          const tempoM = line.match(/([\d:.]+)\s*\/km/);
          if (tempoM) return tempoM[1];
        }
      }
      // Also check logged conditioning data
      const k = `0-${plan.day}`;
      const comp = completions[k];
      if (comp?.done) {
        const weights = comp.logged_weights as Record<string, any> | null;
        if (weights) {
          for (const [wk, val] of Object.entries(weights)) {
            if (wk.startsWith('__cond__') && wk.toLowerCase().includes(exerciseName.toLowerCase())) {
              try {
                const data = typeof val === 'string' ? JSON.parse(val) : val;
                if (data.tempo) return data.tempo;
              } catch {}
            }
          }
        }
      }
    }
    // Check plan workouts
    const planWorkouts = plans.filter(p => p.week > 0).sort((a, b) => b.week - a.week);
    for (const plan of planWorkouts) {
      const k = `${plan.week}-${plan.day}`;
      const comp = completions[k];
      if (!comp?.done) continue;
      const weights = comp.logged_weights as Record<string, any> | null;
      if (weights) {
        for (const [wk, val] of Object.entries(weights)) {
          if (wk.startsWith('__cond__') && wk.toLowerCase().includes(exerciseName.toLowerCase())) {
            try {
              const data = typeof val === 'string' ? JSON.parse(val) : val;
              if (data.tempo) return data.tempo;
            } catch {}
          }
        }
      }
      if (comp.logged_tempo) {
        // Check if this plan's details contain the exercise
        const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        for (const line of lines) {
          const { name } = parseExerciseWeight(line);
          if (name.toLowerCase() === exerciseName.toLowerCase()) {
            return comp.logged_tempo;
          }
        }
      }
    }
    // Fallback: search archived completions for conditioning tempo
    for (const archComp of archivedCompletions) {
      const weights = archComp.logged_weights as Record<string, any> | null;
      if (weights) {
        for (const [wk, val] of Object.entries(weights)) {
          if (wk.startsWith('__cond__') && wk.toLowerCase().includes(exerciseName.toLowerCase())) {
            try {
              const data = typeof val === 'string' ? JSON.parse(val) : val;
              if (data.tempo) return data.tempo;
            } catch {}
          }
        }
      }
    }
    return null;
  };

  // Auto-calc for conditioning: fill in the 3rd field when 2 are provided
  const parseCondTempo = (t: string): number | null => {
    const trimmed = t.trim();
    if (!trimmed) return null;

    const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
    if (colonMatch) return parseInt(colonMatch[1]) + parseInt(colonMatch[2]) / 60;

    const dotTimeMatch = trimmed.match(/^(\d+)\.(\d{2})$/);
    if (dotTimeMatch && parseInt(dotTimeMatch[2]) < 60) {
      return parseInt(dotTimeMatch[1]) + parseInt(dotTimeMatch[2]) / 60;
    }

    if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;

    const v = parseFloat(trimmed.replace(",", "."));
    return isNaN(v) ? null : v;
  };

  const formatCondTempo = (minPerKm: number): string => {
    const mins = Math.floor(minPerKm);
    const secs = Math.round((minPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper: check if exercise is a stair machine (Trappmaskin)
  const isStairMachine = (name: string) => name.toLowerCase().includes("trappmaskin");

  const autoCalcCond = (totalMinutes: number, tempo: string, dist: string, changed: "time" | "tempo" | "distance") => {
    const t = totalMinutes;
    const p = parseCondTempo(tempo);
    const d = parseFloat(dist.replace(",", "."));
    const filled = {
      time: t > 0,
      tempo: tempo.trim().length > 0 && p !== null && p > 0,
      distance: dist.trim().length > 0 && !isNaN(d) && d > 0,
    };

    const calculateField = (field: "time" | "tempo" | "distance") => {
      if (field === "distance" && t > 0 && p && p > 0) {
        setCondDistanceInput(String(Math.round((t / p) * 100) / 100));
      } else if (field === "tempo" && t > 0 && d > 0) {
        setCondTempoInput(formatCondTempo(t / d));
      } else if (field === "time" && d > 0 && p && p > 0) {
        setCondTimeFromMinutes(p * d);
      }
    };

    const filledCount = Object.values(filled).filter(Boolean).length;
    if (!filled[changed]) {
      if (condAutoField === changed) setCondAutoField(null);
      return;
    }

    if (filledCount < 2) return;

    const missingField = (["time", "tempo", "distance"] as const).find((field) => !filled[field]);
    if (filledCount === 2 && missingField) {
      calculateField(missingField);
      setCondAutoField(missingField);
      return;
    }

    if (filledCount === 3 && condAutoField) {
      if (condAutoField === changed) {
        setCondAutoField(null);
        return;
      }

      calculateField(condAutoField);
    }
  };

  // Open weight dialog when selecting an exercise
  const handleExerciseSelect = (planId: string, exerciseName: string) => {
    // REPLACE MODE: skip dialog, copy sets/reps from original line
    if (replaceExerciseTarget && replaceExerciseTarget.planId === planId) {
      const plan = plans.find(p => p.id === planId);
      if (plan) {
        const separator = plan.details.includes("\n") ? "\n" : "; ";
        const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        const oldLine = lines[replaceExerciseTarget.lineIndex] || "";
        // Parse "Name — SxR @ W kg" or "Name — SxR sek" etc., keep everything after the em-dash
        const dashMatch = oldLine.match(/^.*?—\s*(.+)$/);
        const params = dashMatch ? dashMatch[1].trim() : "3×10";
        // Strip any old weight (we'll use the new exercise's last weight if available)
        const paramsNoWeight = params.replace(/\s*@\s*[\d.,]+\s*kg.*$/i, "").trim();
        const lastWeight = findLastWeight(exerciseName);
        const newWeight = lastWeight?.replace(/.*@\s*/, "").replace(/\s*kg.*/, "").trim();
        const entry = newWeight
          ? `${exerciseName} — ${paramsNoWeight} @ ${newWeight} kg`
          : `${exerciseName} — ${paramsNoWeight}`;
        const oldName = replaceExerciseTarget.name;
        lines[replaceExerciseTarget.lineIndex] = entry;
        const newDetails = lines.join(separator);
        const targetPlanId = plan.id;
        const targetWeek = plan.week;
        setReplaceExerciseTarget(null);
        setShowExercisePicker(null);
        (async () => {
          await supabase.from("workout_plans").update({ details: newDetails }).eq("id", targetPlanId);
          skipDayResetRef.current = true;
          setPlans((prev) => prev.map((p) => p.id === targetPlanId ? { ...p, details: newDetails } : p));
          triggerSave();
          // Pre-populate per-set weight data
          if (newWeight) {
            const setsMatch = paramsNoWeight.match(/^(\d+)\s*[×x]\s*(\d+)/);
            const sets = setsMatch ? parseInt(setsMatch[1]) : 3;
            const reps = setsMatch ? parseInt(setsMatch[2]) : 10;
            const initData = Array.from({ length: sets }, () => ({ kg: newWeight, reps: String(reps) }));
            await updateCompletionWeights(targetWeek, plan.day, (existing) => ({
              ...existing,
              [`__setdata__${exerciseName}`]: JSON.stringify(initData),
            }));
          }
          if (mode === "plan" && targetWeek > 0) {
            setReplacePropagateDialog({ oldExerciseName: oldName, newEntry: entry, sourcePlanId: targetPlanId });
          }
        })();
      }
      return;
    }
    // Check if exercise is conditioning type
    const exercise = allExercises.find((e) => e.name === exerciseName);
    if (exercise && exercise.category === "kondition") {
      setConditioningDialog({ planId, exerciseName });
      if (isStairMachine(exerciseName)) {
        setCondTempoInput("");
        setCondSpmInput("");
      } else {
        const lastCondTempo = findLastCondTempo(exerciseName);
        setCondTempoInput(lastCondTempo || "");
        setCondSpmInput("");
      }
      resetCondTime();
      setCondDistanceInput("");
      setCondAutoField(null);
      setCondIntervalsInput("");
      setCondRestInput("");
      setCondPulseInput("");
      return;
    }
    const lastWeight = findLastWeight(exerciseName);
    setWeightDialog({ planId, exerciseName, lastWeight });
    setWeightInput(lastWeight?.replace(/.*@\s*/, "").replace(/\s*kg.*/, "") || "");
    // Default reps to circuit seconds for circuit plans
    const targetPlan = plans.find(p => p.id === planId);
    const circuitSecsMatch = targetPlan?.is_circuit ? targetPlan?.tempo?.match(/^circuit:(\d+)(?::\d+)?(?::\d+)?$/) : null;
    // Determine default unit: circuit → sek, bodyweight exercises → check context
    const bodyweightNames = ["box jumps", "burpees", "pull-ups", "pull ups", "armhävningar", "push-ups", "push ups", "planka", "dead bug", "bird dog", "sit-ups", "sit ups", "mountain climbers", "jumping jacks", "jump squats", "pistol squats", "handstand", "muscle-ups", "muscle ups", "ring rows", "v-ups", "toes to bar", "knees to elbow", "dips"];
    const exLower = exerciseName.toLowerCase();
    const isBodyweightEx = bodyweightNames.some(bw => exLower.includes(bw)) || customExercises.find(ce => ce.name.toLowerCase() === exLower)?.is_bodyweight_exercise;
    const isTimeBased = /^(sido)?planka$|^vila$/i.test(exerciseName.trim()) || customExercises.find(ce => ce.name.toLowerCase() === exLower)?.is_time_based;
    if (targetPlan?.is_circuit) {
      setRepsUnit("sek");
      setRepsInput(circuitSecsMatch ? circuitSecsMatch[1] : "40");
    } else if (isTimeBased) {
      setRepsUnit("sek");
      setRepsInput("30");
    } else {
      setRepsUnit("reps");
      setRepsInput("10");
    }
    setSetsInput("3");
  };

  // Add exercise with reps, sets & weight to plan
  const addExerciseWithWeight = async (useWeight: string | null) => {
    if (!weightDialog) return;
    const plan = plans.find((p) => p.id === weightDialog.planId);
    if (!plan) return;

    const sets = parseInt(setsInput) || 3;
    const reps = parseInt(repsInput) || 10;
    const weightStr = useWeight ? useWeight.replace(/\s*kg\s*$/i, "").trim() : null;

    const entry = weightStr ?
    `${weightDialog.exerciseName} — ${sets}×${reps} @ ${weightStr} kg` :
    `${weightDialog.exerciseName} — ${sets}×${reps}`;

    let newDetails: string;
    let wasReplace = false;
    let oldName = "";
    if (replaceExerciseTarget && replaceExerciseTarget.planId === plan.id) {
      // Replace mode: substitute the line at the target index
      const separator = plan.details.includes("\n") ? "\n" : "; ";
      const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      lines[replaceExerciseTarget.lineIndex] = entry;
      newDetails = lines.join(separator);
      wasReplace = true;
      oldName = replaceExerciseTarget.name;
      setReplaceExerciseTarget(null);
      setShowExercisePicker(null);
    } else {
      const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
      newDetails = isWarmupMode
        ? (plan.details ? `${entry}${joinSep}${plan.details}` : entry)
        : (plan.details ? `${plan.details}${joinSep}${entry}` : entry);
    }

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    if (wasReplace) skipDayResetRef.current = true;
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();

    // Pre-populate per-set weight data so the weight carries into each set row
    if (weightStr) {
      const exerciseName = weightDialog.exerciseName;
      const initData = Array.from({ length: sets }, () => ({ kg: weightStr, reps: String(reps) }));
      await updateCompletionWeights(plan.week, plan.day, (existing) => ({
        ...existing,
        [`__setdata__${exerciseName}`]: JSON.stringify(initData),
      }));
    }

    setWeightDialog(null);
    setWeightInput("");
    setRepsInput("10");
    setSetsInput("3");
    setRepsUnit("reps");
    setIsWarmupMode(false);

    // Show propagation dialog if this was a replacement in plan mode
    if (wasReplace && mode === "plan" && plan.week > 0) {
      setReplacePropagateDialog({ oldExerciseName: oldName, newEntry: entry, sourcePlanId: plan.id });
    }
  };

  // Add conditioning exercise with tempo, time, distance (+ intervals for Intervallträning)
  const addConditioningExercise = async () => {
    if (!conditioningDialog) return;
    const plan = plans.find((p) => p.id === conditioningDialog.planId);
    if (!plan) return;

    const infoParts: string[] = [];
    const isInterval = conditioningDialog.exerciseName.toLowerCase().includes("intervall");
    const isStair = isStairMachine(conditioningDialog.exerciseName);
    
    if (isInterval && condIntervalsInput.trim()) {
      const intervalPart = `${condIntervalsInput.trim()}×${condTimeTotalMinStr || "?"} min`;
      infoParts.push(intervalPart);
      if (condRestInput.trim()) infoParts.push(`${condRestInput.trim()} min vila`);
    } else {
      if (condTimeTotalMinStr) infoParts.push(`${condTimeTotalMinStr} min`);
    }
    if (isStair) {
      if (condSpmInput.trim()) infoParts.push(`${condSpmInput.trim()} spm`);
      const time = condTimeTotalMin;
      const spm = parseFloat(condSpmInput.replace(",", "."));
      if (time > 0 && spm > 0) infoParts.push(`${Math.round(time * spm)} steg`);
    } else {
      if (condTempoInput.trim()) infoParts.push(`${condTempoInput.trim()}/km`);
      if (condDistanceInput.trim()) infoParts.push(`${condDistanceInput.trim()} km`);
    }
    if (condPulseInput.trim()) infoParts.push(`${condPulseInput.trim()} bpm`);
    
    const entry = infoParts.length > 0 ? `${conditioningDialog.exerciseName} — ${infoParts.join(", ")}` : conditioningDialog.exerciseName;

    let newDetails: string;
    let wasReplace = false;
    let oldName = "";
    if (replaceExerciseTarget && replaceExerciseTarget.planId === plan.id) {
      const separator = plan.details.includes("\n") ? "\n" : "; ";
      const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      lines[replaceExerciseTarget.lineIndex] = entry;
      newDetails = lines.join(separator);
      wasReplace = true;
      oldName = replaceExerciseTarget.name;
      setReplaceExerciseTarget(null);
      setShowExercisePicker(null);
    } else {
      const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
      newDetails = isWarmupMode
        ? (plan.details ? `${entry}${joinSep}${plan.details}` : entry)
        : (plan.details ? `${plan.details}${joinSep}${entry}` : entry);
    }

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    if (wasReplace) skipDayResetRef.current = true;
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();
    setConditioningDialog(null);
    setCondTempoInput("");
    resetCondTime();
    setCondDistanceInput("");
    setCondAutoField(null);
    setCondIntervalsInput("");
    setCondRestInput("");
    setCondPulseInput("");
    setCondSpmInput("");
    setIsWarmupMode(false);

    // Show propagation dialog if this was a replacement in plan mode
    if (wasReplace && mode === "plan" && plan.week > 0) {
      setReplacePropagateDialog({ oldExerciseName: oldName, newEntry: entry, sourcePlanId: plan.id });
    }
  };

  // Delete a logged conditioning line from plan details
  const deleteConditioningLine = async (planId: string, lineIndex: number) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    lines.splice(lineIndex, 1);
    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", planId);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, details: newDetails } : p));
    triggerSave();
  };

  // Delete direct logged conditioning fields from completion
  const deleteDirectCondLog = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    setCompletions(prev => ({
      ...prev,
      [key]: { ...prev[key], logged_tempo: null, logged_pulse: null, logged_distance_km: null }
    }));
    await supabase.from("workout_completions").update({
      logged_tempo: null, logged_pulse: null, logged_distance_km: null
    }).eq("user_id", userId).eq("week", week).eq("day", day);
  };

  // Delete a logged conditioning payload stored in logged_weights (__cond__...)
  const deleteCondWeightLog = async (week: number, day: string, condWeightKey: string) => {
    const key = `${week}-${day}`;
    const currentWeights = (completions[key]?.logged_weights || {}) as Record<string, any>;
    if (!Object.prototype.hasOwnProperty.call(currentWeights, condWeightKey)) return;

    const { [condWeightKey]: _removed, ...restWeights } = currentWeights;
    const payload = Object.keys(restWeights).length > 0 ? restWeights : null;

    setCompletions(prev => ({
      ...prev,
      [key]: { ...prev[key], logged_weights: payload as any }
    }));

    await safeUpsertCompletion(week, day, { logged_weights: payload });
  };

  // Start editing a logged conditioning line
  const startEditCondLine = (planId: string, lineIndex: number, name: string, info: string) => {
    const timeM = info.match(/(\d+(?:[.,]\d+)?)\s*min/);
    const tempoM = info.match(/(\d+:\d+)\/km/);
    const distM = info.match(/([\d.,]+)\s*km(?!\/)/);
    const pulseM = info.match(/(\d+)\s*bpm/);
    const spmM = info.match(/(\d+)\s*spm/);
    if (timeM) {
      setCondTimeFromMinutes(parseFloat(timeM[1].replace(",", ".")));
    } else {
      resetCondTime();
    }
    setCondTempoInput(tempoM ? tempoM[1] : "");
    setCondDistanceInput(distM ? distM[1].replace(",", ".") : "");
    setCondAutoField(null);
    setCondPulseInput(pulseM ? pulseM[1] : "");
    setCondSpmInput(spmM ? spmM[1] : "");
    setCondIntervalsInput("");
    setCondRestInput("");
    setEditingCondLine({ planId, lineIndex, name });
  };

  // State for editing a conditioning line
  const [editingCondLine, setEditingCondLine] = useState<{ planId: string; lineIndex: number; name: string } | null>(null);

  // Save edited conditioning line
  const saveEditedCondLine = async () => {
    if (!editingCondLine) return;
    const plan = plans.find(p => p.id === editingCondLine.planId);
    if (!plan) return;
    const infoParts: string[] = [];
    const isStair = isStairMachine(editingCondLine.name);
    if (condTimeTotalMinStr) infoParts.push(`${condTimeTotalMinStr} min`);
    if (isStair) {
      if (condSpmInput.trim()) infoParts.push(`${condSpmInput.trim()} spm`);
      const time = condTimeTotalMin;
      const spm = parseFloat(condSpmInput.replace(",", "."));
      if (time > 0 && spm > 0) infoParts.push(`${Math.round(time * spm)} steg`);
    } else {
      if (condTempoInput.trim()) infoParts.push(`${condTempoInput.trim()}/km`);
      if (condDistanceInput.trim()) infoParts.push(`${condDistanceInput.trim()} km`);
    }
    if (condPulseInput.trim()) infoParts.push(`${condPulseInput.trim()} bpm`);
    const entry = infoParts.length > 0 ? `${editingCondLine.name} — ${infoParts.join(", ")}` : editingCondLine.name;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    lines[editingCondLine.lineIndex] = entry;
    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();
    setEditingCondLine(null);
    resetCondTime();
    setCondTempoInput("");
    setCondDistanceInput("");
    setCondAutoField(null);
    setCondPulseInput("");
    setCondSpmInput("");
  };

  const addExerciseToPlan = async (plan: PlanDay, exerciseName: string) => {
    const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
    const newDetails = plan.details ?
    `${plan.details}${joinSep}${exerciseName}` :
    exerciseName;

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);

    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();
  };

  // Save edited exercise line (sets/reps/weight)
  const saveEditedExercise = async (propagate = false) => {
    if (!editingExercise) return;
    const plan = plans.find((p) => p.id === editingExercise.planId);
    if (!plan) return;

    const sets = parseInt(editingExercise.sets) || 3;
    const reps = parseInt(editingExercise.reps) || 10;
    const w = editingExercise.weight.trim();

    const originalLines = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
    const originalLine = originalLines[editingExercise.lineIndex] || "";
    const hadStructuredFormat = originalLine.includes("—");

    let entry: string;
    if (hadStructuredFormat || w) {
      entry = w
        ? `${editingExercise.name} — ${sets}×${reps} @ ${w} kg`
        : `${editingExercise.name} — ${sets}×${reps}`;
    } else {
      entry = editingExercise.name;
    }

    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
    lines[editingExercise.lineIndex] = entry;
    const newDetails = lines.join(separator);

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();
    // In plan mode, ask about propagation to future weeks
    if (mode === "plan" && plan.week > 0 && !propagate) {
      setPropagateDialog({ entry, originalName: editingExercise.originalName, newName: editingExercise.name, plan, lineIndex: editingExercise.lineIndex });
      setEditingExercise(null);
      return;
    }

    // Propagate to future weeks on same weekday
    if (propagate && mode === "plan" && plan.week > 0) {
      const futurePlans = plans.filter(p => p.day === plan.day && p.week > plan.week);
      const baseWeight = w ? parseFloat(w) : 0;
      const repsNum = reps;
      const step = repsNum <= 3 ? 5 : repsNum <= 8 ? 2.5 : 1.25;

      for (let fi = 0; fi < futurePlans.length; fi++) {
        const fp = futurePlans[fi];
        const fpLines = fp.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        // Find the original exercise by name
        const matchIdx = fpLines.findIndex(l => {
          const { name: ln } = parseExerciseWeight(l);
          return ln.toLowerCase() === editingExercise.originalName.toLowerCase();
        });
        if (matchIdx >= 0) {
          const progressiveWeight = baseWeight > 0 ? Math.round((baseWeight + step * (fi + 1)) * 4) / 4 : 0;
          const fpEntry = progressiveWeight > 0
            ? `${editingExercise.name} — ${sets}×${reps} @ ${progressiveWeight} kg`
            : w ? `${editingExercise.name} — ${sets}×${reps} @ ${w} kg` : `${editingExercise.name} — ${sets}×${reps}`;
          fpLines[matchIdx] = fpEntry;
          const fpSep = fp.details.includes("\n") ? "\n" : "; ";
          const fpNewDetails = fpLines.join(fpSep);
          await supabase.from("workout_plans").update({ details: fpNewDetails }).eq("id", fp.id);
        }
      }
      fetchData();
    }

    setEditingExercise(null);
  };

  const handlePropagate = async (doPropagate: boolean) => {
    if (doPropagate && propagateDialog) {
      // Re-run save with propagation
      const { plan, originalName, newName, entry, lineIndex } = propagateDialog;
      const w = entry.match(/@\s*([\d.,]+)\s*kg/)?.[1] || "";
      const setsMatch = entry.match(/(\d+)[×x](\d+)/i);
      const sets = setsMatch ? setsMatch[1] : "3";
      const reps = setsMatch ? setsMatch[2] : "10";
      
      setEditingExercise({ planId: plan.id, lineIndex, name: newName, originalName, sets, reps, weight: w });
      setPropagateDialog(null);
      // Use setTimeout to let state update
      setTimeout(() => {
        saveEditedExercise(true);
      }, 0);
      return;
    }
    setPropagateDialog(null);
  };

  // Handle replace exercise propagation across all weeks
  const handleReplacePropagate = async (doPropagate: boolean) => {
    if (doPropagate && replacePropagateDialog) {
      const { oldExerciseName, newEntry, sourcePlanId } = replacePropagateDialog;
      const sourcePlan = plans.find(p => p.id === sourcePlanId);
      if (!sourcePlan) { setReplacePropagateDialog(null); return; }

      // Find all other plans (different weeks, same day) that contain the old exercise
      const otherPlans = plans.filter(p =>
        p.id !== sourcePlanId &&
        p.week > 0 &&
        p.day === sourcePlan.day
      );

      const updatedPlans = [...plans];

      for (const p of otherPlans) {
        const separator = p.details.includes("\n") ? "\n" : "; ";
        const lines = p.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        let changed = false;
        for (let i = 0; i < lines.length; i++) {
          const lineName = lines[i].split(/\s*—\s*/)[0].trim();
          if (lineName.toLowerCase() === oldExerciseName.toLowerCase()) {
            lines[i] = newEntry;
            changed = true;
          }
        }
        if (changed) {
          const newDetails = lines.join(separator);
          await supabase.from("workout_plans").update({ details: newDetails }).eq("id", p.id);
          const idx = updatedPlans.findIndex(up => up.id === p.id);
          if (idx >= 0) updatedPlans[idx] = { ...updatedPlans[idx], details: newDetails };
        }
      }

      skipDayResetRef.current = true;
      setPlans(updatedPlans);
      triggerSave();
    }
    setReplacePropagateDialog(null);
  };

  const executeDeleteExercise = async () => {
    if (!deleteExerciseConfirm) return;
    console.log("[DELETE] deleteExerciseConfirm:", JSON.stringify(deleteExerciseConfirm));
    const plan = plans.find(p => p.id === deleteExerciseConfirm.planId);
    if (!plan) { console.log("[DELETE] Plan not found!"); setDeleteExerciseConfirm(null); return; }
    console.log("[DELETE] plan.details:", JSON.stringify(plan.details));
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    console.log("[DELETE] lines before splice:", JSON.stringify(lines), "removing index:", deleteExerciseConfirm.lineIndex);
    lines.splice(deleteExerciseConfirm.lineIndex, 1);
    const newDetails = lines.join(separator);
    console.log("[DELETE] newDetails:", JSON.stringify(newDetails));
    const { error } = await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    if (error) console.error("[DELETE] Supabase error:", error);
    else console.log("[DELETE] Success");
    skipDayResetRef.current = true;
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
    setDeleteExerciseConfirm(null);
  };

  const editVilaSeconds = async (planId: string, lineIndex: number, currentSeconds: string) => {
    const newSec = prompt("Antal sekunder vila:", currentSeconds);
    if (!newSec) return;
    const seconds = parseInt(newSec) || parseInt(currentSeconds) || 30;
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    lines[lineIndex] = `Vila — 1×${seconds}`;
    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    skipDayResetRef.current = true;
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, details: newDetails } : p));
    triggerSave();
  };

  // Start replace exercise flow: open exercise picker filtered to the exercise's muscle group
  const startReplaceExercise = (planId: string, lineIndex: number, exerciseName: string) => {
    const exercise = allExercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
    const muscleGroup = exercise?.muscleGroup || null;
    setReplaceExerciseTarget({ planId, lineIndex, name: exerciseName });
    setShowExercisePicker(planId);
    setExerciseSearch("");
    setSelectedMuscle(muscleGroup);
    setIsWarmupMode(false);
  };

  const moveExercise = async (planId: string, lineIndex: number, direction: "up" | "down") => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    const targetIndex = direction === "up" ? lineIndex - 1 : lineIndex + 1;
    if (targetIndex < 0 || targetIndex >= lines.length) return;
    [lines[lineIndex], lines[targetIndex]] = [lines[targetIndex], lines[lineIndex]];
    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, details: newDetails } : p));
    triggerSave();
  };

  const adminBanner = onBack ? (
    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4 flex items-center justify-between">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-warning hover:text-warning/80 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Tillbaka till användarlistan
      </button>
      <span className="text-xs text-muted-foreground">Visar annan användares plan</span>
    </div>
  ) : null;

  if (mode === "loading") {
    return (
      <div>
        {adminBanner}
        <div className="flex items-center justify-center py-16">
          <Dumbbell className="w-8 h-8 text-primary animate-pulse" />
        </div>
      </div>);

  }

  // Calibration screen — shown once for users with active plan who haven't calibrated
  if (mode === "plan" && needsCalibration) {
    return (
      <PlanCalibrationDialog
        userId={userId}
        onDone={async () => {
          // Re-fetch the plan_start_date from profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("plan_start_date")
            .eq("user_id", userId)
            .single();
          if (profileData && (profileData as any).plan_start_date) {
            setPlanStartDate((profileData as any).plan_start_date);
          }
          setNeedsCalibration(false);
          setInitialWeekSet(false);
          fetchData();
        }}
      />
    );
  }

  // Choice screen
  if (mode === "choose") {
    return (
      <div className="space-y-6 animate-fade-in">
        {adminBanner}
        <div className="text-center space-y-2">
          <Dumbbell className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-black tracking-tight">Hur vill du träna?</h2>
          <p className="text-sm text-muted-foreground">
            Välj en plan eller skapa enskilda pass
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setMode("plan")}
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-all">

            <div className="flex items-start gap-3">
              <ChevronRight className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                <h3 className="font-bold text-sm">📋 Följ en plan</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Välj en färdig plan eller bygg ett schema med veckor och dagar
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("single")}
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-all">

            <div className="flex items-start gap-3">
              <Plus className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                <h3 className="font-bold text-sm">💪 Enskilda pass</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Skapa och bocka av egna pass utan att följa ett veckoschema
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>);

  }

  // Plan picker
  if (mode === "plan" && weeks.length === 0) {
    return (
      <div className="space-y-4 animate-fade-in">
        {adminBanner}
        <PlanPicker userId={userId} onBack={() => setMode("choose")} onDone={() => { setNeedsCalibration(false); setInitialWeekSet(false); setCurrentWeek(1); fetchData(); }} />
      </div>
    );
  }

  // Single workouts mode
  if (mode === "single") {
    const singlePlans = plans.filter((p) => p.week === 0).sort((a, b) => {
      const dateA = a.day.match(/^(\d{4}-\d{2}-\d{2})/) ? a.day : "0000";
      const dateB = b.day.match(/^(\d{4}-\d{2}-\d{2})/) ? b.day : "0000";
      return dateA.localeCompare(dateB);
    });

    // Helper: get ISO week number from day key
    const getIsoWeekFromKey = (dayKey: string): number => {
      const m = dayKey.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? getISOWeek(parseDateKey(m[1]) ?? new Date()) : getISOWeek(new Date());
    };

    // Helper: get day-of-week name from day key (Mån, Tis, ...)
    const getDayNameFromKey = (dayKey: string): string => {
      const m = dayKey.match(/^(\d{4}-\d{2}-\d{2})/);
      if (!m) return "Mån";
      const d = parseDateKey(m[1]);
      const jsDay = d?.getUTCDay() ?? 1; // 0=Sun, 1=Mon...
      return DAYS[jsDay === 0 ? 6 : jsDay - 1];
    };

    // Group plans by ISO week
    const weekGroups = new Map<number, PlanDay[]>();
    for (const p of singlePlans) {
      const wk = getIsoWeekFromKey(p.day);
      if (!weekGroups.has(wk)) weekGroups.set(wk, []);
      weekGroups.get(wk)!.push(p);
    }
    const singleWeeks = [...weekGroups.keys()].sort((a, b) => a - b);

    // Auto-set to today's ISO week when possible, otherwise keep the selected week or fall back to the current week
    const today = getTodayInfo();
    const currentIsoWeek = today.isoWeek;
    const todayPlan = singlePlans.find((p) => p.day.startsWith(today.dateKey));
    const todayWeek = todayPlan ? getIsoWeekFromKey(todayPlan.day) : currentIsoWeek;
    const effectiveWeek = singleWeeks.includes(todayWeek) ? todayWeek :
      (singleWeeks.includes(singleCurrentWeek) ? singleCurrentWeek :
      (singleWeeks.includes(currentIsoWeek) ? currentIsoWeek : currentIsoWeek));

    if (!autoSelectedSingleTodayRef.current && singleCurrentWeek !== effectiveWeek) {
      autoSelectedSingleTodayRef.current = true;
      setSingleCurrentWeek(effectiveWeek);
    }

    const weekPlans = weekGroups.get(effectiveWeek) || [];

    // Group weekPlans by day-of-week for tabs
    const dayGroupsInWeek: { dayName: string; dayIndex: number; plans: PlanDay[] }[] = [];
    const dayMap = new Map<string, PlanDay[]>();
    for (const p of weekPlans) {
      const dn = getDayNameFromKey(p.day);
      if (!dayMap.has(dn)) dayMap.set(dn, []);
      dayMap.get(dn)!.push(p);
    }
    for (const dayName of DAYS) {
      if (dayMap.has(dayName)) {
        dayGroupsInWeek.push({ dayName, dayIndex: DAYS.indexOf(dayName), plans: dayMap.get(dayName)! });
      }
    }

    const safeDayIdx = Math.min(singleActiveDayIdx, Math.max(0, dayGroupsInWeek.length - 1));
    const activeDayGroup = dayGroupsInWeek[safeDayIdx];
    const visiblePlans = isMobile && dayGroupsInWeek.length > 1 && activeDayGroup ? activeDayGroup.plans : weekPlans;
    const todayGroupIndex = dayGroupsInWeek.findIndex((dg) =>
      dg.plans.some((p) => p.day.startsWith(today.dateKey)) ||
      (dg.dayName === today.dayName && effectiveWeek === currentIsoWeek)
    );

    if (todayGroupIndex >= 0 && singleActiveDayIdx !== todayGroupIndex) {
      setSingleActiveDayIdx(todayGroupIndex);
    }

    const weekDoneCount = weekPlans.filter((p) => completions[`0-${p.day}`]?.done).length;
    const totalDoneCount = singlePlans.filter((p) => completions[`0-${p.day}`]?.done).length;
    const singleWeekIdx = singleWeeks.indexOf(effectiveWeek);

    return (
      <>
      <div className="space-y-4 animate-fade-in">
        {adminBanner}
        {singlePlans.length === 0 && (
          <button
            onClick={() => setMode("choose")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Tillbaka
          </button>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">Mina pass</h2>
            <p className="text-xs text-muted-foreground">
              {totalDoneCount} av {singlePlans.length} avklarade totalt
            </p>
          </div>
          {singlePlans.length > 0 &&
          <div className="flex flex-col items-center gap-0.5">
              <button
              onClick={leavePlan}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Rensa alla pass">
                <LogOut className="w-4 h-4" />
              </button>
              <span className="text-[9px] text-muted-foreground leading-tight">Rensa alla</span>
            </div>
          }
        </div>

        <EventProgressBar userId={userId} />
        <SpotifyWidget userId={userId} />

        {/* Week navigation */}
        {(singleWeeks.length > 0 || singlePlans.length > 0) && (
          <div className="flex flex-col gap-3">
            <div
              className="flex items-center justify-center py-2 select-none touch-pan-x"
              onTouchStart={(e) => { (e.currentTarget as any)._swipeX = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as any)._swipeX;
                if (startX == null) return;
                const dx = e.changedTouches[0].clientX - startX;
                if (Math.abs(dx) > 40) {
                  if (dx < 0 && singleWeekIdx < singleWeeks.length - 1) { setSingleCurrentWeek(singleWeeks[singleWeekIdx + 1]); setSingleActiveDayIdx(0); }
                  else if (dx > 0 && singleWeekIdx > 0) { setSingleCurrentWeek(singleWeeks[singleWeekIdx - 1]); setSingleActiveDayIdx(0); }
                }
                (e.currentTarget as any)._swipeX = null;
              }}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (singleWeekIdx > 0) { setSingleCurrentWeek(singleWeeks[singleWeekIdx - 1]); setSingleActiveDayIdx(0); } }}
                  disabled={singleWeekIdx <= 0}
                  className="p-1 text-muted-foreground disabled:opacity-20"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1.5 min-w-[120px] justify-center">
                  {singleWeeks.map((wk) => {
                    const isCurrent = wk === effectiveWeek;
                    const isThisWeek = wk === currentIsoWeek;
                    const distance = Math.abs(singleWeeks.indexOf(wk) - singleWeekIdx);
                    if (distance > 2) return null;
                    return (
                      <button
                        key={wk}
                        onClick={() => { setSingleCurrentWeek(wk); setSingleActiveDayIdx(0); }}
                        className={`flex-shrink-0 rounded-full text-xs font-semibold transition-all ${
                          isCurrent
                            ? "px-4 py-1.5 bg-primary text-primary-foreground"
                            : isThisWeek
                            ? "px-3 py-1 bg-muted text-foreground border border-primary/30"
                            : distance === 1
                            ? "px-3 py-1 text-muted-foreground hover:bg-muted"
                            : "px-2.5 py-1 text-muted-foreground/50 text-[10px]"
                        }`}
                      >
                        V{wk}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => { if (singleWeekIdx < singleWeeks.length - 1) { setSingleCurrentWeek(singleWeeks[singleWeekIdx + 1]); setSingleActiveDayIdx(0); } }}
                  disabled={singleWeekIdx >= singleWeeks.length - 1}
                  className="p-1 text-muted-foreground disabled:opacity-20"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Week progress */}
            {weekPlans.length > 0 && (
              <div>
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${weekPlans.length > 0 ? Math.round(weekDoneCount / weekPlans.length * 100) : 0}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  {weekDoneCount} av {weekPlans.length} pass · Vecka {effectiveWeek}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Day tabs */}
        {isMobile && dayGroupsInWeek.length > 1 && (
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
            {dayGroupsInWeek.map((dg, idx) => {
              const dgDone = dg.plans.every(p => completions[`0-${p.day}`]?.done);
              const dgSkipped = dg.plans.every(p => completions[`0-${p.day}`]?.skipped);
              const todayDayNames = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
              const todayName = todayDayNames[new Date().getDay()];
              const isToday = dg.dayName === todayName && effectiveWeek === currentIsoWeek;
              const isActive = idx === safeDayIdx;
              return (
                <button
                  key={dg.dayName}
                  onClick={() => { setSingleActiveDayIdx(idx); setExpandedDay(null); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? dgDone
                        ? "bg-success text-success-foreground"
                        : isToday
                        ? "bg-warning/10 text-warning border border-warning/30"
                        : "bg-primary text-primary-foreground"
                      : dgDone
                      ? "bg-success/20 text-success"
                      : dgSkipped
                      ? "bg-destructive/20 text-destructive"
                      : isToday
                      ? "bg-warning/20 text-warning"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {dg.dayName}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {visiblePlans.map((plan) => {
            const weekdayName = getWeekdayFromDayKey(plan.day);
            const key = `0-${plan.day}`;
            const completion = completions[key];
            const isDone = completion?.done || false;
            const isSkipped = completion?.skipped || false;
            const expanded = true;
            const Icon = getSessionIcon(plan.session_name);
            const colorClass = getSessionColor(plan.session_name);
            const isExercisePickerOpen = showExercisePicker === plan.id;

            return (
              <div
                key={plan.id}
                className={`rounded-lg border bg-card transition-colors ${isDone ? "workout-done opacity-80" : ""} ${isSkipped ? "opacity-60" : ""}`}>

                <div className="flex items-center gap-3 px-4 pt-4 pb-2 cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; setExpandedDay(expanded ? null : key); }}>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {e.stopPropagation();toggleDone(0, plan.day);}}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      isDone ? "bg-success border-success" : "border-muted-foreground/30 hover:border-primary"}`
                      }
                      title="Genomfört">
                      {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                    </button>
                    <button
                      onClick={(e) => {e.stopPropagation();toggleSkipped(0, plan.day);}}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isSkipped ? "bg-destructive text-destructive-foreground" : "text-muted-foreground/40 hover:text-destructive"}`
                      }
                      title="Markera som missat">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className={`flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {weekdayName && (
                      <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">{weekdayName}</span>
                    )}
                    <span className={`font-semibold text-sm block break-words ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {plan.session_name}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {formatDayDisplay(plan.day)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const ownLines = comments[key]?.trim() ? comments[key].trim().split("\n").filter(Boolean).length : 0;
                      const dayFriendComments = friendComments.filter((c) => c.plan_id === plan.id);
                      const totalComments = ownLines + dayFriendComments.length;
                      return totalComments > 0 ?
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <MessageCircle className="w-3 h-3" /> {totalComments}
                        </span> :
                      null;
                    })()}
                    
                  </div>
                </div>
                {/* Action buttons row */}
                <div className="grid grid-cols-2 gap-1.5 px-4 pb-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameDialog({ planId: plan.id, currentName: plan.session_name, week: plan.week, day: plan.day, sessionName: plan.session_name });
                      setRenameInput(plan.session_name);
                    }}
                    className="relative z-20 min-h-9 flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                    title="Inställningar">
                    <Settings className="w-3.5 h-3.5" />
                    <span>Inställningar</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareTarget({ plan, completion: completions[key] || { week: plan.week, day: plan.day, done: false, skipped: false, user_comment: "" } as Completion });
                    }}
                    className="min-h-9 flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                    title="Dela pass">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Dela</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSaveWorkoutSource({ details: plan.details, tempo: plan.tempo, defaultName: plan.session_name });
                      setSaveWorkoutName(plan.session_name);
                      setSaveWorkoutVisibility("private");
                    }}
                    className="min-h-9 flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                    title="Spara pass">
                    <Download className="w-3.5 h-3.5" />
                    <span>Spara</span>
                  </button>
                  <button
                    onClick={(e) => {e.stopPropagation();deleteSingleWorkout(plan);}}
                    className="min-h-9 flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted"
                    title="Ta bort">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {expanded &&
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {/* Exercises / details */}
                    {plan.details &&
                  (() => { const exerciseLines = plan.details.split("\n").filter(Boolean); return <div className="space-y-2">
                        {exerciseLines.map((line, i) => {
                      const { name, weight } = parseExerciseWeight(line);
                      
                      // Check if this is a conditioning exercise (format includes "min", "/km", or "km")
                      const isCondFormat = weight && (weight.includes("min") || weight.includes("/km") || /\d+\s*km/i.test(weight));
                      
                      if (isCondFormat) {
                        const condTimeM = weight.match(/(\d+)\s*min/);
                        const condTempoM = weight.match(/([\d:.]+)\/km/);
                        const condDistM = weight.match(/([\d.,]+)\s*km(?!\/)/);
                        const planCondTime = condTimeM ? condTimeM[1] : "";
                        const planCondTempo = condTempoM ? condTempoM[1] : "";
                        const planCondDist = condDistM ? condDistM[1] : "";

                        // Read saved conditioning data from logged_weights
                        const condKeyInline = `__cond__${name}`;
                        const compForCond = completions[key];
                        const rawCondSaved = compForCond?.logged_weights?.[condKeyInline];
                        let condSavedInline: Record<string, any> | null = null;
                        if (rawCondSaved) {
                          try {
                            const p = typeof rawCondSaved === "string" ? JSON.parse(rawCondSaved) : rawCondSaved;
                            if (p && typeof p === "object") condSavedInline = p;
                          } catch {}
                        }
                        const displayCondTime = condSavedInline?.time || planCondTime;
                        const displayCondDist = condSavedInline?.dist || planCondDist;
                        let displayCondTempo = condSavedInline?.tempo || planCondTempo;
                        if (!displayCondTempo && displayCondTime && displayCondDist) {
                          const t = parseFloat(displayCondTime);
                          const d = parseFloat(String(displayCondDist).replace(",", "."));
                          if (t > 0 && d > 0) {
                            const tempoMin = t / d;
                            const mins = Math.floor(tempoMin);
                            const secs = Math.round((tempoMin - mins) * 60);
                            displayCondTempo = `${mins}:${secs.toString().padStart(2, '0')}`;
                          }
                        }

                        const saveCondFieldInline = async (field: string, value: any) => {
                          await updateCompletionWeights(plan.week, plan.day, (existing) => {
                            let currentData: Record<string, any> = { time: planCondTime, dist: planCondDist, tempo: planCondTempo };
                            const rawCurrent = existing[condKeyInline];
                            if (rawCurrent) {
                              try {
                                const parsed = typeof rawCurrent === "string" ? JSON.parse(rawCurrent) : rawCurrent;
                                if (parsed && typeof parsed === "object") currentData = { ...currentData, ...parsed };
                              } catch {}
                            }
                            const updated = { ...currentData, [field]: value };
                            if (field === "time" || field === "dist") {
                              const t2 = parseFloat(field === "time" ? value : updated.time || "0");
                              const d2 = parseFloat(String(field === "dist" ? value : updated.dist || "0").replace(",", "."));
                              if (t2 > 0 && d2 > 0) {
                                const tm = t2 / d2;
                                const mn = Math.floor(tm);
                                const sc = Math.round((tm - mn) * 60);
                                updated.tempo = `${mn}:${sc.toString().padStart(2, "0")}`;
                              }
                            }
                            return { ...existing, [condKeyInline]: JSON.stringify(updated) };
                          });
                        };

                        // Check if this conditioning line has been saved (has __cond__ data with actual values)
                        const hasSavedCondData = (() => {
                          if (!condSavedInline) return false;
                          return !!(condSavedInline.time || condSavedInline.dist || condSavedInline.tempo || condSavedInline.pulse);
                        })();

                        return (
                          <ConditioningEditCard
                            key={i}
                            name={name}
                            lineIndex={i}
                            planId={plan.id}
                            planCondTime={planCondTime}
                            planCondDist={planCondDist}
                            planCondTempo={planCondTempo}
                            savedData={condSavedInline}
                            hasSavedData={hasSavedCondData}
                            exerciseLinesCount={exerciseLines.length}
                            isCompleted={isConditioningDone(key, name)}
                            onToggleCompleted={() => toggleConditioningDone(plan.week, plan.day, name)}
                            onMoveUp={() => moveExercise(plan.id, i, "up")}
                            onMoveDown={() => moveExercise(plan.id, i, "down")}
                            onShowInfo={() => setExerciseInfoState({ name })}
                            onDelete={() => setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(name) })}
                            onSave={async (data) => {
                              // Save to __cond__ logged_weights
                              await updateCompletionWeights(plan.week, plan.day, (existing) => {
                                const condKey = `__cond__${name}`;
                                return { ...existing, [condKey]: JSON.stringify(data) };
                              });
                              // Also update plan details text
                              const infoParts: string[] = [];
                              if (data.time) infoParts.push(`${data.time} min`);
                              if (data.tempo) infoParts.push(`${data.tempo}/km`);
                              if (data.dist) infoParts.push(`${data.dist} km`);
                              if (data.pulse) infoParts.push(`${data.pulse} bpm`);
                              const entry = infoParts.length > 0 ? `${name} — ${infoParts.join(", ")}` : name;
                              const separator = plan.details.includes("\n") ? "\n" : "; ";
                              const allLines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                              allLines[i] = entry;
                              const newDetails = allLines.join(separator);
                              await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                              setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
                              triggerSave();
                            }}
                          />);
                      }
                      
                      // Parse structured format: "3×10 @ 80 kg" or "3×10"
                      const { clean: cleanWeight, rpe: singleRpe } = extractRpe(weight || '');
                      const structMatch = cleanWeight?.match(/^(\d+)[×x](\d+)(?:\s*@\s*(.+))?$/i);
                      // Fallback: extract sets from "NxSomething" patterns like "3×AMRAP", "3×60s"
                      const fallbackSetsMatch = !structMatch && cleanWeight ? cleanWeight.match(/^(\d+)\s*[×x]\s*\S+/) : null;
                      const sets = structMatch ? structMatch[1] : fallbackSetsMatch ? fallbackSetsMatch[1] : null;
                      const reps = structMatch ? structMatch[2] : null;
                      const rawKg = structMatch && structMatch[3] ? structMatch[3] : !structMatch && !fallbackSetsMatch && cleanWeight ? cleanWeight : null;
                      const kg = rawKg ? rawKg.replace(/\s*kg\s*/i, '').trim() || null : null;

                      // Special Vila row for single mode
                      if (/^vila$/i.test(name.trim())) {
                        const vilaSec = reps || "60";
                        return (
                          <div key={i} className="bg-warning/10 rounded-lg p-3 border border-warning/30 flex items-center justify-between">
                            <span
                              className="font-semibold text-sm text-warning cursor-pointer hover:underline"
                              onClick={() => editVilaSeconds(plan.id, i, vilaSec)}
                            >
                              🛏️ Vila {vilaSec}s mellan rundor
                            </span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => editVilaSeconds(plan.id, i, vilaSec)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Redigera vila"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: "Vila" })} className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Ta bort vila"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        );
                      }

                      const isEditing = editingExercise?.planId === plan.id && editingExercise?.lineIndex === i;

                      if (isEditing) {
                        return (
                          <div key={i} className="bg-secondary/60 rounded-lg p-3 border border-primary/30 space-y-2 animate-fade-in">
                                <span className="font-semibold text-sm text-foreground">{editingExercise.name}</span>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Set</label>
                                    <input type="number" inputMode="numeric" value={editingExercise.sets} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, sets: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Reps</label>
                                    <input type="number" inputMode="numeric" value={editingExercise.reps} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, reps: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Vikt (kg)</label>
                                    <input type="number" inputMode="decimal" value={editingExercise.weight} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, weight: e.target.value } : null)} placeholder="—" className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono placeholder:text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveEditedExercise()} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold">Spara</button>
                                  <button onClick={() => setEditingExercise(null)} className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs">Avbryt</button>
                                </div>
                              </div>);

                      }

                      const setsCountSingle = sets ? parseInt(sets) : 1;
                      const setsStrSingle = getSetsDone(key, name);

                      return (
                        <div key={i} className="bg-secondary/60 rounded-none p-3 border-y border-border/50 -mx-4">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-sm text-foreground">
                                  {toTitleCase(name)}
                                  {singleRpe && <span className="text-xs font-normal text-muted-foreground ml-1.5">{singleRpe}</span>}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <div className="flex flex-col">
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === exerciseLines.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3.5 h-3.5" /></button>
                                  </div>
                                  <button
                                onClick={(e) => {e.stopPropagation();setExerciseInfoState({ name: name });}}
                                className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                                title="Visa övningsinformation">
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                onClick={() => setEditingExercise({
                                  planId: plan.id,
                                  lineIndex: i,
                                  name,
                                  originalName: name,
                                  sets: sets || "3",
                                  reps: reps || "10",
                                  weight: kg?.replace(/\s*kg\s*/i, "").trim() || ""
                                })}
                                className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                                title="Redigera">
                                    <Dumbbell className="w-3 h-3" />
                                  </button>
                                  <button
                                 onClick={(e) => {e.stopPropagation();e.preventDefault();setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(name) });}}
                                 className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors touch-manipulation">
                                     <X className="w-4 h-4" />
                                   </button>
                                </div>
                              </div>
                              {/* Copied-from-previous progression reminder */}
                              {isCopiedExercise(key, name) && (
                                <div className="pl-1 mb-1 border-l-2 border-primary/40 bg-primary/5 px-2 py-1.5 rounded-r">
                                  <p className="text-[10px] text-foreground flex items-start gap-1">
                                    <span className="text-primary">💡</span>
                                    <span>Vikt/reps kopierade från förra passet. <span className="font-semibold">Justera själv</span> för att säkerställa progression.</span>
                                  </p>
                                </div>
                              )}
                              {/* Last logged weight note for single workouts */}
                              {(() => {
                                const lastW = findLastWeight(name);
                                const lastKg = lastW ? { kg: lastW.replace(/\s*kg.*/, '').replace(/.*@\s*/, '').trim(), reps: lastW.match(/\((\d+)\s*reps\)/)?.[1] || null } : null;
                                if (!lastKg || !lastKg.kg) return null;
                                const hasCurrentData = getSetData(key, name).some(s => s.kg && parseFloat(s.kg) !== 0);
                                if (hasCurrentData) return null;
                                const kgVal = parseFloat(lastKg.kg);
                                const isNegative = kgVal < 0;
                                const effectiveKg = isNegative && profileWeight ? profileWeight + kgVal : null;
                                return (
                                  <div className="pl-1 mb-1">
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Weight className="w-3 h-3" />
                                      Senast: <span className="font-mono font-semibold text-foreground">{lastKg.kg} kg{lastKg.reps ? ` (${lastKg.reps} reps)` : ''}</span>
                                    </p>
                                    {isNegative && effectiveKg !== null && (
                                      <p className="text-[10px] text-muted-foreground pl-4">= {Math.round(effectiveKg * 10) / 10} kg effektiv vikt (kroppsvikt {profileWeight} kg)</p>
                                    )}
                                    {isNegative && !profileWeight && (
                                       <button onClick={() => setShowWeightPrompt(true)} className="text-[10px] text-primary pl-4 underline text-left">⚠ Ange din kroppsvikt</button>
                                    )}
                                    <p className="text-[10px] text-muted-foreground pl-4">— öka vikten själv för progression</p>
                                  </div>
                                );
                              })()}
                              <div className="space-y-1">
                                  {(() => {
                                    const setData = getSetData(key, name);
                                    const defaultKg = kg || "";
                                    const circuitSecMatch = plan.is_circuit ? plan.tempo?.match(/^circuit:(\d+)(?::\d+)?(?::\d+)?$/) : null;
                                    const circuitDefaultSec = circuitSecMatch ? circuitSecMatch[1] : null;
                                    const defaultReps = circuitDefaultSec || reps || "10";
                                     return Array.from({ length: setsCountSingle }, (_, si) => {
                                       const isSetDone = setsStrSingle[si] === "1";
                                       const saved = setData[si];
                                       // Inherit reps/kg from the previous set in this exercise when this set has no logged data
                                       const prevSaved = si > 0 ? setData[si - 1] : undefined;
                                       const inheritedReps = prevSaved?.reps && prevSaved.reps.trim() ? prevSaved.reps : defaultReps;
                                       const inheritedKg = prevSaved?.kg && prevSaved.kg.trim() ? prevSaved.kg : defaultKg;
                                       return (
                                         <div key={si}>
                                           <div className={`flex items-center gap-1.5 py-0.5 rounded px-1 ${isSetDone ? "opacity-60" : ""}`}>
                                           <Checkbox checked={isSetDone} onCheckedChange={() => toggleSetDone(0, plan.day, name, si, setsCountSingle, inheritedKg, inheritedReps)} className="h-5 w-5" />
                                           <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">S{si + 1}</span>
                                           <AutoSaveInput type="number" inputMode="numeric" initialValue={circuitDefaultSec ? ((!saved?.reps || saved.reps === reps) ? "" : saved.reps) : (saved?.reps || inheritedReps)} placeholder={circuitDefaultSec ? (findLastReps(name, si) || inheritedReps || circuitDefaultSec) : undefined} onSave={(v) => saveSetFieldData(0, plan.day, name, si, 'reps', v, setsCountSingle, inheritedKg, inheritedReps)} className="w-11 bg-primary/10 text-foreground text-xs px-1 py-0.5 rounded border border-primary/30 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                           <span className="text-[10px] text-muted-foreground">{/farmers?\s*walk|yoke\s*walk|sled|bear\s*crawl/i.test(name) ? "m" : (plan.is_circuit || /^(sido)?planka$|^vila$/i.test(name.trim()) || customExercises.find(ce => ce.name.toLowerCase() === name.trim().toLowerCase())?.is_time_based) ? "sek" : "reps"}</span>
                                           <AutoSaveInput type="number" inputMode="decimal" initialValue={saved?.kg || inheritedKg} onSave={(v) => saveSetFieldData(0, plan.day, name, si, 'kg', v, setsCountSingle, inheritedKg, inheritedReps)} placeholder="—" className="w-14 bg-primary/10 text-foreground text-xs px-1 py-0.5 rounded border border-primary/30 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                          <span className="text-[10px] text-muted-foreground">kg</span>
                                          </div>
                                          {(() => {
                                            const currentKg = parseFloat(saved?.kg || defaultKg);
                                            if (!isNaN(currentKg) && currentKg < 0) {
                                              if (profileWeight) {
                                                return <p className="text-[9px] text-muted-foreground pl-8 -mt-0.5">= {Math.round((profileWeight + currentKg) * 10) / 10} kg effektiv</p>;
                                              } else {
                                                return <p className="text-[9px] text-warning pl-8 -mt-0.5">⚠ Ange vikt i profilen</p>;
                                              }
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); modifySetCount(plan.id, i, -1, 0, plan.day); }}
                                    disabled={setsCountSingle <= 1}
                                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                                    title="Ta bort set">
                                    − Set
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); modifySetCount(plan.id, i, 1, 0, plan.day); }}
                                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-primary transition-colors"
                                    title="Lägg till set">
                                    + Set
                                  </button>
                                </div>
                            </div>);

                    })}
                      </div>; })()
                  }

                    {/* Circuit start button for single mode */}
                    {plan.is_circuit && plan.details && (() => {
                      const exerciseLines = plan.details.split("\n").filter(Boolean);
                      const parsed = exerciseLines.map(l => parseExerciseWeight(l)).filter(p => p.name && !/^vila$/i.test(p.name.trim()));
                      if (parsed.length === 0) return null;
                      const circuitMatch = plan.tempo?.match(/^circuit:(\d+)(?::(\d+))?(?::(\d+))?$/);
                      const defaultSec = circuitMatch ? parseInt(circuitMatch[1]) : 40;
                      const rounds = circuitMatch?.[2] ? parseInt(circuitMatch[2]) : 3;
                      // Rest: prefer Vila line from details, fallback to tempo
                      const vilaLine = exerciseLines.find(l => /^vila\s/i.test(parseExerciseWeight(l).name?.trim() || ""));
                      let restSec = circuitMatch?.[3] ? parseInt(circuitMatch[3]) : 0;
                      if (vilaLine) {
                        const vilaMatch = vilaLine.match(/\d+[×x](\d+)/i);
                        if (vilaMatch) restSec = parseInt(vilaMatch[1]) || restSec;
                      }
                      const exerciseNames = parsed.map(p => p.name);
                      const perExSec: number[][] = parsed.map(p => {
                        // Get per-round (per-set) values from set data
                        const setData = getSetData(key, p.name);
                        const baseSec = (() => {
                          if (p.weight) {
                            const repsMatch = p.weight.match(/\d+×(\d+)/);
                            if (repsMatch) return parseInt(repsMatch[1]) || defaultSec;
                          }
                          return defaultSec;
                        })();
                        // Build per-round array
                        return Array.from({ length: rounds }, (_, ri) => {
                          const sd = setData[ri];
                          if (sd?.reps) {
                            const v = parseInt(sd.reps);
                            if (v > 0) return v;
                          }
                          return baseSec;
                        });
                      });
                      return (
                        <button
                          onClick={() => setCircuitTimer({ exercises: exerciseNames, workSeconds: defaultSec, exerciseSeconds: perExSec, roundCount: rounds, restSeconds: restSec, weekDayKey: key, headerIndex: 0 })}
                          className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                          <Play className="w-4 h-4" /> Starta
                        </button>
                      );
                    })()}

                    {/* Round checkboxes for single mode circuit */}
                    {plan.is_circuit && plan.tempo && (() => {
                      const circuitMatch = plan.tempo.match(/^circuit:(\d+)(?::(\d+))?(?::(\d+))?$/);
                      if (!circuitMatch) return null;
                      const rounds = circuitMatch[2] ? parseInt(circuitMatch[2]) : 3;
                      if (rounds <= 0) return null;
                      const roundKey = `__wod_rounds_done_0__`;
                      const comp = completions[key];
                      const lw = comp?.logged_weights as Record<string, any> | null;
                      const roundsDoneStr = (lw?.[roundKey] as string) || "";
                      return (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {Array.from({ length: rounds }, (_, ri) => {
                            const isRoundDone = roundsDoneStr[ri] === "1";
                            return (
                              <button
                                key={ri}
                                onClick={async () => {
                                  const newStr = Array.from({ length: rounds }, (_, j) => {
                                    if (j === ri) return isRoundDone ? "0" : "1";
                                    return (roundsDoneStr[j] || "0");
                                  }).join("");
                                  const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                  const updated = { ...existing, [roundKey]: newStr } as any;
                                  setCompletions(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], week: 0, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated }
                                  }));
                                  safeUpsertCompletion(0, plan.day, { logged_weights: updated } as any);
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${isRoundDone ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                              >
                                <Check className="w-3 h-3" />
                                R{ri + 1}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {(() => {
                      if (!plan.details) return null;
                      const allLines = plan.details.split("\n").filter(Boolean);
                      const comp = completions[key];
                      const lw = comp?.logged_weights as Record<string, any> | null;
                      let totalDist = 0;
                      let distExerciseCount = 0;

                      for (const line of allLines) {
                        const { name: eName, weight: eWeight } = parseExerciseWeight(line);
                        const isCondFmt = eWeight && (eWeight.includes("min") || eWeight.includes("/km") || /\d+\s*km/i.test(eWeight));
                        const isIntervalFmt = /(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*min/i.test(line);

                        if (isCondFmt && lw) {
                          const condKey = `__cond__${eName}`;
                          const raw = lw[condKey];
                          if (raw) {
                            try {
                              const data = typeof raw === "string" ? JSON.parse(raw) : raw;
                              if (data && typeof data === "object") {
                                const intervals = Array.isArray(data.intervals) ? data.intervals : [];
                                let lineDist = 0;
                                if (intervals.length > 0) {
                                  for (const iv of intervals) {
                                    const d = parseFloat(iv.dist) || 0;
                                    if (d > 0) { lineDist += d; continue; }
                                    const t = parseFloat(iv.time) || 0;
                                    const tp = iv.tempo;
                                    if (t > 0 && tp) {
                                      const pair = String(tp).match(/^(\d+)[:\.](\d+)$/);
                                      const single = String(tp).match(/^(\d+)$/);
                                      let mpk = 0;
                                      if (pair) mpk = (parseInt(pair[1]) * 60 + parseInt(pair[2])) / 60;
                                      else if (single) mpk = parseInt(single[1]);
                                      if (mpk > 0) lineDist += t / mpk;
                                    }
                                  }
                                } else {
                                  const dd = parseFloat(data.dist) || 0;
                                  if (dd > 0) { lineDist = dd; }
                                  else {
                                    const tt = parseFloat(data.time) || 0;
                                    const tpd = data.tempo;
                                    if (tt > 0 && tpd) {
                                      const pair = String(tpd).match(/^(\d+)[:\.](\d+)$/);
                                      const single = String(tpd).match(/^(\d+)$/);
                                      let mpk = 0;
                                      if (pair) mpk = (parseInt(pair[1]) * 60 + parseInt(pair[2])) / 60;
                                      else if (single) mpk = parseInt(single[1]);
                                      if (mpk > 0) lineDist = tt / mpk;
                                    }
                                  }
                                }
                                if (lineDist > 0) { totalDist += lineDist; distExerciseCount++; }
                              }
                            } catch {}
                          }
                        } else if (isIntervalFmt && lw) {
                          const condKey = `__cond__${line}`;
                          const raw = lw[condKey];
                          if (raw) {
                            try {
                              const data = typeof raw === "string" ? JSON.parse(raw) : raw;
                              if (data && typeof data === "object") {
                                const intervals = Array.isArray(data.intervals) ? data.intervals : [];
                                let lineDist = 0;
                                for (const iv of intervals) {
                                  const d = parseFloat(iv.dist) || 0;
                                  if (d > 0) { lineDist += d; continue; }
                                  const t = parseFloat(iv.time) || 0;
                                  const tp = iv.tempo;
                                  if (t > 0 && tp) {
                                    const pair = String(tp).match(/^(\d+)[:\.](\d+)$/);
                                    const single = String(tp).match(/^(\d+)$/);
                                    let mpk = 0;
                                    if (pair) mpk = (parseInt(pair[1]) * 60 + parseInt(pair[2])) / 60;
                                    else if (single) mpk = parseInt(single[1]);
                                    if (mpk > 0) lineDist += t / mpk;
                                  }
                                }
                                if (lineDist > 0) { totalDist += lineDist; distExerciseCount++; }
                              }
                            } catch {}
                          }
                        }
                      }

                      if (distExerciseCount < 2 || totalDist <= 0) return null;

                      return (
                        <div className="bg-primary/10 rounded-lg p-3 border border-primary/30 flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Route className="w-4 h-4 text-primary" />
                            Total distans
                          </span>
                          <span className="text-sm font-mono font-bold text-primary">
                            {Math.round(totalDist * 100) / 100} km
                          </span>
                        </div>
                      );
                    })()}

                    {/* Reps/sets/weight dialog — modal when replacing, inline when adding */}
                    {weightDialog && weightDialog.planId === plan.id && (() => {
                      const isReplaceMode = !!(replaceExerciseTarget && replaceExerciseTarget.planId === plan.id);
                      const dialogContent = (
                        <div className={isReplaceMode
                          ? "bg-background rounded-lg p-4 space-y-3 animate-fade-in border border-primary/30 w-full max-w-sm shadow-2xl"
                          : "bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-primary/30"}>
                          <h4 className="text-sm font-bold flex items-center gap-1.5">
                            <Dumbbell className="w-4 h-4 text-primary" />
                            {weightDialog.exerciseName}
                          </h4>
                          {weightDialog.lastWeight &&
                            <div className="text-xs text-muted-foreground">
                              Senast: <span className="font-mono text-foreground">{weightDialog.lastWeight}</span>
                            </div>
                          }
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Set</label>
                              <input
                                type="number"
                                min="1"
                                value={setsInput}
                                onChange={(e) => setSetsInput(e.target.value)}
                                className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block cursor-pointer hover:text-primary" onClick={() => setRepsUnit(u => u === "reps" ? "sek" : "reps")}>{repsUnit === "sek" ? "Sek ⇄" : "Reps ⇄"}</label>
                              <input
                                type="number"
                                min="1"
                                value={repsInput}
                                onChange={(e) => setRepsInput(e.target.value)}
                                className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Vikt (kg)</label>
                              <input
                                type="text"
                                value={weightInput}
                                onChange={(e) => setWeightInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addExerciseWithWeight(weightInput.trim() || null)}
                                placeholder="—"
                                className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => addExerciseWithWeight(weightInput.trim() || null)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">
                              <Plus className="w-3.5 h-3.5" /> {isReplaceMode ? "Byt ut" : "Lägg till"}
                            </button>
                            <button
                              onClick={() => { setWeightDialog(null); setWeightInput(""); setRepsInput("10"); setSetsInput("3"); setRepsUnit("reps"); setReplaceExerciseTarget(null); }}
                              className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                              Avbryt
                            </button>
                          </div>
                        </div>
                      );
                      if (isReplaceMode) {
                        return createPortal(
                          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setWeightDialog(null); setWeightInput(""); setRepsInput("10"); setSetsInput("3"); setRepsUnit("reps"); setReplaceExerciseTarget(null); }} />
                            <div className="relative w-full max-w-sm">{dialogContent}</div>
                          </div>,
                          document.body
                        );
                      }
                      return dialogContent;
                    })()}

                    {/* Conditioning exercise dialog */}
                    {conditioningDialog && conditioningDialog.planId === plan.id &&
                  <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-warning/30">
                        <h4 className="text-sm font-bold flex items-center gap-1.5">
                          <Footprints className="w-4 h-4 text-warning" />
                          {conditioningDialog.exerciseName}
                        </h4>
                        {condTempoInput && !isStairMachine(conditioningDialog.exerciseName) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Timer className="w-3 h-3" /> Senast tempo: <span className="font-mono font-semibold text-foreground">{condTempoInput}/km</span>
                          </p>
                        )}
                        {conditioningDialog.exerciseName.toLowerCase().includes("intervall") && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Antal intervaller</label>
                              <input type="number" inputMode="numeric" value={condIntervalsInput} onChange={(e) => setCondIntervalsInput(e.target.value)} placeholder="t.ex. 5" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Vila (min)</label>
                              <input type="number" inputMode="numeric" value={condRestInput} onChange={(e) => setCondRestInput(e.target.value)} placeholder="t.ex. 2" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                          </div>
                        )}
                        {isStairMachine(conditioningDialog.exerciseName) ? (
                          <>
                            <div className="space-y-3">
                              <div className="mb-4">
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Tid</label>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 relative">
                                <input type="number" inputMode="numeric" min="0" value={condTimeHours} onChange={(e) => handleCondTimeChange('h', e.target.value, false)} placeholder="0" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium">tim</span>
                              </div>
                              <span className="text-muted-foreground font-bold text-sm pb-1">:</span>
                              <div className="flex-1 relative">
                                <input type="number" inputMode="numeric" min="0" max="59" value={condTimeMinutes} onChange={(e) => handleCondTimeChange('m', e.target.value, false)} placeholder="0" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium">min</span>
                              </div>
                              <span className="text-muted-foreground font-bold text-sm pb-1">:</span>
                              <div className="flex-1 relative">
                                <input type="number" inputMode="numeric" min="0" max="59" value={condTimeSeconds} onChange={(e) => handleCondTimeChange('s', e.target.value, false)} placeholder="0" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium">sek</span>
                              </div>
                            </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">SPM (steg/min)</label>
                                <input type="number" inputMode="numeric" value={condSpmInput} onChange={(e) => setCondSpmInput(e.target.value)} placeholder="t.ex. 80" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              </div>
                            </div>
                            {(() => {
                              const time = condTimeTotalMin;
                              const spm = parseFloat(condSpmInput.replace(",", "."));
                              if (time > 0 && spm > 0) {
                                return (
                                  <div className="bg-primary/10 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                                    <span className="text-muted-foreground">Totalt:</span>
                                    <span className="font-mono font-bold text-foreground">{Math.round(time * spm)} steg</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                              <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                          </>
                        ) : (
                          <>
                        <div className="mb-4">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Tid</label>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 relative">
                              <input type="number" inputMode="numeric" min="0" value={condTimeHours} onChange={(e) => handleCondTimeChange('h', e.target.value)} placeholder="0" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium">tim</span>
                            </div>
                            <span className="text-muted-foreground font-bold text-sm pb-1">:</span>
                            <div className="flex-1 relative">
                              <input type="number" inputMode="numeric" min="0" max="59" value={condTimeMinutes} onChange={(e) => handleCondTimeChange('m', e.target.value)} placeholder="0" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium">min</span>
                            </div>
                            <span className="text-muted-foreground font-bold text-sm pb-1">:</span>
                            <div className="flex-1 relative">
                              <input type="number" inputMode="numeric" min="0" max="59" value={condTimeSeconds} onChange={(e) => handleCondTimeChange('s', e.target.value)} placeholder="0" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium">sek</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block text-center">Tempo</label>
                            <input
                          type="text"
                          value={condTempoInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCondTempoInput(v);
                            autoCalcCond(condTimeTotalMin, v, condDistanceInput, "tempo");
                          }}
                          placeholder="5:30"
                          className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            <span className="text-[9px] text-muted-foreground mt-0.5 block text-center">min/km</span>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center gap-0.5">
                              <Route className="w-3 h-3" /> Distans
                            </label>
                            <input
                          type="number"
                          inputMode="decimal"
                          value={condDistanceInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCondDistanceInput(v);
                            autoCalcCond(condTimeTotalMin, condTempoInput, v, "distance");
                          }}
                          placeholder="5"
                          className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            <span className="text-[9px] text-muted-foreground mt-0.5 block text-center">km</span>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block text-center">Puls</label>
                            <input
                          type="number"
                          inputMode="numeric"
                          value={condPulseInput}
                          onChange={(e) => setCondPulseInput(e.target.value)}
                          placeholder="155"
                          className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            <span className="text-[9px] text-muted-foreground mt-0.5 block text-center">bpm</span>
                          </div>
                        </div>
                          </>
                        )}
                        <div className="flex gap-2">
                          <button
                        onClick={addConditioningExercise}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-warning text-warning-foreground rounded-md text-xs font-semibold">
                            <Plus className="w-3.5 h-3.5" /> Lägg till
                          </button>
                          <button
                        onClick={() => {setConditioningDialog(null);setCondTempoInput("");resetCondTime();setCondDistanceInput("");setCondAutoField(null);setCondIntervalsInput("");setCondRestInput("");setCondPulseInput("");setCondSpmInput("");}}
                        className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                            Avbryt
                          </button>
                        </div>
                      </div>
                  }

                    {/* Suggest adding interval training for tröskelpass */}
                    {(() => {
                      const isThresholdSession = plan.session_name.toLowerCase().includes("tröskel") || plan.details.toLowerCase().includes("tröskellöpning");
                      const detailParts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                      const hasInterval = detailParts.some(p => /\d+\s*[×x]\s*\d+\s*min/i.test(p) || p.toLowerCase().includes("intervall"));
                      if (isThresholdSession && !hasInterval && !conditioningDialog && !showExercisePicker) {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConditioningDialog({ planId: plan.id, exerciseName: "Intervallträning" });
                              const lastCondTempo = findLastCondTempo("Intervallträning");
                              setCondTempoInput(lastCondTempo || "");
                              resetCondTime();
                              setCondDistanceInput("");
                              setCondAutoField(null);
                              setCondIntervalsInput("");
                              setCondRestInput("");
                              setCondPulseInput("");
                            }}
                            className="w-full bg-warning/10 border border-warning/30 rounded-lg p-3 text-left hover:bg-warning/20 transition-colors animate-fade-in"
                          >
                            <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5" /> Förslag: Lägg till intervallträning
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Tröskelpass inkluderar vanligtvis intervaller. Tryck här för att lägga till.</p>
                          </button>
                        );
                      }
                      return null;
                    })()}
                    {/* Add warmup & exercise buttons */}
                    {!weightDialog && !conditioningDialog &&
                  <div className="space-y-1.5">
                    {SHOW_STRAVA_INTEGRATION && (
                      <button
                        onClick={() => syncStravaNow(plan)}
                        disabled={stravaSyncing}
                        className="w-full py-2 border border-dashed border-primary/40 rounded-md text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-1">
                          <RefreshCw className={`w-3 h-3 ${stravaSyncing ? "animate-spin" : ""}`} /> Synka från Strava
                        </button>
                    )}
                    <button
                      onClick={() => {
                        setShowExercisePicker(plan.id);
                        setSelectedMuscle(null);
                        setIsWarmupMode(false);
                      }}
                      className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Lägg till övning
                      </button>
                    {plan.is_circuit && (
                      <button
                        onClick={async () => {
                          const restSec = prompt("Antal sekunder vila mellan rundor:", "30");
                          if (!restSec) return;
                          const seconds = parseInt(restSec) || 30;
                          const entry = `Vila — 1×${seconds}`;
                          const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
                          const newDetails = plan.details ? `${plan.details}${joinSep}${entry}` : entry;
                          await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                          setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
                          triggerSave();
                        }}
                        className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-warning hover:text-warning hover:border-warning transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Lägg till vila
                      </button>
                    )}
                  </div>
                    }
                    <ExercisePickerDialog
                      open={isExercisePickerOpen && !weightDialog && !conditioningDialog}
                      onClose={() => { setShowExercisePicker(null); setIsWarmupMode(false); setReplaceExerciseTarget(null); }}
                      onSelect={(name) => handleExerciseSelect(plan.id, name)}
                      title={replaceExerciseTarget ? `Byt ut: ${replaceExerciseTarget.name}` : isWarmupMode ? "Välj uppvärmning" : "Välj övning"}
                      initialMuscleGroup={selectedMuscle}
                      getLastWeight={findLastWeight}
                      onExerciseInfo={(name) => setExerciseInfoState({ name })}
                      allowCreate
                      userId={userId}
                    />

                    {/* Friend comments */}
                    {(() => {
                    const dayComments = friendComments.filter((c) => c.plan_id === plan.id);
                    return dayComments.length > 0 ?
                    <div className="space-y-1.5 bg-primary/5 rounded-lg p-3 border border-primary/20">
                          <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" /> Kommentarer från vänner
                          </p>
                        {dayComments.map((c) =>
                    <div key={c.id} className="bg-background/80 rounded-md px-3 py-2 flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-xs">
                                  <span className="font-semibold text-primary">{commentNicknames[c.author_id] || "..."}</span>{" "}
                                  <span className="text-foreground">{c.comment}</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {new Date(c.created_at).toLocaleDateString("sv-SE")}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteFriendComment(c.id)}
                                className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                title="Ta bort kommentar">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                      )}
                        </div> :
                    null;
                  })()}

                    {/* Own comments display */}
                    {comments[key]?.trim() &&
                  <div className="space-y-1">
                        {comments[key].trim().split("\n").filter(Boolean).map((line, i) =>
                    <div key={i} className="bg-accent/30 rounded-lg px-3 py-2 border border-accent/50 flex items-start justify-between gap-2">
                            <p className="text-xs flex items-start gap-1.5 flex-1">
                              <MessageSquare className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                              <span className="text-foreground">{line}</span>
                            </p>
                            <button
                        onClick={() => deleteCommentLine(0, plan.day, i)}
                        className="flex-shrink-0 p-0.5 transition-colors text-destructive"
                        title="Ta bort kommentar">

                              <X className="w-3 h-3" />
                            </button>
                          </div>
                    )}
                      </div>
                  }

                    {/* Comment input */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input
                        type="text"
                        value={commentInput[key] || ""}
                        onChange={(e) => setCommentInput((prev) => ({ ...prev, [key]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && saveComment(0, plan.day)}
                        placeholder="Skriv en kommentar..."
                        className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />

                      </div>
                      </div>
                    {/* Calorie burn estimate */}
                    {isDone && plan.details && (
                      profileWeight ? (() => {
                        const comp = completions[key];
                        const cal = estimateCalories(plan.details, comp?.logged_weights as Record<string, any> | null, comp?.logged_pulse || null, profileWeight, profileGender, profileAge);
                        return cal > 0 ? (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-center gap-2">
                            <Flame className="w-4 h-4 flex-shrink-0 text-primary" />
                            <div className="flex-1">
                              <span className="text-xs font-semibold text-primary">~{cal} kcal</span>
                              <span className="text-[10px] ml-1.5 text-primary">
                                {(comp?.logged_weights as any)?.__strava_calories ? "synkat från Strava" : comp?.logged_pulse ? "baserat på puls, vikt & kön" : "uppskattning baserat på vikt"}
                              </span>
                            </div>
                          </div>
                        ) : null;
                      })() : (
                        <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                          <Flame className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <p className="text-[10px] text-muted-foreground">
                            Lägg till din vikt i profilen för att se kaloriförbrukning
                          </p>
                        </div>
                      )
                    )}
                  </div>
                }
              </div>);

          })}
        </div>

        {/* Add single workout form */}
        {showAddSingle ?
        <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3 animate-fade-in">
            <h3 className="text-sm font-semibold">Nytt pass</h3>

            {/* Copy from previous session */}
            {(() => {
            const uniqueSessions = new Map<string, PlanDay>();
            const singlePlans2 = plans.filter((p) => p.week === 0);
            // Get latest version of each session name
            for (const p of singlePlans2) {
              const existing = uniqueSessions.get(p.session_name);
              if (!existing || p.day > existing.day) {
                uniqueSessions.set(p.session_name, p);
              }
            }
            const previousSessions = Array.from(uniqueSessions.values());

            if (previousSessions.length > 0) {
              return (
                <div className="space-y-2">
                    <button
                    onClick={() => setShowCopyPicker(!showCopyPicker)}
                    className="w-full py-2 border border-dashed border-primary/40 rounded-md text-xs text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1">

                      <TrendingUp className="w-3 h-3" /> Kopiera tidigare pass
                    </button>
                    <p className="text-[10px] text-muted-foreground text-center">Övningar, vikter och reps kopieras — justera själv för progression</p>
                    {showCopyPicker &&
                  <div className="space-y-1 max-h-40 overflow-y-auto animate-fade-in">
                        {previousSessions.map((p) =>
                    <button
                      key={p.id}
                      onClick={() => addSingleWorkout(p)}
                      className="w-full text-left p-2.5 bg-secondary rounded-md text-xs hover:bg-primary/10 transition-colors">

                            <span className="font-semibold block">{p.session_name}</span>
                            {p.details &&
                      <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                                {p.details.split("\n").slice(0, 2).join(", ")}
                              </span>
                      }
                          </button>
                    )}
                      </div>
                  }
                  </div>);

            }
            return null;
          })()}

            {/* Import ready workout */}
            <button
              onClick={() => {
                // Find a matching ready workout and create single workout
                setImportWorkoutTarget({ planId: "__single__", week: 0, day: "" });
              }}
              className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-warning hover:border-warning transition-colors flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3" /> Importera färdigt pass
            </button>

            {/* Date picker */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                  className={cn(
                    "w-full flex items-center gap-2 bg-secondary text-foreground text-sm p-2 rounded-md text-left",
                    !singleDate && "text-muted-foreground"
                  )}>

                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    {singleDate ? format(singleDate, "d MMMM yyyy", { locale: sv }) : "Välj datum"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[80]" align="start">
                  <Calendar
                  mode="single"
                  selected={singleDate}
                  onSelect={(date) => date && setSingleDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")} />

                </PopoverContent>
              </Popover>
            </div>

            <input
            type="text"
            value={singleName}
            onChange={(e) => setSingleName(e.target.value)}
            placeholder="Passnamn (t.ex. Styrka överkropp)"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            autoFocus />

            <p className="text-[10px] text-muted-foreground">
              Lägg till övningar efter att passet skapats
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={singleIsCircuit} onChange={(e) => setSingleIsCircuit(e.target.checked)} className="accent-primary w-4 h-4" />
              <span className="text-xs text-foreground">Cirkelpass (visar Starta-knapp)</span>
            </label>
            {singleIsCircuit && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Sek/övning:</label>
                  <input type="number" inputMode="numeric" min="5" max="300" value={singleCircuitSeconds} onChange={(e) => setSingleCircuitSeconds(e.target.value)} className="w-16 bg-secondary text-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                  <label className="text-xs text-muted-foreground whitespace-nowrap ml-2">Rundor:</label>
                  <input type="number" inputMode="numeric" min="1" max="20" value={singleCircuitRounds} onChange={(e) => setSingleCircuitRounds(e.target.value)} className="w-16 bg-secondary text-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Vila mellan rundor:</label>
                  <input type="number" inputMode="numeric" min="0" max="300" value={singleCircuitRest} onChange={(e) => setSingleCircuitRest(e.target.value)} className="w-16 bg-secondary text-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                  <span className="text-xs text-muted-foreground">sek</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => addSingleWorkout()} disabled={!singleName.trim()} className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-40">
                Skapa pass
              </button>
              <button onClick={() => {setShowAddSingle(false);setShowCopyPicker(false);}} className="px-4 py-2 bg-secondary text-muted-foreground rounded-md text-sm">
                Avbryt
              </button>
            </div>
          </div> :

        <button
          onClick={() => setShowAddSingle(true)}
          className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2">

            <Plus className="w-4 h-4" /> Lägg till pass
          </button>
        }
      </div>
      {exerciseInfoState && (
        <ExerciseInfoDialog
          exerciseName={exerciseInfoState.name}
          onClose={() => setExerciseInfoState(null)}
          isAdmin={canEditExercises}
          initialEditMode={exerciseInfoState.editMode}
          onCategoryChanged={() => supabase.from("custom_exercises").select("*").order("name").then(({ data }) => { if (data) setCustomExercises(data); })}
        />
      )}
      {deleteExerciseConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteExerciseConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
            <h3 className="font-bold text-sm">Ta bort övning?</h3>
            <p className="text-sm text-muted-foreground">
              Är du säker på att du vill ta bort <span className="font-semibold text-foreground">{deleteExerciseConfirm.name}</span>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteExerciseConfirm(null)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
                Avbryt
              </button>
              <button onClick={executeDeleteExercise} className="flex-1 py-2.5 bg-destructive text-destructive-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
                Ta bort
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Import workout dialog (single mode) */}
      {importWorkoutTarget && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setImportWorkoutTarget(null)} />
          <div className="relative bg-card rounded-t-xl sm:rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4 space-y-3 z-10">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Importera färdigt pass</h3>
              <button onClick={() => setImportWorkoutTarget(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {/* User's own saved workouts */}
            {(() => {
              const myWorkouts = savedWorkouts.filter(sw => sw.user_id === userId);
              if (myWorkouts.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground">⭐ Mina sparade pass</p>
                  {myWorkouts.map((sw) => (
                    <button
                      key={sw.id}
                      onClick={() => handleImportWorkout({ name: sw.name, details: sw.details, tempo: sw.tempo })}
                      className="w-full text-left bg-secondary/50 hover:bg-secondary rounded-lg px-3 py-2 transition-colors"
                    >
                      <p className="text-xs font-semibold text-foreground">{sw.name}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{sw.details.replace(/\n/g, " · ")}</p>
                    </button>
                  ))}
                </div>
              );
            })()}
            {/* Public saved workouts from other users */}
            {(() => {
              const publicWorkouts = savedWorkouts.filter(sw => sw.visibility === "public" && sw.user_id !== userId);
              if (publicWorkouts.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground">👥 Skapat av användare</p>
                  {publicWorkouts.map((sw) => (
                    <button
                      key={sw.id}
                      onClick={() => handleImportWorkout({ name: sw.name, details: sw.details, tempo: sw.tempo })}
                      className="w-full text-left bg-secondary/50 hover:bg-secondary rounded-lg px-3 py-2 transition-colors"
                    >
                      <p className="text-xs font-semibold text-foreground">{sw.name}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{sw.details.replace(/\n/g, " · ")}</p>
                    </button>
                  ))}
                </div>
              );
            })()}
            {readyWorkoutCategories.map((cat, ci) => (
              <div key={ci} className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground">{cat.emoji} {cat.label}</p>
                {cat.workouts.map((w, wi) => {
                  const isLocked = wi > 0 && !isHonorary && !isAdmin;
                  return (
                  <button
                    key={wi}
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) return;
                      handleImportWorkout({ name: w.name, details: w.details, tempo: w.tempo });
                    }}
                    className={`w-full text-left bg-secondary/50 rounded-lg px-3 py-2 transition-colors flex items-center justify-between ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{w.name}</p>
                      {isLocked ? <p className="text-[10px] text-warning">🔒 Exklusivt för hedersmedlemmar</p> : <p className="text-[10px] text-muted-foreground line-clamp-1">{w.details.replace(/\n/g, " · ")}</p>}
                    </div>
                    {isLocked && <Lock className="w-3.5 h-3.5 text-warning flex-shrink-0 ml-2" />}
                  </button>
                  );
                })}
              </div>
            ))}
            {!isHonorary && !isAdmin && (
              <div className="text-center pt-2 space-y-1">
                <p className="text-[10px] text-muted-foreground">🔒 Exklusivt för hedersmedlemmar</p>
                <p className="text-[10px] text-muted-foreground">Som vanlig medlem kan du välja 1 pass per kategori.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Circuit timer dialog (single mode) */}
      {circuitTimer && (
        <CircuitTimerDialog
          exercises={circuitTimer.exercises}
          workSeconds={circuitTimer.workSeconds}
          exerciseSeconds={circuitTimer.exerciseSeconds}
          roundCount={circuitTimer.roundCount}
          restSeconds={circuitTimer.restSeconds}
          onClose={() => setCircuitTimer(null)}
          onRoundComplete={(roundIndex) => {
            const roundKey = `__wod_rounds_done_${circuitTimer.headerIndex}__`;
            const existing = completions[circuitTimer.weekDayKey]?.logged_weights as Record<string, any> || {};
            const current = parseInt(existing[roundKey] || "0");
            const newVal = Math.max(current, roundIndex + 1);
            const updated = { ...existing, [roundKey]: String(newVal) };
            const [wStr, dStr] = circuitTimer.weekDayKey.split("-");
            const w = parseInt(wStr);
            const d = dStr;
            setCompletions(prev => ({
              ...prev,
              [circuitTimer.weekDayKey]: { ...prev[circuitTimer.weekDayKey], week: w, day: d, done: prev[circuitTimer.weekDayKey]?.done || false, skipped: prev[circuitTimer.weekDayKey]?.skipped || false, user_comment: prev[circuitTimer.weekDayKey]?.user_comment || "", logged_weights: updated } as Completion
            }));
            safeUpsertCompletion(w, d, { logged_weights: updated });
          }}
          onRated={(rating) => {
            const key = `circuit_rating_${circuitTimer.weekDayKey}`;
            const historyKey = "gymberget_circuit_ratings";
            try {
              const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
              history.push({ key, rating, workSeconds: circuitTimer.workSeconds, roundCount: circuitTimer.roundCount, ts: Date.now() });
              if (history.length > 50) history.splice(0, history.length - 50);
              localStorage.setItem(historyKey, JSON.stringify(history));
            } catch {}
            if (rating >= 8) {
              toast("Nästa pass blir lättare — arbetstiden minskas 🔻", { duration: 4000 });
            } else if (rating <= 2) {
              toast("Bra jobbat! Nästa pass blir tuffare 🔺", { duration: 4000 });
            } else {
              toast(`Betyg ${rating}/10 sparat ✅`, { duration: 2000 });
            }
          }}
        />
      )}
      {shareTarget && (
        <WorkoutShareCard
          sessionName={shareTarget.plan.session_name}
          day={shareTarget.plan.day}
          week={shareTarget.plan.week}
          details={shareTarget.plan.details}
          tempo={shareTarget.plan.tempo}
          loggedTempo={shareTarget.completion.logged_tempo}
          loggedPulse={shareTarget.completion.logged_pulse}
          loggedDistanceKm={shareTarget.completion.logged_distance_km}
          loggedWeights={shareTarget.completion.logged_weights}
          nickname={userNickname}
          onClose={() => setShareTarget(null)}
          onChatShare={async () => {
            const plan = shareTarget.plan;
            setShareTarget(null);
            const { data: friendships } = await supabase.from("friendships").select("user_id, friend_id").eq("status", "accepted").or(`user_id.eq.${userId},friend_id.eq.${userId}`);
            if (!friendships || friendships.length === 0) return;
            const fIds = friendships.map(f => f.user_id === userId ? f.friend_id : f.user_id);
            const { data: profiles } = await supabase.from("profiles").select("user_id, nickname").in("user_id", fIds);
            setChatFriends(profiles || []);
            setChatShareTarget(plan);
          }}
          onCopyToDate={() => {
            const plan = shareTarget.plan;
            const allDayPlans = plans.filter(p => p.week === plan.week && p.day === plan.day);
            const combinedDetails = allDayPlans.map(p => p.details.trim()).filter(Boolean).join("\n");
            const combinedSource: PlanDay = {
              ...plan,
              details: combinedDetails || plan.details,
            };
            setShareTarget(null);
            setCopyToDateSource(combinedSource);
            setCopyToDateSelected(new Date());
            setCopyToDateConflict(null);
          }}
          onSaveWorkout={() => {
            const plan = shareTarget.plan;
            setSaveWorkoutSource({ details: plan.details, tempo: plan.tempo, defaultName: plan.session_name });
            setSaveWorkoutName(plan.session_name);
            setSaveWorkoutVisibility("private");
            setSaveWorkoutIsCircuit(!!(plan.is_circuit || (plan.tempo && plan.tempo.startsWith("circuit:"))));
            setShareTarget(null);
          }}
        />
      )}
      {uncheckedSetsDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setUncheckedSetsDialog(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
            <h3 className="font-bold text-base">Obockade set</h3>
            <p className="text-sm text-muted-foreground">
              Du har {uncheckedSetsDialog.uncheckedCount} set som inte är avbockade. Vill du klarmarkera passet ändå?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setUncheckedSetsDialog(null)}
                className="flex-1 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity"
              >
                Avbryt
              </button>
              <button
                onClick={async () => {
                  const { week, day } = uncheckedSetsDialog;
                  setUncheckedSetsDialog(null);
                  const dayPlans = plans.filter(p => p.week === week && p.day === day);
                  const k = `${week}-${day}`;
                  const accumulated: Record<string, any> = await new Promise((resolve) => {
                    setCompletions((prev) => {
                      const prevComp = prev[k] || ({} as any);
                      const acc: Record<string, any> = { ...((prevComp.logged_weights || {}) as Record<string, any>) };
                      for (const plan of dayPlans) {
                        if (!plan.details) continue;
                        const parts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                        for (const part of parts) {
                          if (part.startsWith("⚔️")) continue;
                          const isCondExercise = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|(?<![-\w])gång(?![-\w])|intervallträning|stair\s*machine|trappmaskin/i.test(part);
                          if (isCondExercise) continue;
                          if (/^(vila|vilodag)/i.test(part)) continue;
                          const { clean: cleanPart } = extractRpe(part);
                          const partStructMatch = cleanPart.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)(s)?(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
                          const fallbackSetsMatch = !partStructMatch ? cleanPart.match(/(\d+)\s*[×x]\s*\S+/) : null;
                          const nameMatch = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d)/);
                          const exerciseName = nameMatch ? nameMatch[1].trim() : null;
                          const pName = partStructMatch ? partStructMatch[1].trim().replace(/\s*—\s*$/, '') : exerciseName || cleanPart;
                          const sc = partStructMatch ? parseInt(partStructMatch[2]) : fallbackSetsMatch ? parseInt(fallbackSetsMatch[1]) : 1;
                          const allChecked = "1".repeat(sc);
                          acc[`__sets__${pName}`] = allChecked;
                          const setDataKey = `__setdata__${pName}`;
                          if (!acc[setDataKey]) {
                            const circuitSecMatch = plan.is_circuit ? plan.tempo?.match(/^circuit:(\d+)(?::\d+)?(?::\d+)?$/) : null;
                            const defReps = partStructMatch ? partStructMatch[3] : (circuitSecMatch ? circuitSecMatch[1] : "10");
                            const defKg = partStructMatch && partStructMatch[5] ? partStructMatch[5] : "";
                            const initData = Array.from({ length: sc }, () => ({ kg: defKg, reps: defReps }));
                            acc[setDataKey] = JSON.stringify(initData);
                          }
                        }
                      }
                      resolve(acc);
                      return {
                        ...prev,
                        [k]: { ...(prevComp as any), week, day, logged_weights: acc },
                      };
                    });
                  });
                  await safeUpsertCompletion(week, day, { logged_weights: accumulated });
                  await performToggleDone(week, day);
                }}
                className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity"
              >
                Klarmarkera
              </button>
            </div>
          </div>
        </div>
      )}
      </>);

  }

  // Plan mode (existing)
  const weekDays = plans.
  filter((p) => p.week === currentWeek).
  sort((a, b) => getDayIndex(a.day) - getDayIndex(b.day));

  const mobileDayTabs = DAYS
    .map((dayName) => weekDays.find((p) => sameWorkoutDay(p.day, dayName)))
    .filter(Boolean) as PlanDay[];
  const activeMobileDay = mobileDayTabs[Math.min(activeDayIndex, Math.max(0, mobileDayTabs.length - 1))];
  const visibleWeekDays = isMobile && weekDays.length > 1 && activeMobileDay
    ? weekDays.filter((p) => sameWorkoutDay(p.day, activeMobileDay.day))
    : weekDays;

  const weekIdx = weeks.indexOf(currentWeek);
  const scheduledDays = weekDays.filter(d => d.session_name.trim() !== "" && d.details.trim() !== "");
  const doneCount = scheduledDays.filter((d) => completions[`${d.week}-${d.day}`]?.done).length;
  const progress = scheduledDays.length > 0 ? Math.round(doneCount / scheduledDays.length * 100) : 0;

  return (
    <>
    <div className="space-y-4">
      {adminBanner}
      {/* Event countdown progress bar */}
      <EventProgressBar userId={userId} />

      {/* Week navigation - swipe to change week */}
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center justify-center py-2 select-none touch-pan-x"
          onTouchStart={(e) => {
            (e.currentTarget as any)._swipeX = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const startX = (e.currentTarget as any)._swipeX;
            if (startX == null) return;
            const dx = e.changedTouches[0].clientX - startX;
            if (Math.abs(dx) > 40) {
              if (dx < 0 && weekIdx < weeks.length - 1) setCurrentWeek(weeks[weekIdx + 1]);
              else if (dx > 0 && weekIdx > 0) setCurrentWeek(weeks[weekIdx - 1]);
            }
            (e.currentTarget as any)._swipeX = null;
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => weekIdx > 0 && setCurrentWeek(weeks[weekIdx - 1])}
              disabled={weekIdx <= 0}
              className="p-1 text-muted-foreground disabled:opacity-20"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 min-w-[120px] justify-center">
              {weeks.map((w) => {
                const isCurrent = w === currentWeek;
                const isActive = w === activePlanWeek;
                const distance = Math.abs(weeks.indexOf(w) - weekIdx);
                if (distance > 2) return null;
                return (
                  <button
                    key={w}
                    onClick={() => setCurrentWeek(w)}
                    className={`flex-shrink-0 rounded-full text-xs font-semibold transition-all ${
                      isCurrent
                        ? "px-4 py-1.5 bg-primary text-primary-foreground"
                        : isActive
                        ? "px-3 py-1 bg-muted text-foreground border border-primary/30"
                        : distance === 1
                        ? "px-3 py-1 text-muted-foreground hover:bg-muted"
                        : "px-2.5 py-1 text-muted-foreground/50 text-[10px]"
                    }`}
                  >
                    V{w}
                  </button>
                );
              })}
              {weekIdx >= weeks.length - 2 && (
                <button
                  onClick={() => { setAddWeekSourceWeek(weeks.filter(w => w > 0).slice(-1)[0] || 1); setShowAddWeekDialog(true); }}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/50 border border-dashed border-border hover:bg-muted"
                  title="Lägg till vecka"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => weekIdx < weeks.length - 1 && setCurrentWeek(weeks[weekIdx + 1])}
              disabled={weekIdx >= weeks.length - 1}
              className="p-1 text-muted-foreground disabled:opacity-20"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground text-center">{progress}% avklarat · Vecka {currentWeek} av {weeks.length}</p>
      </div>

      {/* Warning when viewing non-active week */}
      {activePlanWeek && currentWeek !== activePlanWeek && (
        <div className="flex flex-col gap-2 bg-warning/15 border border-warning/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-warning">
              Du tittar på vecka {currentWeek} — din aktiva vecka är <button onClick={() => setCurrentWeek(activePlanWeek)} className="font-bold underline">vecka {activePlanWeek}</button>.
              Pass du registrerar här tillhör inte den aktuella veckan.
            </p>
          </div>
          <button
            onClick={async () => {
              if (!planStartDate) return;
              // Recalculate plan_start_date so that currentWeek becomes the active week
              const oldStart = parseDateKey(planStartDate);
              if (!oldStart) return;
              const oldMonday = getMonday(oldStart);
              const now = parseDateKey(toLocalDateKey(new Date())) ?? new Date();
              const nowMonday = getMonday(now);
              // Current active week = floor((nowMonday - oldMonday) / 7) + 1
              // We want currentWeek to be active, so: newStart = nowMonday - (currentWeek - 1) * 7 days
              const newStartMonday = addUtcDays(nowMonday, -(currentWeek - 1) * 7);
              // Preserve day-of-week offset from original start
              const dayOffset = daysBetweenCalendarDates(oldMonday, oldStart);
              const newStart = addUtcDays(newStartMonday, dayOffset);
              const newDateStr = toUtcDateKey(newStart);
              await supabase.from("profiles").update({ plan_start_date: newDateStr } as any).eq("user_id", userId);
              setPlanStartDate(newDateStr);
              setActivePlanWeek(currentWeek);
            }}
            className="self-start text-xs font-semibold text-warning bg-warning/20 hover:bg-warning/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            Gör vecka {currentWeek} till aktiv vecka
          </button>
        </div>
      )}


      {/* Workout cards */}
      {isMobile && weekDays.length >= 1 && (() => {
        const todayDayNames = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
        const todayName = todayDayNames[new Date().getDay()];
        return (
        <div className="flex flex-col gap-2">
          {/* Day tabs — show all 7 weekdays, rest days are non-clickable */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
            {DAYS.map((dayName) => {
              const planIdx = mobileDayTabs.findIndex((p) => sameWorkoutDay(p.day, dayName));
              const isRest = planIdx === -1;
              const isToday = dayName === todayName && currentWeek === activePlanWeek;

              if (isRest) {
                return (
                  <button
                    key={dayName}
                    onClick={() => setImportWorkoutTarget({ planId: "__new__", week: currentWeek, day: dayName })}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isToday
                        ? "bg-warning/10 text-warning/80 border border-warning/30 hover:bg-warning/20"
                        : "bg-secondary/40 text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
                    }`}
                    title="Vilodag — tryck för att lägga till pass"
                  >
                    {dayName}
                  </button>
                );
              }

              const plan = mobileDayTabs[planIdx];
              const k = `${plan.week}-${plan.day}`;
              const comp = completions[k];
              const done = comp?.done || false;
              const skipped = comp?.skipped || false;
              const isActive = planIdx === activeDayIndex;
              return (
                <button
                  key={k}
                  onClick={() => { setSwipeDirection(planIdx > activeDayIndex ? "left" : "right"); swipeKey.current++; setActiveDayIndex(planIdx); setExpandedDay(null); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? done
                        ? "bg-success text-success-foreground"
                        : isToday
                        ? "bg-warning/10 text-warning border border-warning/30"
                        : "bg-primary text-primary-foreground"
                      : done
                      ? "bg-success/20 text-success"
                      : skipped
                      ? "bg-destructive/20 text-destructive"
                      : isToday
                      ? "bg-warning/20 text-warning"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {getBaseDay(plan.day)}
                </button>
              );
            })}
          </div>
        </div>
        );
      })()}
      <div
        key={isMobile && weekDays.length > 1 ? `swipe-${swipeKey.current}` : undefined}
        className={`${isMobile && weekDays.length > 1 ? (swipeDirection === "left" ? "swipe-left" : swipeDirection === "right" ? "swipe-right" : "") : ""} grid grid-cols-1 gap-2`}
        onTouchStart={(e) => {
          if (!isMobile || weekDays.length <= 1) return;
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (!isMobile || weekDays.length <= 1 || touchStartX.current === null || touchStartY.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          const dy = e.changedTouches[0].clientY - touchStartY.current;
          touchStartX.current = null;
          touchStartY.current = null;
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            if (dx < 0 && activeDayIndex < mobileDayTabs.length - 1) {
              setSwipeDirection("left");
              swipeKey.current++;
              setActiveDayIndex(activeDayIndex + 1);
              setExpandedDay(null);
            } else if (dx > 0 && activeDayIndex > 0) {
              setSwipeDirection("right");
              swipeKey.current++;
              setActiveDayIndex(activeDayIndex - 1);
              setExpandedDay(null);
            }
          }
        }}
      >
        {visibleWeekDays.filter(Boolean).map((plan) => {
          const key = `${plan.week}-${plan.day}`;
          const completion = completions[key];
          const isDone = completion?.done || false;
          const isSkipped = completion?.skipped || false;
          const expanded = true;
          const Icon = getSessionIcon(plan.session_name);
          const colorClass = getSessionColor(plan.session_name);
          const isRest = plan.session_name.toLowerCase().includes("vila") || plan.session_name.toLowerCase().includes("återhämtning");
          const cardTodayNames = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
          const isCardToday = sameWorkoutDay(plan.day, cardTodayNames[new Date().getDay()]) && plan.week === activePlanWeek;

          return (
            <div key={key + "-wrap"} className="w-full">
            <div
              className={`relative w-full rounded-lg border transition-colors bg-secondary ${isDone ? "workout-done opacity-80" : ""} ${isSkipped ? "opacity-60" : ""} ${isRest ? "workout-rest" : ""}`}>
              <div className="flex items-center gap-3 px-4 pt-4 pb-2 cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; if (expanded) { const sameDayPlans = plans.filter(p2 => p2.week === plan.week && p2.day === plan.day); if (sameDayPlans.length <= 1) return; } setExpandedDay(expanded ? null : key); }}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDone(plan.week, plan.day);
                    }}
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDone ? "bg-success border-success" : "bg-background border-muted-foreground/30 hover:border-primary"}`
                    }
                    title="Genomfört">
                      <Check className={`w-[18px] h-[18px] transition-all ${isDone ? "text-success-foreground opacity-100" : "text-muted-foreground/30 opacity-100"}`} />
                    </button>
                </div>
                <div className={`flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <button
                      onClick={(e) => {e.stopPropagation(); setChangeDayDialog({ planId: plan.id, currentDay: plan.day, week: plan.week, sessionName: plan.session_name });}}
                      className="text-xs font-mono text-muted-foreground uppercase hover:text-primary transition-colors"
                      title="Byt veckodag">
                      {getBaseDay(plan.day)}
                    </button>
                    <span
                      className={`font-semibold text-sm break-words text-left ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {plan.session_name}
                    </span>
                  </div>
                  {(() => {
                    const dateStr = getPlanDayDate(planStartDate, plan.week, plan.day);
                    return dateStr ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {dateStr}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                    {(() => {
                    const ownLines = comments[key]?.trim() ? comments[key].trim().split("\n").filter(Boolean).length : 0;
                    const dayFriendComments = friendComments.filter((c) => c.plan_id === plan.id);
                    const totalComments = ownLines + dayFriendComments.length;
                    return totalComments > 0 ?
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full animate-fade-in">
                          <MessageCircle className="w-3 h-3" /> {totalComments}
                        </span> :
                    null;
                  })()}
                    
                  </div>
              </div>
              {/* Action buttons row */}
              <div className="grid grid-cols-2 gap-1.5 px-4 pb-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameDialog({ planId: plan.id, currentName: plan.session_name, week: plan.week, day: plan.day, sessionName: plan.session_name });
                    setRenameInput(plan.session_name);
                  }}
                  className="relative z-20 min-h-9 flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                  title="Inställningar">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Inställningar</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareTarget({ plan, completion: completions[key] || { week: plan.week, day: plan.day, done: false, skipped: false, user_comment: "" } as Completion });
                  }}
                  className="min-h-9 flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                  title="Dela pass">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Dela</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSaveWorkoutSource({ details: plan.details, tempo: plan.tempo, defaultName: plan.session_name });
                    setSaveWorkoutName(plan.session_name);
                    setSaveWorkoutVisibility("private");
                  }}
                  className="min-h-9 flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                  title="Spara pass">
                  <Download className="w-3.5 h-3.5" />
                  <span>Spara</span>
                </button>
              </div>
              {expanded &&
              <div className="px-4 pb-8 space-y-3 border-t border-border pt-3">
                  {/* Inline weight inputs for strength exercises */}
                  {(() => {
                  const s = (plan.session_name + " " + plan.details).toLowerCase();
                  const isStrength = s.includes("styrka") || s.includes("bänk") || s.includes("böj") || s.includes("mark") || s.includes("press") || s.includes("rodd") || s.includes("chins") || s.includes("tung") || s.includes("rpe") || s.includes("×") || s.includes("x");
                  if (!isStrength) {
                    const isRunning = s.includes("löpning") || s.includes("jogg") || s.includes("långpass") || s.includes("tröskel");
                    const comp = completions[key];
                    let detailParts = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
                    
                    // Auto-generate conditioning entry for tröskelpass/running with empty details
                    if (detailParts.length === 0 && isRunning && plan.session_name.trim()) {
                      const sessionLower = plan.session_name.toLowerCase();
                      if (sessionLower.includes("tröskel")) {
                        detailParts = ["Tröskellöpning"];
                      } else if (sessionLower.includes("långpass")) {
                        detailParts = ["Löpning"];
                      } else {
                        detailParts = ["Löpning"];
                      }
                    }
                    // Helper: check if a line is a pure distance suggestion like "Löpning 8.5 km"
                    const isSuggestedDistance = (line: string): { name: string; distance: number } | null => {
                      const trimmed = line.trim();
                      // Match: "ExerciseName X km" or "ExerciseName X,Y km" — only name + distance, nothing else
                      const match = trimmed.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*km\s*$/i);
                      if (!match) return null;
                      const exName = match[1].trim();
                      const dist = parseFloat(match[2].replace(",", "."));
                      // Only treat as suggestion if the name is a known conditioning exercise
                      const isCondEx = allExercises.some(e => e.name.toLowerCase() === exName.toLowerCase() && e.category === "kondition");
                      if (isCondEx && dist > 0) return { name: exName, distance: dist };
                      return null;
                    };

                    // Helper: check if a line is a known exercise or has exercise format
                    const isExerciseLine = (line: string): boolean => {
                      // If it's a suggested distance, it's NOT an exercise line
                      if (isSuggestedDistance(line)) return false;
                      const cleanName = line.replace(/\s*[—\-]\s*.*$/, "").trim().toLowerCase();
                      // Check against exercise library and custom exercises
                      if (allExercises.some(e => e.name.toLowerCase() === cleanName)) return true;
                      // Check for structured formats (sets×reps, kg, min/km patterns)
                      if (/\d+\s*[×x]\s*\d+/i.test(line)) return true;
                      if (/\d+\s*kg/i.test(line)) return true;
                      if (/\d+\s*min/i.test(line) && /\/km/i.test(line)) return true;
                      // Check if line starts with a known exercise name (partial match)
                      if (allExercises.some(e => cleanName.startsWith(e.name.toLowerCase()))) return true;
                      return false;
                    };

                    return (
                      <div className="space-y-2">
                          {/* Hint: copied weights from previous session */}
                          {!isDone && completion?.logged_weights && Object.entries(completion.logged_weights).some(([k, v]) => {
                            // Ignore internal metadata keys — only count real previous-pass values
                            if (k.startsWith("__sets__") || k.startsWith("__setdata__") || k.startsWith("__cond__") || k.startsWith("__cond_done__")) return false;
                            if (v === null || v === undefined || (v as any) === "") return false;
                            return true;
                          }) && (
                            <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                              <TrendingUp className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                Data hämtad från förra passet — <span className="text-foreground font-medium">justera själv för progression</span>
                              </p>
                            </div>
                          )}
                          {detailParts.length > 1 ? (
                            <ul className="space-y-1.5">
                              {detailParts.map((line, i) => {
                                const cleanName = line.replace(/\s*[—\-]\s*\d+[×x].*$/i, "").replace(/\s*@\s*\d+.*$/i, "").trim();
                                const suggestion = isSuggestedDistance(line);
                                if (suggestion) {
                                  return (
                                    <li key={i} className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center gap-2">
                                      <Route className="w-4 h-4 text-primary flex-shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Föreslagen distans</p>
                                        <p className="text-sm font-semibold text-foreground">{suggestion.name} {suggestion.distance} km</p>
                                      </div>
                                    </li>
                                  );
                                }

                                // Check for interval pattern like "4×4 min i tröskeltempo (90 s joggvila)"
                                const inlineIntervalMatch = line.match(/(\d+)\s*[×x]\s*(\d+)\s*min/i);
                                if (inlineIntervalMatch) {
                                  const iCount = parseInt(inlineIntervalMatch[1]);
                                  const iDuration = parseInt(inlineIntervalMatch[2]);
                                   const iTempoM = line.match(/([\d:.]+)\s*\/km/);
                                   // Fall back to plan.tempo if the line doesn't contain tempo
                                   let iPlanTempo = iTempoM ? iTempoM[1] : "";
                                   if (!iPlanTempo && plan.tempo) {
                                     const planTempoMatch = plan.tempo.match(/([\d:.]+)\s*(?:min\/km|\/km)/);
                                     if (planTempoMatch) iPlanTempo = planTempoMatch[1];
                                   }
                                  const iCondKey = `__cond__${line}`;
                                  const iComp = completions[key];
                                  const iRawSaved = (iComp?.logged_weights as Record<string, any>)?.[iCondKey];
                                  let iCondSaved: Record<string, any> | null = null;
                                  if (iRawSaved) {
                                    try {
                                      const p = typeof iRawSaved === "string" ? JSON.parse(iRawSaved) : iRawSaved;
                                      if (p && typeof p === "object") iCondSaved = p;
                                    } catch {}
                                  }

                                  const saveInlineIntervalField = async (field: string, value: any) => {
                                    await updateCompletionWeights(plan.week, plan.day, (existing) => {
                                      let currentData: Record<string, any> = {};
                                      const rawCurrent = existing[iCondKey];
                                      if (rawCurrent) {
                                        try {
                                          const parsed = typeof rawCurrent === "string" ? JSON.parse(rawCurrent) : rawCurrent;
                                          if (parsed && typeof parsed === "object") currentData = { ...currentData, ...parsed };
                                        } catch {}
                                      }
                                      return { ...existing, [iCondKey]: JSON.stringify({ ...currentData, [field]: value }) };
                                    });
                                  };

                                  const savedIntervals: Array<{time: string; tempo: string; dist: string}> = iCondSaved?.intervals || [];
                                  const activeCount = savedIntervals.length > 0 ? savedIntervals.length : iCount;

                                  return (
                                    <li key={i} className="bg-primary/5 rounded-lg p-3 border border-primary/20 space-y-2 list-none">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                          <Timer className="w-3.5 h-3.5 text-primary" />
                                          {line}
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                          <div className="flex flex-col">
                                            <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                                            <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === detailParts.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                                          </div>
                                          <button onClick={(e) => {e.stopPropagation();e.preventDefault();setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: line });}} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors touch-manipulation">
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                      {/* Per-interval header */}
                                      <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-end">
                                        <span className="w-7" />
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5"><Timer className="w-3 h-3 text-primary" />Tid</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5"><Route className="w-3 h-3 text-primary" />Distans</span>
                                      </div>
                                      {Array.from({ length: activeCount }, (_, ii) => {
                                        const row = savedIntervals[ii] || { time: String(iDuration), tempo: iPlanTempo, dist: '' };
                                        const rowTempo = row.tempo;
                                        const rowTime = parseFloat(row.time) || 0;
                                        let rowDist = '';
                                        if (rowTempo && rowTime > 0) {
                                          const tMatch = rowTempo.match(/^(\d+)[:\.](\d+)$/);
                                          const tSingle = rowTempo.match(/^(\d+)$/);
                                          let minPerKm = 0;
                                          if (tMatch) minPerKm = (parseInt(tMatch[1]) * 60 + parseInt(tMatch[2])) / 60;
                                          else if (tSingle) minPerKm = parseInt(tSingle[1]);
                                          if (minPerKm > 0) rowDist = String(Math.round((rowTime / minPerKm) * 100) / 100);
                                        }
                                        if (row.dist && !rowDist) rowDist = row.dist;

                                        const intervalSetsKey = `__sets__interval_${line}`;
                                        const setsStr = ((completions[key]?.logged_weights as Record<string, any>)?.[intervalSetsKey] as string) || "";
                                        const isDoneI = setsStr[ii] === "1";

                                        return (
                                          <div key={ii} className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-center">
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const arr = Array.from({ length: activeCount }, (_, j) => setsStr[j] === "1");
                                                arr[ii] = !arr[ii];
                                                triggerSetRestTimer(arr[ii]);
                                                const newStr = arr.map(b => b ? "1" : "0").join("");
                                                const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                                const updated = { ...existing, [intervalSetsKey]: newStr };
                                                setCompletions(prev => ({
                                                  ...prev,
                                                  [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated }
                                                }));
                                                await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                                              }}
                                              className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                                                isDoneI ? "bg-success border-success text-success-foreground" : "border-primary/30 text-muted-foreground hover:border-primary"
                                              }`}
                                            >
                                              {isDoneI ? <Check className="w-3.5 h-3.5" /> : ii + 1}
                                            </button>
                                            <AutoSaveInput
                                              type="number" inputMode="numeric"
                                              initialValue={row.time || String(iDuration)}
                                              onSave={(v) => {
                                                const arr = [...(iCondSaved?.intervals || Array.from({ length: activeCount }, () => ({ time: String(iDuration), tempo: iPlanTempo, dist: '' })))];
                                                arr[ii] = { ...arr[ii], time: v };
                                                // Auto-calc dist from time + tempo
                                                const t = parseFloat(v) || 0;
                                                const tm = arr[ii].tempo?.match(/^(\d+)[:\.](\d+)$/);
                                                const ts = arr[ii].tempo?.match(/^(\d+)$/);
                                                let mpk = 0;
                                                if (tm) mpk = (parseInt(tm[1]) * 60 + parseInt(tm[2])) / 60;
                                                else if (ts) mpk = parseInt(ts[1]);
                                                if (t > 0 && mpk > 0) arr[ii].dist = String(Math.round((t / mpk) * 100) / 100);
                                                saveInlineIntervalField('intervals', arr);
                                              }}
                                              className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none"
                                            />
                                            <AutoSaveInput
                                              type="text"
                                              initialValue={rowTempo}
                                              onSave={(v) => {
                                                const arr = [...(iCondSaved?.intervals || Array.from({ length: activeCount }, () => ({ time: String(iDuration), tempo: iPlanTempo, dist: '' })))];
                                                arr[ii] = { ...arr[ii], tempo: v };
                                                if (ii === 0 && v.trim()) {
                                                  const allEmpty = arr.slice(1).every(r => !r.tempo?.trim());
                                                  if (allEmpty) {
                                                    for (let j = 1; j < arr.length; j++) arr[j] = { ...arr[j], tempo: v };
                                                  }
                                                }
                                                // Auto-calc dist for all rows with tempo + time
                                                for (let j = 0; j < arr.length; j++) {
                                                  const rt = parseFloat(arr[j].time) || 0;
                                                  const tm2 = arr[j].tempo?.match(/^(\d+)[:\.](\d+)$/);
                                                  const ts2 = arr[j].tempo?.match(/^(\d+)$/);
                                                  let mpk2 = 0;
                                                  if (tm2) mpk2 = (parseInt(tm2[1]) * 60 + parseInt(tm2[2])) / 60;
                                                  else if (ts2) mpk2 = parseInt(ts2[1]);
                                                  if (rt > 0 && mpk2 > 0) arr[j].dist = String(Math.round((rt / mpk2) * 100) / 100);
                                                }
                                                saveInlineIntervalField('intervals', arr);
                                              }}
                                              placeholder="5:30"
                                              className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
                                            />
                                            <span className={`text-xs font-mono text-center px-2 py-1.5 rounded-md ${rowDist ? 'bg-primary/10 text-foreground ring-1 ring-primary/30' : 'text-muted-foreground'}`}>
                                              {rowDist || '—'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                      {/* Total distance sum */}
                                      {(() => {
                                        let totalDist = 0;
                                        for (let ii = 0; ii < activeCount; ii++) {
                                          const row = savedIntervals[ii] || { time: String(iDuration), tempo: iPlanTempo, dist: '' };
                                          const rowTempo = row.tempo;
                                          const rowTime = parseFloat(row.time) || 0;
                                          let rd = parseFloat(row.dist) || 0;
                                          if (!rd && rowTempo && rowTime > 0) {
                                            const tMatch = rowTempo.match(/^(\d+)[:\.](\d+)$/);
                                            const tSingle = rowTempo.match(/^(\d+)$/);
                                            let minPerKm = 0;
                                            if (tMatch) minPerKm = (parseInt(tMatch[1]) * 60 + parseInt(tMatch[2])) / 60;
                                            else if (tSingle) minPerKm = parseInt(tSingle[1]);
                                            if (minPerKm > 0) rd = rowTime / minPerKm;
                                          }
                                          totalDist += rd;
                                        }
                                        if (totalDist > 0) {
                                          return (
                                            <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-center pt-1 border-t border-warning/20 mt-1">
                                              <span className="w-7" />
                                              <span />
                                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center font-semibold">Totalt</span>
                                              <span className="text-xs font-mono text-center px-2 py-1.5 rounded-md bg-primary/20 text-foreground ring-1 ring-primary/40 font-semibold">
                                                {Math.round(totalDist * 100) / 100} km
                                              </span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </li>
                                  );
                                }

                                // Check if this is a conditioning line (Name — X min / X km)
                                const { name: condLineName, weight: condLineWeight } = parseExerciseWeight(line);
                                const isCondLine = condLineWeight && (condLineWeight.includes("min") || condLineWeight.includes("/km") || /\d+\s*km/i.test(condLineWeight));

                                if (isCondLine) {
                                  const cTimeM = condLineWeight.match(/(\d+)\s*min/);
                                  const cTempoM = condLineWeight.match(/([\d:.]+)\/km/);
                                  const cDistM = condLineWeight.match(/([\d.,]+)\s*km(?!\/)/);
                                  const pTime = cTimeM ? cTimeM[1] : "";
                                  const pDist = cDistM ? cDistM[1] : "";
                                  const pTempo = cTempoM ? cTempoM[1] : "";
                                  const cKey = `__cond__${condLineName}`;
                                  const cRaw = (completions[key]?.logged_weights as Record<string, any>)?.[cKey];
                                  let cSaved: Record<string, any> | null = null;
                                  if (cRaw) { try { const p = typeof cRaw === "string" ? JSON.parse(cRaw) : cRaw; if (p && typeof p === "object") cSaved = p; } catch {} }
                                  const cHasSaved = !!(cSaved && (cSaved.time || cSaved.dist || cSaved.tempo || cSaved.pulse));
                                  return (
                                    <li key={i} className="list-none">
                                      <ConditioningEditCard
                                        name={condLineName}
                                        lineIndex={i}
                                        planId={plan.id}
                                        planCondTime={pTime}
                                        planCondDist={pDist}
                                        planCondTempo={pTempo}
                                        savedData={cSaved}
                                        hasSavedData={cHasSaved}
                                        exerciseLinesCount={detailParts.length}
                                        isCompleted={isConditioningDone(key, condLineName)}
                                        onToggleCompleted={() => toggleConditioningDone(plan.week, plan.day, condLineName)}
                                        onMoveUp={() => moveExercise(plan.id, i, "up")}
                                        onMoveDown={() => moveExercise(plan.id, i, "down")}
                                        onShowInfo={() => setExerciseInfoState({ name: condLineName })}
                                        onDelete={() => setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(condLineName) })}
                                        onSave={async (data) => {
                                          await updateCompletionWeights(plan.week, plan.day, (existing) => {
                                            return { ...existing, [cKey]: JSON.stringify(data) };
                                          });
                                          const infoParts: string[] = [];
                                          if (data.time) infoParts.push(`${data.time} min`);
                                          if (data.tempo) infoParts.push(`${data.tempo}/km`);
                                          if (data.dist) infoParts.push(`${data.dist} km`);
                                          if (data.pulse) infoParts.push(`${data.pulse} bpm`);
                                          const entry = infoParts.length > 0 ? `${condLineName} — ${infoParts.join(", ")}` : condLineName;
                                          const separator = plan.details.includes("\n") ? "\n" : "; ";
                                          const allLines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                                          allLines[i] = entry;
                                          const newDetails = allLines.join(separator);
                                          await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                                          setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
                                          triggerSave();
                                        }}
                                      />
                                    </li>
                                  );
                                }

                                const isExercise = isExerciseLine(line);

                                if (!isExercise) {
                                  return (
                                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground italic leading-relaxed px-1 py-0.5">
                                      <span className="flex-1">{line}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: line });
                                        }}
                                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 touch-manipulation">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </li>
                                  );
                                }

                                return (
                                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                                    <span className="text-muted-foreground">•</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setExerciseInfoState({ name: cleanName }); }}
                                      className="p-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                                      title="Visa övningsinformation">
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="flex-1">{line}</span>
                                    <div className="flex flex-col flex-shrink-0">
                                      <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3 h-3" /></button>
                                      <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === detailParts.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3 h-3" /></button>
                                    </div>
                                    <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         e.preventDefault();
                                         setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: line });
                                       }}
                                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 touch-manipulation">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (() => {
                            // Single line - check conditioning format first
                            const { name: sCondName, weight: sCondWeight } = parseExerciseWeight(plan.details);
                            const isSingleCond = sCondWeight && (sCondWeight.includes("min") || sCondWeight.includes("/km") || /\d+\s*km/i.test(sCondWeight));

                            if (isSingleCond) {
                              const scTimeM = sCondWeight.match(/(\d+)\s*min/);
                              const scTempoM = sCondWeight.match(/([\d:.]+)\/km/);
                              const scDistM = sCondWeight.match(/([\d.,]+)\s*km(?!\/)/);
                              const spTime = scTimeM ? scTimeM[1] : "";
                              const spDist = scDistM ? scDistM[1] : "";
                              const spTempo = scTempoM ? scTempoM[1] : "";
                              const scKey = `__cond__${sCondName}`;
                              const scRaw = (completions[key]?.logged_weights as Record<string, any>)?.[scKey];
                              let scSaved: Record<string, any> | null = null;
                              if (scRaw) { try { const p = typeof scRaw === "string" ? JSON.parse(scRaw) : scRaw; if (p && typeof p === "object") scSaved = p; } catch {} }
                              const scHasSaved = !!(scSaved && (scSaved.time || scSaved.dist || scSaved.tempo || scSaved.pulse));
                              return (
                                <ConditioningEditCard
                                  name={sCondName}
                                  lineIndex={0}
                                  planId={plan.id}
                                  planCondTime={spTime}
                                  planCondDist={spDist}
                                  planCondTempo={spTempo}
                                  savedData={scSaved}
                                  hasSavedData={scHasSaved}
                                  exerciseLinesCount={1}
                                  isCompleted={isConditioningDone(key, sCondName)}
                                  onToggleCompleted={() => toggleConditioningDone(plan.week, plan.day, sCondName)}
                                  onMoveUp={() => {}}
                                  onMoveDown={() => {}}
                                  onShowInfo={() => setExerciseInfoState({ name: sCondName })}
                                  onDelete={() => setDeleteExerciseConfirm({ planId: plan.id, lineIndex: 0, name: toTitleCase(sCondName) })}
                                  onSave={async (data) => {
                                    await updateCompletionWeights(plan.week, plan.day, (existing) => {
                                      return { ...existing, [scKey]: JSON.stringify(data) };
                                    });
                                    const infoParts: string[] = [];
                                    if (data.time) infoParts.push(`${data.time} min`);
                                    if (data.tempo) infoParts.push(`${data.tempo}/km`);
                                    if (data.dist) infoParts.push(`${data.dist} km`);
                                    if (data.pulse) infoParts.push(`${data.pulse} bpm`);
                                    const entry = infoParts.length > 0 ? `${sCondName} — ${infoParts.join(", ")}` : sCondName;
                                    await supabase.from("workout_plans").update({ details: entry }).eq("id", plan.id);
                                    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: entry } : p));
                                    triggerSave();
                                  }}
                                />
                              );
                            }

                            const suggestion = isSuggestedDistance(plan.details);
                            if (suggestion) {
                              return (
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center gap-2">
                                  <Route className="w-4 h-4 text-primary flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Föreslagen distans</p>
                                    <p className="text-sm font-semibold text-foreground">{suggestion.name} {suggestion.distance} km</p>
                                  </div>
                                </div>
                              );
                            }
                            const isExercise = isExerciseLine(plan.details);
                            return isExercise ? (
                              <p className="text-sm text-foreground leading-relaxed">{plan.details}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground italic leading-relaxed">{plan.details}</p>
                            );
                          })()}
                          {(() => {
                            // Parse logged conditioning data from plan details + saved conditioning payloads + direct fields
                            const loggedEntries: {
                              name: string;
                              time?: string;
                              tempo?: string;
                              distance?: string;
                              pulse?: string;
                              spm?: string;
                              steps?: string;
                              lineIndex: number;
                              source: "details" | "direct" | "weights";
                              rawInfo?: string;
                              weightKey?: string;
                            }[] = [];

                            // 1) Parse plan details for logged lines (format: "Name — time, tempo, distance, pulse")
                            const detailLines = plan.details.split(/[;\n]/).map(l => l.trim()).filter(Boolean);
                            for (let li = 0; li < detailLines.length; li++) {
                              const line = detailLines[li];
                              const dashMatch = line.match(/^(.+?)\s*—\s*(.+)$/);
                              if (!dashMatch) continue;

                              const eName = dashMatch[1].trim();
                              const info = dashMatch[2];
                              const entry: any = { name: eName, lineIndex: li, source: "details", rawInfo: info };

                              const timeM = info.match(/(\d+(?:[.,]\d+)?)\s*min/);
                              if (timeM) entry.time = timeM[1];
                              const tempoM = info.match(/(\d+:\d+)\/km/);
                              if (tempoM) entry.tempo = tempoM[1];
                              const distM = info.match(/([\d.,]+)\s*km(?!\/)/);
                              if (distM) entry.distance = distM[1].replace(",", ".");
                              const pulseM = info.match(/(\d+)\s*bpm/);
                              if (pulseM) entry.pulse = pulseM[1];
                              const spmM = info.match(/(\d+)\s*spm/);
                              if (spmM) entry.spm = spmM[1];
                              const stepsM = info.match(/(\d+)\s*steg/);
                              if (stepsM) entry.steps = stepsM[1];

                              if (entry.time || entry.tempo || entry.distance || entry.pulse || entry.spm || entry.steps) {
                                loggedEntries.push(entry);
                              }
                            }

                            // 2) Merge in saved conditioning payloads from logged_weights (__cond__...)
                            const condWeights = (comp?.logged_weights || {}) as Record<string, any>;
                            for (const [weightKey, rawValue] of Object.entries(condWeights)) {
                              if (!weightKey.startsWith("__cond__")) continue;
                              try {
                                const data = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
                                if (!data || typeof data !== "object") continue;

                                const name = weightKey.replace(/^__cond__/, "").trim() || "Kondition";
                                const time = data.time ? String(data.time) : undefined;
                                const tempo = data.tempo ? String(data.tempo).replace(/\s*\/km\s*$/i, "") : undefined;
                                const distance = data.dist ? String(data.dist).replace(",", ".") : undefined;
                                const pulse = data.pulse ? String(data.pulse) : undefined;
                                const spm = data.spm ? String(data.spm) : undefined;
                                const steps = data.steps
                                  ? String(data.steps)
                                  : (() => {
                                      const t = parseFloat(String(data.time ?? "").replace(",", "."));
                                      const s = parseFloat(String(data.spm ?? "").replace(",", "."));
                                      return t > 0 && s > 0 ? String(Math.round(t * s)) : undefined;
                                    })();

                                if (!(time || tempo || distance || pulse || spm || steps)) continue;

                                const existing = loggedEntries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
                                if (existing) {
                                  if (!existing.time && time) existing.time = time;
                                  if (!existing.tempo && tempo) existing.tempo = tempo;
                                  if (!existing.distance && distance) existing.distance = distance;
                                  if (!existing.pulse && pulse) existing.pulse = pulse;
                                  if (!existing.spm && spm) existing.spm = spm;
                                  if (!existing.steps && steps) existing.steps = steps;
                                  continue;
                                }

                                loggedEntries.push({
                                  name,
                                  time,
                                  tempo,
                                  distance,
                                  pulse,
                                  spm,
                                  steps,
                                  lineIndex: -1,
                                  source: "weights",
                                  weightKey,
                                });
                              } catch {}
                            }

                            // 3) Include legacy direct fields if present (but never for stair machine data)
                            const hasStairData = loggedEntries.some((e) => e.spm || e.steps);
                            if (!hasStairData && comp && (comp.logged_tempo || comp.logged_pulse || comp.logged_distance_km)) {
                              const hasDirectData = !loggedEntries.length ||
                                (comp.logged_distance_km && !loggedEntries.some((e) => e.distance));
                              if (hasDirectData) {
                                loggedEntries.unshift({
                                  name: plan.session_name || "Kondition",
                                  tempo: comp.logged_tempo || undefined,
                                  pulse: comp.logged_pulse ? String(comp.logged_pulse) : undefined,
                                  distance: comp.logged_distance_km ? String(comp.logged_distance_km) : undefined,
                                  lineIndex: -1,
                                  source: "direct",
                                });
                              }
                            }

                            // Filter out entries already rendered inline by ConditioningEditCard
                            const inlineCondNames = new Set<string>();
                            const pLines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                            for (const pLine of pLines) {
                              const { name: pName, weight: pWeight } = parseExerciseWeight(pLine);
                              if (pWeight && (pWeight.includes("min") || pWeight.includes("/km") || /\d+\s*km/i.test(pWeight))) {
                                inlineCondNames.add(pName.toLowerCase());
                              }
                            }
                            const filteredEntries = loggedEntries.filter(e => !inlineCondNames.has(e.name.toLowerCase()));

                            if (filteredEntries.length === 0) return null;

                            // Check if we're editing one of these lines
                            if (editingCondLine && editingCondLine.planId === plan.id) {
                              return (
                                <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
                                  <p className="text-xs font-bold text-success">✏️ Redigera: {editingCondLine.name}</p>
                                  {isStairMachine(editingCondLine.name) ? (
                                    <>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid</label>
                            <div className="flex items-center gap-1">
                              <input type="number" inputMode="numeric" min="0" value={condTimeHours} onChange={(e) => handleCondTimeChange('h', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">h</span>
                              <input type="number" inputMode="numeric" min="0" max="59" value={condTimeMinutes} onChange={(e) => handleCondTimeChange('m', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">m</span>
                              <input type="number" inputMode="numeric" min="0" max="59" value={condTimeSeconds} onChange={(e) => handleCondTimeChange('s', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">s</span>
                            </div>
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">SPM (steg/min)</label>
                                          <input type="number" inputMode="numeric" value={condSpmInput} onChange={(e) => setCondSpmInput(e.target.value)} placeholder="t.ex. 80" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                        </div>
                                      </div>
                                      {(() => {
                                        const time = condTimeTotalMin;
                                        const spm = parseFloat(condSpmInput.replace(",", "."));
                                        if (time > 0 && spm > 0) {
                                          return (
                                            <div className="bg-primary/10 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                                              <span className="text-muted-foreground">Totalt:</span>
                                              <span className="font-mono font-bold text-foreground">{Math.round(time * spm)} steg</span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                      <div>
                                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                                        <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid</label>
                            <div className="flex items-center gap-1">
                              <input type="number" inputMode="numeric" min="0" value={condTimeHours} onChange={(e) => handleCondTimeChange('h', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">h</span>
                              <input type="number" inputMode="numeric" min="0" max="59" value={condTimeMinutes} onChange={(e) => handleCondTimeChange('m', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">m</span>
                              <input type="number" inputMode="numeric" min="0" max="59" value={condTimeSeconds} onChange={(e) => handleCondTimeChange('s', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">s</span>
                            </div>
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo (min/km)</label>
                                      <input type="text" value={condTempoInput} onChange={(e) => setCondTempoInput(e.target.value)} placeholder="t.ex. 5:30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Distans (km)</label>
                                      <input type="number" inputMode="decimal" value={condDistanceInput} onChange={(e) => setCondDistanceInput(e.target.value)} placeholder="t.ex. 5" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                                      <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                    </div>
                                  </div>
                                    </>
                                  )}
                                  <div className="flex gap-2">
                                    <button onClick={saveEditedCondLine} className="flex-1 py-2 bg-success text-success-foreground rounded-md text-xs font-semibold">
                                      Spara
                                    </button>
                                      <button onClick={() => { setEditingCondLine(null); resetCondTime(); setCondTempoInput(""); setCondDistanceInput(""); setCondAutoField(null); setCondPulseInput(""); setCondSpmInput(""); }} className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                                      Avbryt
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
                                <p className="text-xs font-bold text-success">📊 Loggat resultat</p>
                                {filteredEntries.map((e, i) => (
                                  <div key={i} className={`${filteredEntries.length > 1 ? "border-l-2 border-success/30 pl-2" : ""} group`}>
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="flex-1">
                                        {filteredEntries.length > 1 && <p className="text-[10px] font-semibold text-success/80">{e.name}</p>}
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                          {e.time && <p className="text-xs">⏱ <span className="font-mono font-semibold">{e.time} min</span></p>}
                                          {e.spm && <p className="text-xs">🦶 <span className="font-mono font-semibold">{e.spm} spm</span></p>}
                                          {e.steps && <p className="text-xs">👣 <span className="font-mono font-semibold">{e.steps} steg</span></p>}
                                          {e.tempo && <p className="text-xs">🏃 <span className="font-mono font-semibold">{e.tempo}/km</span></p>}
                                          {e.distance && <p className="text-xs">📏 <span className="font-mono font-semibold">{e.distance} km</span></p>}
                                          {e.pulse && <p className="text-xs">❤️ <span className="font-mono font-semibold">{e.pulse} bpm</span></p>}
                                        </div>
                                      </div>
                                      <div className="flex gap-0.5 flex-shrink-0">
                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            if (e.source === "details") {
                                              startEditCondLine(plan.id, e.lineIndex, e.name, e.rawInfo || "");
                                            }
                                          }}
                                          className="p-2 text-muted-foreground hover:text-primary transition-colors touch-manipulation"
                                          title="Redigera">
                                          <Pencil className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            if (e.source === "details") {
                                              deleteConditioningLine(plan.id, e.lineIndex);
                                            } else if (e.source === "weights" && e.weightKey) {
                                              deleteCondWeightLog(plan.week, plan.day, e.weightKey);
                                            } else {
                                              deleteDirectCondLog(plan.week, plan.day);
                                            }
                                          }}
                                          className="p-2 text-muted-foreground hover:text-destructive transition-colors touch-manipulation"
                                          title="Ta bort">
                                          <X className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>);

                  }

                  // Extract exercises from details
                  const parts = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
                  const comp = completions[key];
                  const savedWeights = (comp?.logged_weights || {}) as Record<string, number>;

                  // Pre-scan: map exercise indices to their parent circuit header (if any)
                  const circuitMap: Record<number, { roundCount: number; headerIndex: number; exerciseIndices: number[] }> = {};
                  {
                    let currentCircuit: { roundCount: number; headerIndex: number; exerciseIndices: number[] } | null = null;
                    for (let pi = 0; pi < parts.length; pi++) {
                      const p = parts[pi].trim();
                      const circuitMatch = p.match(/^(\d+)\s+(?:rundor|cirklar)(?:\s+à\s+\d+\s*min)?\s*:(.*)/i);
                      const amrapMatch = !circuitMatch ? p.match(/^(\d+)\s*(min\s+)?amrap\s*:(.*)/i) : null;
                      if (circuitMatch || amrapMatch) {
                        const count = parseInt((circuitMatch || amrapMatch)![1]);
                        const inlineExs = ((circuitMatch ? circuitMatch[2] : amrapMatch![3]) || "").trim();
                        // If exercises are inline (separated by /), they're listed in the header, not separate parts
                        // But time specs like "40s arbete / 20s vila" are NOT exercise names
                        const isOnlyTimeSpecs = inlineExs && inlineExs.split(/[/;]/).every(s => !s.trim() || /^\d+s?\s*(arbete|vila|rest|work|mellan)/i.test(s.trim()));
                        if (!inlineExs || isOnlyTimeSpecs) {
                          currentCircuit = { roundCount: count, headerIndex: pi, exerciseIndices: [] };
                        } else {
                          currentCircuit = null;
                        }
                      } else if (currentCircuit) {
                        // Check if this part is a regular exercise (not a header/conditioning)
                        const { name: eName } = parseExerciseWeight(p);
                        const matchedEx = allExercises.find(e => e.name.toLowerCase() === eName.toLowerCase());
                        const isCondFormat = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad/i.test(p) && !/^\d+\s*[×x]\s*\d+/i.test(p);
                        if (!isCondFormat && !/^vila$/i.test(eName.trim())) {
                          currentCircuit.exerciseIndices.push(pi);
                          circuitMap[pi] = currentCircuit;
                        } else {
                          currentCircuit = null; // End circuit block on non-exercise
                        }
                      }
                    }
                  }

                  // Helper: find previously logged weight for an exercise from earlier weeks + archived
                  const findPreviousWeight = (exerciseName: string): number | null => {
                    // Look through completions from previous weeks for this exercise
                    for (let w = plan.week - 1; w >= 1; w--) {
                      for (const p of plans.filter((pp) => pp.week === w)) {
                        const compKey = `${w}-${p.day}`;
                        const comp = completions[compKey];
                        const weights = comp?.logged_weights as Record<string, number> | null;
                        if (weights && weights[exerciseName]) {
                          return weights[exerciseName];
                        }
                      }
                    }
                    // Fallback: search archived completions
                    for (const archComp of archivedCompletions) {
                      const weights = archComp.logged_weights as Record<string, number> | null;
                      if (weights && weights[exerciseName]) {
                        return weights[exerciseName];
                      }
                    }
                    return null;
                  };

                  // Find last conditioning log for a session with the same name
                  const findLastConditioningLog = (sessionName: string, currentWeek: number): { tempo: string | null; dist: number | null; time: string | null; week: number } | null => {
                    const matchingPlans = plans.filter(p => 
                      p.session_name === sessionName && p.week < currentWeek
                    ).sort((a, b) => b.week - a.week);
                    
                    for (const p of matchingPlans) {
                      const k = `${p.week}-${p.day}`;
                      const comp = completions[k];
                      if (comp?.done) {
                        const weights = comp.logged_weights as Record<string, any> | null;
                        if (weights) {
                          for (const [wk, val] of Object.entries(weights)) {
                            if (wk.startsWith('__cond__')) {
                              try {
                                const data = typeof val === 'string' ? JSON.parse(val) : val;
                                if (data.tempo || data.dist) {
                                  return { tempo: data.tempo || null, dist: data.dist ? parseFloat(data.dist) : null, time: data.time || null, week: p.week };
                                }
                              } catch {}
                            }
                          }
                        }
                        if (comp.logged_tempo || comp.logged_distance_km) {
                          return { 
                            tempo: comp.logged_tempo || null, 
                            dist: comp.logged_distance_km ? Number(comp.logged_distance_km) : null,
                            time: null,
                            week: p.week
                          };
                        }
                      }
                    }
                    return null;
                  };

                  // Count completed conditioning sessions for a given session name (for threshold every-5th logic)
                  const countCompletedCondSessions = (sessionName: string, currentWeek: number): number => {
                    return plans.filter(p => 
                      p.session_name === sessionName && p.week < currentWeek
                    ).filter(p => {
                      const k = `${p.week}-${p.day}`;
                      return completions[k]?.done;
                    }).length;
                  };

                  // Find last logged kg+reps for a strength exercise from completed sessions
                  // If targetReps is provided, prefer sets with matching rep count
                  const findLastLoggedKg = (exerciseName: string, currentWeek: number, targetReps?: number): { kg: number; reps?: number } | null => {
                    // Collect all matching sets first
                    type SetInfo = { kg: number; reps: number };
                    const allSets: SetInfo[] = [];
                    const collectSets = (weights: Record<string, any>) => {
                      const exLower = normalizeExerciseKey(exerciseName);
                      const setDataRaw = weights[`__setdata__${exerciseName}`] ?? weights[`__setdata__${exLower}`];
                      if (setDataRaw) {
                        try {
                          const setData = typeof setDataRaw === 'string' ? JSON.parse(setDataRaw) : setDataRaw;
                          if (Array.isArray(setData)) {
                            for (let si = 0; si < setData.length; si++) {
                              const s = setData[si];
                              const rawKg = parseFloat(s.kg);
                              const mode = weights[`__bw_mode__${exerciseName}__${si}`] ?? weights[`__bw_mode__${exLower}__${si}`] ?? weights[`__bw_mode__${exerciseName}`] ?? weights[`__bw_mode__${exLower}`];
                              const kg = mode === "sub" && rawKg > 0 ? -rawKg : rawKg;
                              if (kg !== 0 && !isNaN(kg)) allSets.push({ kg, reps: parseInt(s.reps) || 0 });
                            }
                          }
                        } catch {}
                      }
                    };
                    // Search plan weeks backwards
                    for (let w = currentWeek - 1; w >= 1; w--) {
                      for (const p of plans.filter(pp => pp.week === w)) {
                        const k = `${w}-${p.day}`;
                        const comp = completions[k];
                        if (!comp?.done) continue;
                        const weights = comp.logged_weights as Record<string, any> | null;
                        if (!weights) continue;
                        collectSets(weights);
                      }
                    }
                    // Also search single workouts (week 0)
                    const singlePlans = plans.filter(p => p.week === 0).sort((a, b) => b.day.localeCompare(a.day));
                    for (const p of singlePlans) {
                      const k = `0-${p.day}`;
                      const comp = completions[k];
                      if (!comp?.done) continue;
                      const weights = comp.logged_weights as Record<string, any> | null;
                      if (!weights) continue;
                      collectSets(weights);
                    }

                    if (allSets.length === 0) return null;

                    // Prefer matching rep count
                    if (targetReps) {
                      const matching = allSets.filter(s => s.reps === targetReps);
                      if (matching.length > 0) {
                        const best = matching[matching.length - 1];
                        return { kg: best.kg, reps: best.reps };
                      }
                    }
                    // Fallback: latest set
                    const last = allSets[allSets.length - 1];
                    return { kg: last.kg, reps: last.reps || undefined };
                  };

                  // Progressive increase: vary by rep range
                  const getProgression = (weight: number, repsStr: string | null): number => {
                    const reps = repsStr ? parseInt(repsStr) : 10;
                    // High reps (8+) = smaller increase, low reps (1-5) = larger increase
                    if (reps <= 3) return Math.round((weight + 5) / 2.5) * 2.5;
                    if (reps <= 5) return Math.round((weight + 2.5) / 2.5) * 2.5;
                    if (reps <= 8) return Math.round((weight + 2.5) / 2.5) * 2.5;
                    return Math.round((weight + 1.25) / 1.25) * 1.25; // 12+ reps = +1.25 kg
                  };

                  return (
                    <div className="space-y-2">
                        {parts.map((part, i) => {
                        // Check if this is a conditioning exercise
                        const { name: partCondCheckName } = parseExerciseWeight(part);
                        const matchedExercise = allExercises.find(e => e.name.toLowerCase() === partCondCheckName.toLowerCase());
                        const isCondExercise = (matchedExercise?.category === "kondition" || /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|(?<![-\w])gång(?![-\w])|intervallträning/i.test(part)) && !/amrap\s*:/i.test(part) && !/^\d+\s+(?:rundor|cirklar)\s*/i.test(part.trim()) && !/^\d+\s*[×x]\s*\d+\s*min/i.test(part.trim()) && !/^mål:/i.test(part.trim()) && !/^intervallöpning\s*:/i.test(part.trim()) && !(plan.session_name.toLowerCase().includes("intervall") && /rundor/i.test(plan.details));
                        
                        if (isCondExercise) {
                          // Check if this is a pure distance suggestion (e.g. "Löpning 8.5 km")
                          const suggestMatch = part.trim().match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*km\s*$/i);
                          const isSuggestion = suggestMatch && allExercises.some(e => e.name.toLowerCase() === suggestMatch[1].trim().toLowerCase() && e.category === "kondition");
                          if (isSuggestion && suggestMatch) {
                            return (
                              <div key={i} className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center gap-2">
                                <Route className="w-4 h-4 text-primary flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Föreslagen distans</p>
                                  <p className="text-sm font-semibold text-foreground">{suggestMatch[1]} {parseFloat(suggestMatch[2].replace(",", "."))} km</p>
                                </div>
                              </div>
                            );
                          }

                          // Parse conditioning data from the part
                          const { name: condName } = parseExerciseWeight(part);
                          // Parse interval pattern like "3×10 min (2 min joggvila)" or "3×10 min, 2 min vila"
                          const intervalMatch = part.match(/(\d+)\s*[×x]\s*(\d+)\s*min(?:\s*[,(]\s*(\d+)\s*(?:min\s*)?(?:jogg)?vila)?/i);
                          const intervalCount = intervalMatch ? parseInt(intervalMatch[1]) : 0;
                          const intervalDuration = intervalMatch ? parseInt(intervalMatch[2]) : 0;
                          const intervalRest = intervalMatch && intervalMatch[3] ? intervalMatch[3] : "";
                          
                          const condTimeM = !intervalMatch ? part.match(/(\d+)\s*min/) : null;
                          const condTempoM = part.match(/([\d:.]+)\s*\/km/);
                          const condDistM = part.match(/([\d.,]+)\s*km(?!\/)/);
                          const planTime = condTimeM ? condTimeM[1] : "";
                          const planTempo = condTempoM ? condTempoM[1] : "";
                          const planDist = condDistM ? condDistM[1] : "";
                          
                          // Get saved conditioning data from completions
                          const condComp = completions[key];
                          const condWeights = (condComp?.logged_weights || {}) as Record<string, any>;
                          const savedCondData = condWeights[`__cond__${condName || part}`];
                          const condSaved = savedCondData ? (typeof savedCondData === 'string' ? JSON.parse(savedCondData) : savedCondData) : null;
                          
                          const displayTime = condSaved?.time || planTime;
                          const displayDist = condSaved?.dist || planDist;
                          let displayTempo = condSaved?.tempo || planTempo;
                          
                          // Auto-calculate tempo if time and distance exist but no tempo
                          if (!displayTempo && displayTime && displayDist) {
                            const t = parseFloat(displayTime);
                            const d = parseFloat(String(displayDist).replace(',', '.'));
                            if (t > 0 && d > 0) {
                              const tempoMin = t / d;
                              const mins = Math.floor(tempoMin);
                              const secs = Math.round((tempoMin - mins) * 60);
                              displayTempo = `${mins}:${secs.toString().padStart(2, '0')}`;
                            }
                          }
                          
                          const saveCondField = async (field: string, value: any) => {
                            const condKey = `__cond__${condName || part}`;
                            let finalData: Record<string, any> = {};

                            await updateCompletionWeights(plan.week, plan.day, (existing) => {
                              let currentData: Record<string, any> = { time: planTime, dist: planDist, tempo: planTempo };
                              const rawCurrent = existing[condKey];
                              if (rawCurrent) {
                                try {
                                  const parsed = typeof rawCurrent === "string" ? JSON.parse(rawCurrent) : rawCurrent;
                                  if (parsed && typeof parsed === "object") {
                                    currentData = { ...currentData, ...parsed };
                                  }
                                } catch {
                                  // Ignore malformed legacy data
                                }
                              }

                              const updated = { ...currentData, [field]: value };

                              // Auto-calculate tempo (only for non-interval fields)
                              if (field !== "intervals" && (field === "time" || field === "dist")) {
                                const t = parseFloat(field === "time" ? value : updated.time || "0");
                                const d = parseFloat(String(field === "dist" ? value : updated.dist || "0").replace(",", "."));
                                if (t > 0 && d > 0) {
                                  const tempoMin = t / d;
                                  const mins = Math.floor(tempoMin);
                                  const secs = Math.round((tempoMin - mins) * 60);
                                  updated.tempo = `${mins}:${secs.toString().padStart(2, "0")}`;
                                }
                              }

                              finalData = updated;
                              return { ...existing, [condKey]: JSON.stringify(updated) };
                            });

                            // Keep plan.details in sync so other viewers (friends) see the correct values
                            if (field !== "intervals") {
                              const infoParts: string[] = [];
                              if (finalData.time) infoParts.push(`${finalData.time} min`);
                              if (finalData.tempo) infoParts.push(`${finalData.tempo}/km`);
                              if (finalData.dist) infoParts.push(`${finalData.dist} km`);
                              if (finalData.pulse) infoParts.push(`${finalData.pulse} bpm`);
                              if (finalData.spm) infoParts.push(`${finalData.spm} spm`);
                              const lineName = condName || (part.match(/^([^—–]+)/)?.[1].trim() || part);
                              const newLine = infoParts.length > 0 ? `${lineName} — ${infoParts.join(", ")}` : lineName;
                              const separator = plan.details.includes("\n") ? "\n" : "; ";
                              const allLines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                              if (allLines[i] !== newLine) {
                                allLines[i] = newLine;
                                const newDetails = allLines.join(separator);
                                await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                                setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
                              }
                            }
                          };
                          
                          return (
                            <div key={i} className="bg-primary/5 rounded-lg p-3 border border-primary/20 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleConditioningDone(plan.week, plan.day, condName || part); }}
                                    className={`w-8 h-8 shrink-0 border-2 flex items-center justify-center transition-all ${isConditioningDone(key, condName || part) ? "bg-success border-success text-success-foreground" : "border-primary/30 text-muted-foreground hover:border-primary"}`}
                                    title="Klarmarkera"
                                  >
                                    {isConditioningDone(key, condName || part) ? <Check className="w-4 h-4" /> : null}
                                  </button>
                                  <span className="font-semibold text-sm text-foreground flex items-center gap-1.5 min-w-0">
                                    <Footprints className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="truncate">{toTitleCase(condName || part)}</span>
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <div className="flex flex-col">
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === parts.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3.5 h-3.5" /></button>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); setExerciseInfoState({ name: condName || part }); }} className="p-0.5 text-muted-foreground hover:text-warning transition-colors">
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={(e) => {e.stopPropagation();e.preventDefault();setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(condName || part) });}} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors touch-manipulation">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {/* Interval checkmarks integrated into per-interval rows below */}
                              {/* Last tempo / conditioning progression suggestion */}
                              {(() => {
                                if (isStairMachine(condName || part)) return null;
                                const lastLog = findLastConditioningLog(plan.session_name, plan.week);
                                if (!lastLog) return null;
                                
                                // For interval sessions: never suggest distance, only suggest increasing interval time
                                const isInterval = intervalCount > 0;
                                const isThreshold = plan.session_name.toLowerCase().includes("tröskel");
                                const completedCount = countCompletedCondSessions(plan.session_name, plan.week);
                                
                                if (isInterval) {
                                  // For intervals: suggest increasing interval duration (time), never distance
                                  const suggestedDuration = intervalDuration + 1;
                                  // Extract last logged tempo from interval data
                                  let lastIntervalTempo: string | null = null;
                                  if (lastLog) {
                                    // Check if last log has interval-level data with tempo
                                    const matchingPlansForTempo = plans.filter(p => 
                                      p.session_name === plan.session_name && p.week < plan.week
                                    ).sort((a, b) => b.week - a.week);
                                    for (const mp of matchingPlansForTempo) {
                                      const mk = `${mp.week}-${mp.day}`;
                                      const mc = completions[mk];
                                      if (mc?.done) {
                                        const mw = mc.logged_weights as Record<string, any> | null;
                                        if (mw) {
                                          for (const [wk, val] of Object.entries(mw)) {
                                            if (wk.startsWith('__cond__')) {
                                              try {
                                                const data = typeof val === 'string' ? JSON.parse(val) : val;
                                                if (data.intervals && Array.isArray(data.intervals)) {
                                                  const tempos = data.intervals.filter((r: any) => r.tempo?.trim()).map((r: any) => r.tempo);
                                                  if (tempos.length > 0) {
                                                    // Calculate average tempo from intervals
                                                    let totalSecs = 0; let count = 0;
                                                    for (const t of tempos) {
                                                      const s = tempoToSeconds(t);
                                                      if (s) { totalSecs += s; count++; }
                                                    }
                                                    if (count > 0) lastIntervalTempo = secondsToTempo(Math.round(totalSecs / count));
                                                  }
                                                }
                                                if (!lastIntervalTempo && data.tempo) lastIntervalTempo = data.tempo;
                                              } catch {}
                                            }
                                          }
                                        }
                                        if (!lastIntervalTempo && mc.logged_tempo) lastIntervalTempo = mc.logged_tempo;
                                        if (lastIntervalTempo) break;
                                      }
                                    }
                                  }
                                  return (
                                    <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-0.5">
                                      <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">📈 Föreslagen tid</p>
                                      <p className="text-xs text-foreground">
                                        <span className="font-mono font-semibold">{intervalCount}×{suggestedDuration} min</span>
                                        <span className="text-muted-foreground ml-1">(+1 min/intervall)</span>
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">Nuvarande: {intervalCount}×{intervalDuration} min{isThreshold ? ` (pass ${completedCount + 1})` : ''}</p>
                                      {lastIntervalTempo && (
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                          <Timer className="w-3 h-3" />
                                          Senast loggat tempo: <span className="font-mono font-semibold text-foreground">{lastIntervalTempo}/km</span>
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                                
                                // For non-interval conditioning: threshold = distance every 5th, others alternate
                                const isDistancePass = isThreshold ? (completedCount > 0 && completedCount % 5 === 0) : (plan.week - lastLog.week) % 2 === 0;
                                const isSpeedWeek = !isDistancePass;
                                
                                if (isSpeedWeek && lastLog.tempo) {
                                  const lastSecs = tempoToSeconds(lastLog.tempo);
                                  if (lastSecs) {
                                    const fasterSecs = Math.round(lastSecs * 0.995);
                                    const lowSecs = Math.max(fasterSecs - 5, 120);
                                    const highSecs = fasterSecs + 5;
                                    return (
                                      <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-0.5">
                                        <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">📈 Föreslagen hastighet</p>
                                        <p className="text-xs text-foreground">
                                          <span className="font-mono font-semibold">{secondsToTempo(lowSecs)}–{secondsToTempo(highSecs)}</span>
                                          <span className="text-muted-foreground ml-1">/km (0,5% snabbare)</span>
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">Baserat på senast loggade: {lastLog.tempo}/km{isThreshold ? ` (pass ${completedCount + 1})` : ''}</p>
                                      </div>
                                    );
                                  }
                                } else if (isDistancePass && lastLog.dist) {
                                  const newDist = Math.round(lastLog.dist * 1.1 * 100) / 100;
                                  return (
                                    <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-0.5">
                                      <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">📈 Föreslagen distans</p>
                                      <p className="text-xs text-foreground">
                                        <span className="font-mono font-semibold">{newDist} km</span>
                                        <span className="text-muted-foreground ml-1">(+10% ökning)</span>
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">Baserat på senast loggade: {lastLog.dist} km{isThreshold ? ` (var 5:e pass)` : ''}</p>
                                    </div>
                                  );
                                }
                                // Fallback: just show last tempo if available
                                if (lastLog.tempo) {
                                  // Don't show if user already has saved conditioning data for this exercise
                                  const hasCurrentData = condSaved?.tempo;
                                  if (!hasCurrentData) {
                                    return (
                                      <p className="text-[10px] text-muted-foreground pl-1 flex items-center gap-1">
                                        <Timer className="w-3 h-3" />
                                        Senast: <span className="font-mono font-semibold text-foreground">{lastLog.tempo}/km</span> (v{lastLog.week})
                                      </p>
                                    );
                                  }
                                }
                                return null;
                              })()}
                              {intervalCount > 0 ? (
                                <div className="space-y-2">
                                  {/* Per-interval header */}
                                  <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-end">
                                    <span className="w-7" />
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5"><Timer className="w-3 h-3 text-primary" />Tid</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5"><Route className="w-3 h-3 text-primary" />Distans</span>
                                  </div>
                                  {/* Per-interval rows - use saved intervals length or plan count */}
                                  {(() => {
                                    const savedIntervals: Array<{time: string; tempo: string; dist: string}> = condSaved?.intervals || [];
                                    const activeCount = savedIntervals.length > 0 ? savedIntervals.length : intervalCount;
                                    
                                    return Array.from({ length: activeCount }, (_, ii) => {
                                    const row = savedIntervals[ii] || { time: String(intervalDuration), tempo: planTempo || '', dist: '' };
                                    const rowTempo = row.tempo;
                                    const rowTime = parseFloat(row.time) || 0;
                                    // Auto-calc distance
                                    let rowDist = '';
                                    if (rowTempo && rowTime > 0) {
                                      const tMatch = rowTempo.match(/^(\d+)[:\.](\d+)$/);
                                      const tSingle = rowTempo.match(/^(\d+)$/);
                                      let minPerKm = 0;
                                      if (tMatch) minPerKm = (parseInt(tMatch[1]) * 60 + parseInt(tMatch[2])) / 60;
                                      else if (tSingle) minPerKm = parseInt(tSingle[1]);
                                      if (minPerKm > 0) rowDist = String(Math.round((rowTime / minPerKm) * 100) / 100);
                                    }
                                    if (row.dist && !rowDist) rowDist = row.dist;
                                    return (
                                      <div key={ii} className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-center">
                                        {(() => {
                                          const intervalSetsKey = `__sets__interval_${condName || part}`;
                                          const setsStr = ((completions[key]?.logged_weights as Record<string, any>)?.[intervalSetsKey] as string) || "";
                                          const isDone = setsStr[ii] === "1";
                                          return (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const arr = Array.from({ length: activeCount }, (_, j) => setsStr[j] === "1");
                                                arr[ii] = !arr[ii];
                                                triggerSetRestTimer(arr[ii]);
                                                const newStr = arr.map(b => b ? "1" : "0").join("");
                                                const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                                const updated = { ...existing, [intervalSetsKey]: newStr };
                                                setCompletions(prev => ({
                                                  ...prev,
                                                  [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated }
                                                }));
                                                await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                                              }}
                                              className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                                                isDone
                                                  ? "bg-success border-success text-success-foreground"
                                                  : "border-primary/30 text-muted-foreground hover:border-primary"
                                              }`}
                                            >
                                              {isDone ? <Check className="w-3.5 h-3.5" /> : ii + 1}
                                            </button>
                                          );
                                        })()}
                                        <AutoSaveInput
                                          type="number" inputMode="numeric"
                                          initialValue={row.time || String(intervalDuration)}
                                          onSave={(v) => {
                                            const arr = [...(condSaved?.intervals || Array.from({ length: activeCount }, () => ({ time: String(intervalDuration), tempo: planTempo || '', dist: '' })))];
                                            arr[ii] = { ...arr[ii], time: v };
                                            // Auto-calc dist
                                            const t = parseFloat(v) || 0;
                                            const tm = arr[ii].tempo?.match(/^(\d+)[:\.](\d+)$/);
                                            const ts = arr[ii].tempo?.match(/^(\d+)$/);
                                            let mpk = 0;
                                            if (tm) mpk = (parseInt(tm[1]) * 60 + parseInt(tm[2])) / 60;
                                            else if (ts) mpk = parseInt(ts[1]);
                                            if (t > 0 && mpk > 0) arr[ii].dist = String(Math.round((t / mpk) * 100) / 100);
                                            saveCondField('intervals', arr as any);
                                          }}
                                          className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none"
                                        />
                                        <AutoSaveInput
                                          type="text"
                                          initialValue={rowTempo}
                                          onSave={(v) => {
                                            const arr = [...(condSaved?.intervals || Array.from({ length: activeCount }, () => ({ time: String(intervalDuration), tempo: planTempo || '', dist: '' })))];
                                            arr[ii] = { ...arr[ii], tempo: v };
                                            if (ii === 0 && v.trim()) {
                                              const allEmpty = arr.slice(1).every(r => !r.tempo?.trim());
                                              if (allEmpty) {
                                                for (let j = 1; j < arr.length; j++) {
                                                  arr[j] = { ...arr[j], tempo: v };
                                                }
                                              }
                                            }
                                            // Auto-calc dist for all rows
                                            for (let j = 0; j < arr.length; j++) {
                                              const rt = parseFloat(arr[j].time) || 0;
                                              const tm2 = arr[j].tempo?.match(/^(\d+)[:\.](\d+)$/);
                                              const ts2 = arr[j].tempo?.match(/^(\d+)$/);
                                              let mpk2 = 0;
                                              if (tm2) mpk2 = (parseInt(tm2[1]) * 60 + parseInt(tm2[2])) / 60;
                                              else if (ts2) mpk2 = parseInt(ts2[1]);
                                              if (rt > 0 && mpk2 > 0) arr[j].dist = String(Math.round((rt / mpk2) * 100) / 100);
                                            }
                                            saveCondField('intervals', arr as any);
                                          }}
                                          placeholder="5:30"
                                          className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
                                        />
                                        <span className={`text-xs font-mono text-center px-2 py-1.5 rounded-md ${rowDist ? 'bg-primary/10 text-foreground ring-1 ring-primary/30' : 'text-muted-foreground'}`}>
                                          {rowDist || '—'}
                                        </span>
                                      </div>
                                    );
                                  });
                                  })()}
                                  {/* Add/remove interval buttons */}
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const currentIntervals = condSaved?.intervals || Array.from({ length: intervalCount }, () => ({ time: String(intervalDuration), tempo: planTempo || '', dist: '' }));
                                        if (currentIntervals.length > 1) {
                                          const newArr = currentIntervals.slice(0, -1);
                                          saveCondField('intervals', newArr as any);
                                          // Also trim the sets tracking
                                          const intervalSetsKey = `__sets__interval_${condName || part}`;
                                          const setsStr = ((completions[key]?.logged_weights as Record<string, any>)?.[intervalSetsKey] as string) || "";
                                          if (setsStr.length > newArr.length) {
                                            const trimmedStr = setsStr.slice(0, newArr.length);
                                            const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                            const updated = { ...existing, [intervalSetsKey]: trimmedStr };
                                            setCompletions(prev => ({
                                              ...prev,
                                              [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated }
                                            }));
                                            await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                                          }
                                        }
                                      }}
                                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary"
                                    >
                                      <Trash2 className="w-3 h-3" /> Ta bort intervall
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const currentIntervals = condSaved?.intervals || Array.from({ length: intervalCount }, () => ({ time: String(intervalDuration), tempo: planTempo || '', dist: '' }));
                                        const lastRow = currentIntervals[currentIntervals.length - 1] || { time: String(intervalDuration), tempo: '', dist: '' };
                                        const newArr = [...currentIntervals, { time: lastRow.time || String(intervalDuration), tempo: '', dist: '' }];
                                        saveCondField('intervals', newArr as any);
                                      }}
                                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary"
                                    >
                                      <Plus className="w-3 h-3" /> Lägg till intervall
                                    </button>
                                  </div>
                                  {/* Summary row */}
                                  {(() => {
                                    const intervalsData: Array<{time: string; tempo: string; dist: string}> = condSaved?.intervals || [];
                                    let totDist = 0;
                                    let totTime = 0;
                                    intervalsData.forEach((r) => {
                                      const t = parseFloat(r.time) || 0;
                                      totTime += t;
                                      if (r.tempo && t > 0) {
                                        const tMatch = r.tempo.match(/^(\d+)[:\.](\d+)$/);
                                        const tSingle = r.tempo.match(/^(\d+)$/);
                                        let minPerKm = 0;
                                        if (tMatch) minPerKm = (parseInt(tMatch[1]) * 60 + parseInt(tMatch[2])) / 60;
                                        else if (tSingle) minPerKm = parseInt(tSingle[1]);
                                        if (minPerKm > 0) totDist += t / minPerKm;
                                      }
                                    });
                                    if (totDist <= 0) return null;
                                    const avgTempo = totTime / totDist;
                                    const avgMins = Math.floor(avgTempo);
                                    const avgSecs = Math.round((avgTempo - avgMins) * 60);
                                    return (
                                      <div className="flex items-center justify-between bg-primary/5 rounded-md px-3 py-1.5 text-[11px]">
                                        <span className="text-muted-foreground">Totalt</span>
                                        <div className="flex gap-3 font-semibold font-mono text-foreground">
                                          <span>{totTime} min</span>
                                          <span>{avgMins}:{String(avgSecs).padStart(2, '0')} /km</span>
                                          <span>{Math.round(totDist * 100) / 100} km</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : isStairMachine(condName || part) ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-0.5">
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Timer className="w-3 h-3 text-primary" />Tid (min)</label>
                                      <AutoSaveInput type="number" inputMode="numeric" initialValue={displayTime} onSave={(v) => saveCondField('time', v)} placeholder="—" className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">🦶 SPM (steg/min)</label>
                                      <AutoSaveInput type="number" inputMode="numeric" initialValue={condSaved?.spm || ""} onSave={(v) => saveCondField('spm', v)} placeholder="—" className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                    </div>
                                  </div>
                                  {(() => {
                                    const t = parseFloat(condSaved?.time || displayTime || "0");
                                    const s = parseFloat(condSaved?.spm || "0");
                                    if (t > 0 && s > 0) {
                                      return (
                                        <div className="bg-primary/10 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                                          <span className="text-muted-foreground">Totalt:</span>
                                          <span className="font-mono font-bold text-foreground">{Math.round(t * s)} steg</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-[1fr_auto] gap-2">
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid</label>
                                      <div className="flex items-center gap-1">
                                        {(() => {
                                          const totalMin = parseFloat(displayTime) || 0;
                                          const initH = Math.floor(totalMin / 60);
                                          const initM = Math.floor(totalMin % 60);
                                          const initS = Math.round((totalMin % 1) * 60);
                                          const condTimeKey = `__cond_hms__${condName || part}`;
                                          const saveHMS = (h: string, m: string, s: string) => {
                                            const hv = parseInt(h) || 0;
                                            const mv = parseInt(m) || 0;
                                            const sv = parseInt(s) || 0;
                                            const total = hv * 60 + mv + sv / 60;
                                            if (total > 0) saveCondField('time', String(Math.round(total * 100) / 100));
                                          };
                                          return (
                                            <ConditioningHMSInput
                                              initialH={initH > 0 ? String(initH) : ""}
                                              initialM={totalMin > 0 ? String(initM) : ""}
                                              initialS={initS > 0 ? String(initS) : ""}
                                              onSave={saveHMS}
                                            />
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo (min/km)</label>
                                      <AutoSaveInput type="text" initialValue={displayTempo} onSave={(v) => saveCondField('tempo', v)} placeholder="t.ex. 5:30" className="w-24 bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 items-end">
                                    <div className="space-y-0.5">
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Route className="w-3 h-3 text-primary" />Distans (km)</label>
                                      <AutoSaveInput type="text" inputMode="decimal" initialValue={displayDist} onSave={(v) => saveCondField('dist', v)} placeholder="—" className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">Snittspuls (bpm)</label>
                                      <AutoSaveInput type="number" inputMode="numeric" initialValue={condSaved?.pulse || ""} onSave={(v) => saveCondField('pulse', v)} placeholder="t.ex. 155" className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Extract exercise name (text before first digit pattern)
                        const nameMatch = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d)/);
                        const exerciseName = nameMatch ? nameMatch[1].trim() : null;
                        const isLoggable = exerciseName && exerciseName.length > 2 && !exerciseName.toLowerCase().includes("vila") && !exerciseName.toLowerCase().includes("vilodag");

                        // Extract reps from part for progression calculation
                        const repsMatch = part.match(/\d+\s*[×x]\s*(\d+)/i);
                        const repsStr = repsMatch ? repsMatch[1] : null;

                        // Determine default value: saved > previous week with progression
                        let defaultWeight: number | string = "";
                        if (exerciseName && isLoggable) {
                          if (savedWeights[exerciseName]) {
                            defaultWeight = savedWeights[exerciseName];
                          } else {
                            const prevWeight = findPreviousWeight(exerciseName);
                            if (prevWeight) {
                              defaultWeight = getProgression(prevWeight, repsStr);
                            }
                          }
                        }

                        // Extract RPE first, then parse structured format
                        const { clean: cleanPart, rpe: partRpe } = extractRpe(part);
                        const partStructMatch = cleanPart.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)(s)?(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
                        // Fallback: try to extract just sets from "NxM" or "Nx..." pattern
                        const fallbackSetsMatch = !partStructMatch ? cleanPart.match(/(\d+)\s*[×x]\s*\S+/) : null;
                        const partName = partStructMatch ? partStructMatch[1].trim().replace(/\s*—\s*$/, '') : exerciseName || cleanPart;
                        const partSets = partStructMatch ? partStructMatch[2] : fallbackSetsMatch ? fallbackSetsMatch[1] : null;
                        const partReps = partStructMatch ? partStructMatch[3] : null;
                        const partIsTimeBased = partStructMatch ? !!partStructMatch[4] : false;
                        const partKg = partStructMatch && partStructMatch[5] ? partStructMatch[5].trim() : null;

                        const isEditing = editingExercise?.planId === plan.id && editingExercise?.lineIndex === i;

                        if (isEditing) {
                          return (
                            <div key={i} className="bg-secondary/60 rounded-lg p-3 border border-primary/30 space-y-2 animate-fade-in">
                                <div className="space-y-0.5">
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Övning</label>
                                  <input type="text" value={editingExercise.name} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, name: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary font-semibold" />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Set</label>
                                    <input type="number" inputMode="numeric" value={editingExercise.sets} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, sets: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Reps</label>
                                    <input type="number" inputMode="numeric" value={editingExercise.reps} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, reps: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Vikt (kg)</label>
                                    <input type="number" inputMode="decimal" value={editingExercise.weight} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, weight: e.target.value } : null)} placeholder="—" className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono placeholder:text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveEditedExercise()} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold">Spara</button>
                                  <button onClick={() => setEditingExercise(null)} className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs">Avbryt</button>
                                </div>
                              </div>);

                        }

                        // If this exercise is inside a circuit block, override set count to match circuit rounds
                        const circuitInfo = circuitMap[i];
                        const setsCountPlan = circuitInfo ? circuitInfo.roundCount : (partSets ? parseInt(partSets) : 1);
                        const setsStrPlan = getSetsDone(key, partName);

                        // Daily challenge exercise - render with distinct style
                        const isDailyChallenge = part.startsWith("⚔️ Utmaning:");
                        if (isDailyChallenge) {
                          const challengeName = part.replace("⚔️ Utmaning:", "").trim();
                          return (
                            <div key={i} className="bg-muted/30 rounded-lg p-2.5 border border-border space-y-1">
                              <div className="flex items-center gap-2">
                                <Swords className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Utmaning</span>
                                  <p className="text-xs font-semibold text-foreground">{challengeName}</p>
                                </div>
                                <Check className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        }

                        // "Mål:" line - render as goal info with rounds input for AMRAP
                        if (/^mål:/i.test(part.trim())) {
                          const goalText = part.replace(/^mål:\s*/i, "").trim();
                          const isAmrap = goalText.toLowerCase().includes("rundor") || plan.session_name.toLowerCase().includes("amrap");
                          const wodWeights = (completions[key]?.logged_weights || {}) as Record<string, any>;
                          const savedRoundsRaw = wodWeights["__wod_rounds__"];
                          const savedRounds = savedRoundsRaw ? (typeof savedRoundsRaw === "string" ? savedRoundsRaw : String(savedRoundsRaw)) : "";

                          // Find previous rounds from identical WOD
                          const prevRounds = (() => {
                            const matching = plans
                              .filter(p => p.session_name === plan.session_name && p.details === plan.details && (p.week < plan.week || (p.week === plan.week && p.day < plan.day)))
                              .sort((a, b) => b.week - a.week || b.day.localeCompare(a.day));
                            for (const mp of matching) {
                              const mc = completions[`${mp.week}-${mp.day}`];
                              if (!mc?.done) continue;
                              const mw = (mc.logged_weights || {}) as Record<string, any>;
                              const mr = mw["__wod_rounds__"];
                              if (mr) return { rounds: String(mr), week: mp.week };
                            }
                            return null;
                          })();

                          return (
                            <div key={i} className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="text-xs font-bold text-foreground">{goalText}</span>
                              </div>
                              {isAmrap && (
                                <div className="flex items-center gap-2">
                                  <AutoSaveInput
                                    type="number"
                                    inputMode="numeric"
                                    initialValue={savedRounds}
                                    onSave={async (v) => {
                                      const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                      const updated = { ...existing, "__wod_rounds__": v } as any;
                                      setCompletions(prev => ({
                                        ...prev,
                                        [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated } as Completion
                                      }));
                                      await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                                    }}
                                    placeholder="0"
                                    className="w-16 bg-background text-foreground text-sm px-2 py-2 rounded-md border border-primary/30 outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground"
                                  />
                                  <span className="text-xs text-muted-foreground font-medium">rundor</span>
                                  {prevRounds && (
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                      Förra: <span className="font-semibold text-primary">{prevRounds.rounds} rundor</span> (v{prevRounds.week})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Detect lines with round structure: "X rundor:", "X rundor à Y min:", "X cirklar:", "X min AMRAP:", "X×Y min ...", or "X rundor: exercise / exercise / ..."
                        const roundsHeaderMatch = part.trim().match(/^(\d+)\s+(?:rundor|cirklar)(?:\s+à\s+\d+\s*min)?\s*:(.*)/i);
                        const amrapHeaderMatch = !roundsHeaderMatch ? part.trim().match(/^(\d+)\s*(min\s+)?amrap\s*:(.*)/i) : null;
                        const intervalHeaderMatch = !roundsHeaderMatch && !amrapHeaderMatch ? part.trim().match(/^(\d+)\s*[×x]\s*(\d+)\s*min\b(.*)/i) : null;
                        const namedIntervalMatch = !roundsHeaderMatch && !amrapHeaderMatch && !intervalHeaderMatch ? part.trim().match(/^(intervallöpning|intervall)\s*:\s*(.+?)\s+(\d+)\s*[×x]\s*(\d+)\s*min\s*$/i) : null;

                        // Running interval session: show per-interval TID/TEMPO/DISTANS fields
                        if (intervalHeaderMatch && (plan.session_name.toLowerCase().includes("intervall") || plan.session_name.toLowerCase().includes("löpning"))) {
                          const iCount = parseInt(intervalHeaderMatch[1]);
                          const iDuration = parseInt(intervalHeaderMatch[2]);
                          const restOfText = intervalHeaderMatch[3]?.trim() || "";

                          // Get tempo from plan.tempo
                          let iPlanTempo = "";
                          const iTempoFromLine = part.match(/([\d:.]+)\s*\/km/);
                          if (iTempoFromLine) iPlanTempo = iTempoFromLine[1];
                          if (!iPlanTempo && plan.tempo) {
                            const planTempoMatch = plan.tempo.match(/([\d:.]+)\s*(?:min\/km|\/km)/);
                            if (planTempoMatch) iPlanTempo = planTempoMatch[1];
                          }

                          const iCondKey = `__cond__${part.trim()}`;
                          const iRawSaved = (completions[key]?.logged_weights as Record<string, any>)?.[iCondKey];
                          let iCondSaved: Record<string, any> | null = null;
                          if (iRawSaved) {
                            try {
                              const p = typeof iRawSaved === "string" ? JSON.parse(iRawSaved) : iRawSaved;
                              if (p && typeof p === "object") iCondSaved = p;
                            } catch {}
                          }

                          const saveIntervalField = async (field: string, value: any) => {
                            await updateCompletionWeights(plan.week, plan.day, (existing) => {
                              let currentData: Record<string, any> = {};
                              const rawCurrent = existing[iCondKey];
                              if (rawCurrent) {
                                try {
                                  const parsed = typeof rawCurrent === "string" ? JSON.parse(rawCurrent) : rawCurrent;
                                  if (parsed && typeof parsed === "object") currentData = { ...currentData, ...parsed };
                                } catch {}
                              }
                              return { ...existing, [iCondKey]: JSON.stringify({ ...currentData, [field]: value }) };
                            });
                          };

                          const savedIntervals: Array<{time: string; tempo: string; dist: string}> = iCondSaved?.intervals || [];
                          const activeCount = savedIntervals.length > 0 ? savedIntervals.length : iCount;
                          const intervalSetsKey = `__sets__interval_${part.trim()}`;
                          const setsStr = ((completions[key]?.logged_weights as Record<string, any>)?.[intervalSetsKey] as string) || "";

                          return (
                            <div key={i} className="bg-primary/5 rounded-lg p-3 border border-primary/20 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                  <Timer className="w-3.5 h-3.5 text-primary" />
                                  {part.trim()}
                                </span>
                                <button onClick={(e) => {e.stopPropagation();e.preventDefault();setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: part.trim() });}} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors touch-manipulation">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {/* Per-interval header */}
                              <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-end">
                                <span className="w-7" />
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5"><Timer className="w-3 h-3 text-primary" />Tid</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5"><Route className="w-3 h-3 text-primary" />Distans</span>
                              </div>
                              {Array.from({ length: activeCount }, (_, ii) => {
                                const row = savedIntervals[ii] || { time: String(iDuration), tempo: iPlanTempo, dist: '' };
                                const rowTempo = row.tempo;
                                const rowTime = parseFloat(row.time) || 0;
                                let rowDist = '';
                                if (rowTempo && rowTime > 0) {
                                  const tMatch = rowTempo.match(/^(\d+)[:\.](\d+)$/);
                                  const tSingle = rowTempo.match(/^(\d+)$/);
                                  let minPerKm = 0;
                                  if (tMatch) minPerKm = (parseInt(tMatch[1]) * 60 + parseInt(tMatch[2])) / 60;
                                  else if (tSingle) minPerKm = parseInt(tSingle[1]);
                                  if (minPerKm > 0) rowDist = String(Math.round((rowTime / minPerKm) * 100) / 100);
                                }
                                if (row.dist && !rowDist) rowDist = row.dist;

                                const isDoneI = setsStr[ii] === "1";

                                return (
                                  <div key={ii} className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-center">
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const arr = Array.from({ length: activeCount }, (_, j) => setsStr[j] === "1");
                                        arr[ii] = !arr[ii];
                                        triggerSetRestTimer(arr[ii]);
                                        const newStr = arr.map(b => b ? "1" : "0").join("");
                                        const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                        const updated = { ...existing, [intervalSetsKey]: newStr };
                                        setCompletions(prev => ({
                                          ...prev,
                                          [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated }
                                        }));
                                        await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                                      }}
                                      className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                                        isDoneI ? "bg-success border-success text-success-foreground" : "border-primary/30 text-muted-foreground hover:border-primary"
                                      }`}
                                    >
                                      {isDoneI ? <Check className="w-3.5 h-3.5" /> : ii + 1}
                                    </button>
                                    <AutoSaveInput
                                      type="number" inputMode="numeric"
                                      initialValue={row.time || String(iDuration)}
                                      onSave={(v) => {
                                        const arr = [...(iCondSaved?.intervals || Array.from({ length: activeCount }, () => ({ time: String(iDuration), tempo: iPlanTempo, dist: '' })))];
                                        arr[ii] = { ...arr[ii], time: v };
                                        const t = parseFloat(v) || 0;
                                        const tm = arr[ii].tempo?.match(/^(\d+)[:\.](\d+)$/);
                                        const ts = arr[ii].tempo?.match(/^(\d+)$/);
                                        let mpk = 0;
                                        if (tm) mpk = (parseInt(tm[1]) * 60 + parseInt(tm[2])) / 60;
                                        else if (ts) mpk = parseInt(ts[1]);
                                        if (t > 0 && mpk > 0) arr[ii].dist = String(Math.round((t / mpk) * 100) / 100);
                                        saveIntervalField('intervals', arr);
                                      }}
                                      className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none"
                                    />
                                    <AutoSaveInput
                                      type="text"
                                      initialValue={rowTempo}
                                      onSave={(v) => {
                                        const arr = [...(iCondSaved?.intervals || Array.from({ length: activeCount }, () => ({ time: String(iDuration), tempo: iPlanTempo, dist: '' })))];
                                        arr[ii] = { ...arr[ii], tempo: v };
                                        if (ii === 0 && v.trim()) {
                                          const allEmpty = arr.slice(1).every(r => !r.tempo?.trim());
                                          if (allEmpty) {
                                            for (let j = 1; j < arr.length; j++) arr[j] = { ...arr[j], tempo: v };
                                          }
                                        }
                                        for (let j = 0; j < arr.length; j++) {
                                          const rt = parseFloat(arr[j].time) || 0;
                                          const tm2 = arr[j].tempo?.match(/^(\d+)[:\.](\d+)$/);
                                          const ts2 = arr[j].tempo?.match(/^(\d+)$/);
                                          let mpk2 = 0;
                                          if (tm2) mpk2 = (parseInt(tm2[1]) * 60 + parseInt(tm2[2])) / 60;
                                          else if (ts2) mpk2 = parseInt(ts2[1]);
                                          if (rt > 0 && mpk2 > 0) arr[j].dist = String(Math.round((rt / mpk2) * 100) / 100);
                                        }
                                        saveIntervalField('intervals', arr);
                                      }}
                                      placeholder="5:30"
                                      className="w-full bg-primary/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-primary/20 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground"
                                    />
                                    <span className={`text-xs font-mono text-center px-2 py-1.5 rounded-md ${rowDist ? 'bg-primary/10 text-foreground ring-1 ring-primary/30' : 'text-muted-foreground'}`}>
                                      {rowDist || '—'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        if (roundsHeaderMatch || amrapHeaderMatch || intervalHeaderMatch || namedIntervalMatch) {
                          const roundCount = roundsHeaderMatch ? parseInt(roundsHeaderMatch[1]) : (amrapHeaderMatch ? parseInt(amrapHeaderMatch[1]) : (intervalHeaderMatch ? parseInt(intervalHeaderMatch[1]) : (namedIntervalMatch ? parseInt(namedIntervalMatch[3]) : 0)));
                          const restOfLine = (roundsHeaderMatch ? roundsHeaderMatch[2] : amrapHeaderMatch ? amrapHeaderMatch[3] : intervalHeaderMatch ? intervalHeaderMatch[3] : "").trim();
                          const namedIntervalLabel = namedIntervalMatch ? `${namedIntervalMatch[2]} (${namedIntervalMatch[4]} min)` : "";
                          const isForTime = plan.session_name.toLowerCase().includes("for time") || plan.details.toLowerCase().includes("for time");
                          const isHiit = plan.session_name.toLowerCase().includes("hiit") || plan.session_name.toLowerCase().includes("cirkel") || plan.details.toLowerCase().includes("hiit");
                          const isIntervall = plan.session_name.toLowerCase().includes("intervall");
                          const isDbCircuit = circuitConfigs.has(plan.session_name);
                          const showRoundCheckboxes = isForTime || isHiit || isIntervall || isDbCircuit || plan.is_circuit;

                          // Parse exercises from rest of line (separated by / or ;)
                          // Filter out time specs like "30s arbete", "15s vila", "20s vila"
                          const inlineExercises = restOfLine
                            ? restOfLine.split(/[/;]/).map(s => s.replace(/\.\s*$/, "").trim()).filter(s => s && !/^\d+s?\s*(arbete|vila|rest|work)/i.test(s))
                            : [];

                          // Use unique key per round block to avoid conflicts when multiple blocks exist
                          const roundKey = `__wod_rounds_done_${i}__`;
                          const roundWeights = (completions[key]?.logged_weights || {}) as Record<string, any>;
                          const savedRoundsDone = roundWeights[roundKey] || "";
                          const roundsDoneStr = typeof savedRoundsDone === "string" ? savedRoundsDone : String(savedRoundsDone);

                          // Build header text (without the inline exercises)
                          const headerText = namedIntervalMatch
                            ? `Intervallöpning: ${namedIntervalLabel}`
                            : roundsHeaderMatch
                            ? `${roundsHeaderMatch[1]} ${part.trim().match(/rundor|cirklar/i)?.[0] || "rundor"}`
                            : part.trim().split(":")[0];

                          return (
                            <div key={i} className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                  <Timer className="w-3.5 h-3.5 text-primary" />
                                  {headerText}
                                </p>
                                {(() => {
                                  // Parse work seconds from header line e.g. "32s arbete"
                                  const workMatch = part.match(/(\d+)s\s*arbete/i);
                                  let workSec = workMatch ? parseInt(workMatch[1]) : 0;
                                  // Count exercises: either inline or from circuit map
                                  const circuitExInfo = circuitMap[Object.keys(circuitMap).find(k => circuitMap[parseInt(k)]?.headerIndex === i) as any];
                                  const exerciseNames: string[] = [];
                                  if (inlineExercises.length > 0) {
                                    exerciseNames.push(...inlineExercises);
                                  } else if (circuitExInfo) {
                                    for (const exIdx of circuitExInfo.exerciseIndices) {
                                      const exPart = parts[exIdx];
                                      let { name: eName } = parseExerciseWeight(exPart);
                                      // Strip trailing rep/set specs like "1×32s" from name when no — separator was found
                                      eName = eName.replace(/\s+\d+\s*[×x]\s*\d+\s*s?\s*$/i, "").trim();
                                      if (eName && !/^vila/i.test(eName)) exerciseNames.push(eName);
                                    }
                                  }
                                  // Fallback: if no workSec from header, try to get from exercise lines
                                  if (workSec === 0 && circuitExInfo) {
                                    for (const exIdx of circuitExInfo.exerciseIndices) {
                                      const exPart = parts[exIdx];
                                      // Try parseExerciseWeight first
                                      const { weight } = parseExerciseWeight(exPart);
                                      if (weight) {
                                        const repsMatch = weight.match(/\d+[×x](\d+)/i);
                                        if (repsMatch) { workSec = parseInt(repsMatch[1]) || 0; break; }
                                      }
                                      // Fallback: parse raw line for patterns like "1×32s" or "4×32"
                                      const rawMatch = exPart.match(/(\d+)\s*[×x]\s*(\d+)\s*s?\b/i);
                                      if (rawMatch) { workSec = parseInt(rawMatch[2]) || 0; break; }
                                    }
                                  }
                                  if (exerciseNames.length > 0 && showRoundCheckboxes) {
                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          let adjustedSec = workSec || 30;
                                          try {
                                            const history = JSON.parse(localStorage.getItem("gymberget_circuit_ratings") || "[]");
                                            if (history.length > 0 && workSec > 0) {
                                              const lastRating = history[history.length - 1].rating;
                                              if (lastRating >= 9) adjustedSec = Math.max(10, workSec - 10);
                                              else if (lastRating >= 8) adjustedSec = Math.max(10, workSec - 5);
                                              else if (lastRating <= 2) adjustedSec = workSec + 5;
                                              else if (lastRating <= 3) adjustedSec = workSec + 3;
                                            }
                                          } catch {}
                                          setCircuitTimer({ exercises: exerciseNames, workSeconds: adjustedSec, roundCount: roundCount, weekDayKey: key, headerIndex: i });
                                        }}
                                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
                                      >
                                        <Play className="w-3 h-3" /> Starta
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              {/* Info: work time × exercises */}
                              {(() => {
                                const workMatch = part.match(/(\d+)s\s*arbete/i);
                                const headerRestMatch = part.match(/(\d+)s\s*vila/i);
                                const circuitExInfo2 = circuitMap[Object.keys(circuitMap).find(k => circuitMap[parseInt(k)]?.headerIndex === i) as any];
                                const exCount = inlineExercises.length > 0 ? inlineExercises.length : (circuitExInfo2?.exerciseIndices.length || 0);
                                // Prefer actual rest from a "Vila"-line in details, then plan.tempo, then header
                                let actualRestSec: number | null = null;
                                const vilaLine = (plan.details || "").split(/[\n;]/).map(l => l.trim()).find(l => /^vila\b/i.test(parseExerciseWeight(l).name?.trim() || ""));
                                if (vilaLine) {
                                  const vp = parseExerciseWeight(vilaLine);
                                  const vm = (vp.weight || "").match(/\d+\s*[×x]\s*(\d+)/i);
                                  if (vm) actualRestSec = parseInt(vm[1]);
                                }
                                if (actualRestSec === null) {
                                  const tempoMatch = plan.tempo?.match(/^circuit:\d+(?::\d+)?(?::(\d+))?$/);
                                  if (tempoMatch?.[1]) actualRestSec = parseInt(tempoMatch[1]);
                                }
                                if (actualRestSec === null && headerRestMatch) actualRestSec = parseInt(headerRestMatch[1]);
                                if (workMatch && exCount > 0) {
                                  return (
                                    <p className="text-[10px] text-muted-foreground">
                                      {workMatch[1]}s × {exCount} övningar{actualRestSec !== null ? ` · ${actualRestSec}s vila` : ""}
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                              {inlineExercises.length > 0 && (
                                <div className="space-y-1 pl-5">
                                  {inlineExercises.map((ex, ei) => (
                                    <p key={ei} className="text-xs text-foreground flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                                      {ex}
                                    </p>
                                  ))}
                                </div>
                              )}
                              {showRoundCheckboxes && roundCount > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {Array.from({ length: roundCount }, (_, ri) => {
                                    const isRoundDone = roundsDoneStr[ri] === "1";
                                    return (
                                      <button
                                        key={ri}
                                        onClick={async () => {
                                          const newStr = Array.from({ length: roundCount }, (_, j) => {
                                            if (j === ri) return isRoundDone ? "0" : "1";
                                            return (roundsDoneStr[j] || "0");
                                          }).join("");
                                          const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                          const updated = { ...existing, [roundKey]: newStr } as any;
                                          // Sync: toggle all circuit exercises' set ri
                                          const circuitExInfo = circuitMap[Object.keys(circuitMap).find(k => circuitMap[parseInt(k)]?.headerIndex === i) as any];
                                          if (circuitExInfo) {
                                            const markDone = !isRoundDone;
                                            for (const exIdx of circuitExInfo.exerciseIndices) {
                                              const exPart = parts[exIdx];
                                              const { clean: exClean } = extractRpe(exPart);
                                              const exMatch = exClean.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)s?(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
                                              const exName = exMatch ? exMatch[1].trim().replace(/\s*—\s*$/, '') : parseExerciseWeight(exPart).name;
                                              const setsKey = `__sets__${exName}`;
                                              const currentSets = (updated[setsKey] as string) || "";
                                              const newSets = Array.from({ length: roundCount }, (_, si) => {
                                                if (si === ri) return markDone ? "1" : "0";
                                                return currentSets[si] || "0";
                                              }).join("");
                                              updated[setsKey] = newSets;
                                            }
                                          }
                                          setCompletions(prev => ({
                                            ...prev,
                                            [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated } as Completion
                                          }));
                                          await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                                        }}
                                        className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                                          isRoundDone
                                            ? "bg-success border-success text-success-foreground"
                                            : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
                                        }`}
                                      >
                                        {isRoundDone ? <Check className="w-4 h-4" /> : ri + 1}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Special Vila row for plan mode
                        if (/^vila$/i.test(partName.trim())) {
                          const vilaSecMatch = part.match(/(\d+)\s*[×x]\s*(\d+)/);
                          const vilaSec = vilaSecMatch ? vilaSecMatch[2] : "60";
                          return (
                            <div key={i} className="bg-warning/10 rounded-lg p-2.5 border border-warning/30 flex items-center justify-between">
                              <span
                                className="font-semibold text-sm text-warning cursor-pointer hover:underline"
                                onClick={() => editVilaSeconds(plan.id, i, vilaSec)}
                              >
                                🛏️ Vila {vilaSec}s mellan rundor
                              </span>
                              <div className="flex items-center gap-1">
                                <button onClick={() => editVilaSeconds(plan.id, i, vilaSec)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Redigera vila"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: "Vila" })} className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Ta bort vila"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={i} className="bg-secondary/40 rounded-lg p-2.5 border border-border/30 space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(e) => {e.stopPropagation();setExerciseInfoState({ name: partName });}}
                                    className="p-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                                    title="Visa övningsinformation">
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    className="font-semibold text-sm text-foreground cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => setEditingExercise({
                                      planId: plan.id,
                                      lineIndex: i,
                                      name: partName,
                                      originalName: partName,
                                      sets: partSets || "3",
                                      reps: partReps || repsStr || "10",
                                      weight: partKg || ""
                                    })}>
                                    {toTitleCase(partName)}
                                    {partRpe && <span className="text-xs font-normal text-muted-foreground ml-1.5">{partRpe}</span>}
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <div className="flex flex-col">
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === parts.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3.5 h-3.5" /></button>
                                  </div>
                                   <DropdownMenu modal={false} open={openExerciseMenuId === `${plan.id}-${i}`} onOpenChange={(open) => setOpenExerciseMenuId(open ? `${plan.id}-${i}` : null)}>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          onPointerDown={(e) => {
                                            // Prevent opening on scroll-through touches
                                            const target = e.currentTarget;
                                            target.dataset.pointerStart = `${e.clientX},${e.clientY}`;
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const target = e.currentTarget;
                                            const start = target.dataset.pointerStart;
                                            if (start) {
                                              const [sx, sy] = start.split(",").map(Number);
                                              const dist = Math.sqrt((e.clientX - sx) ** 2 + (e.clientY - sy) ** 2);
                                              if (dist > 10) {
                                                e.preventDefault();
                                                return;
                                              }
                                            }
                                          }}
                                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-primary transition-colors touch-manipulation"
                                          title="Övningsalternativ">
                                          <Settings className="w-4 h-4" />
                                        </button>
                                      </DropdownMenuTrigger>
                                       <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenuItem onClick={() => startReplaceExercise(plan.id, i, partName)}>
                                          <ArrowLeftRight className="w-4 h-4 mr-2" />
                                          Byt ut övning
                                        </DropdownMenuItem>
                                        {canEditExercises && (
                                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpenExerciseMenuId(null); setTimeout(() => setExerciseInfoState({ name: partName, editMode: true }), 0); }}>
                                            <Pencil className="w-4 h-4 mr-2" />
                                            Redigera beskrivning
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(partName) })}>
                                          <X className="w-4 h-4 mr-2" />
                                          Ta bort övning
                                        </DropdownMenuItem>
                                       </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                              </div>
                              {/* Copied-from-previous progression reminder */}
                              {isCopiedExercise(key, partName) && (
                                <div className="pl-1 border-l-2 border-primary/40 bg-primary/5 px-2 py-1.5 rounded-r">
                                  <p className="text-[10px] text-foreground flex items-start gap-1">
                                    <span className="text-primary">💡</span>
                                    <span>Vikt/reps kopierade från förra passet. <span className="font-semibold">Justera själv</span> för att säkerställa progression.</span>
                                  </p>
                                </div>
                              )}
                              {/* Last logged weight note */}
                              {(() => {
                                const targetReps = partReps ? parseInt(partReps) : undefined;
                                const lastKg = findLastLoggedKg(partName, plan.week, targetReps);
                                if (!lastKg) return null;
                                // Don't show if user already has saved data for this session
                                const hasCurrentData = getSetData(key, partName).some(s => s.kg && parseFloat(s.kg) !== 0);
                                if (hasCurrentData) return null;
                                const isNegative = lastKg.kg < 0;
                                const effectiveKg = isNegative && profileWeight ? profileWeight + lastKg.kg : null;
                                return (
                                  <div className="pl-1">
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Weight className="w-3 h-3" />
                                      Senast: <span className="font-mono font-semibold text-foreground">{lastKg.kg} kg{lastKg.reps ? ` (${lastKg.reps} reps)` : ''}</span>
                                    </p>
                                    {isNegative && effectiveKg !== null && (
                                      <p className="text-[10px] text-muted-foreground pl-4">= {Math.round(effectiveKg * 10) / 10} kg effektiv vikt (kroppsvikt {profileWeight} kg)</p>
                                    )}
                                    {isNegative && !profileWeight && (
                                      <button onClick={() => setShowWeightPrompt(true)} className="text-[10px] text-primary pl-4 underline text-left">⚠ Ange din kroppsvikt</button>
                                    )}
                                    <p className="text-[10px] text-muted-foreground pl-4">— öka vikten själv för progression</p>
                                  </div>
                                );
                              })()}
                              <div className="space-y-1 pl-1">
                                  {(() => {
                                    const planSetData = getSetData(key, partName);
                                    const defKg = partKg || "";
                                    const circuitSecMatch = plan.is_circuit ? plan.tempo?.match(/^circuit:(\d+)(?::\d+)?(?::\d+)?$/) : null;
                                    const circuitDefaultSec = circuitSecMatch ? circuitSecMatch[1] : null;
                                    const defReps = circuitDefaultSec || partReps || repsStr || "10";
                                     // Detect bodyweight exercises that don't need kg input
                                    const bodyweightExercises = ["box jumps", "burpees", "pull-ups", "pull ups", "armhävningar", "push-ups", "push ups", "planka", "dead bug", "bird dog", "sit-ups", "sit ups", "mountain climbers", "jumping jacks", "jump squats", "pistol squats", "handstand", "muscle-ups", "muscle ups", "ring rows", "v-ups", "toes to bar", "knees to elbow"];
                                    const isBodyweight = bodyweightExercises.some(bw => partName.toLowerCase().includes(bw)) || /max$/i.test(defReps);
                                    // Weighted bodyweight exercises: user lifts bodyweight +/- additional weight
                                    const weightedBwExercises = ["dips"];
                                    const matchedExForBw = allExercises.find(e => e.name.toLowerCase() === partName.toLowerCase());
                                    const isWeightedBw = weightedBwExercises.some(bw => partName.toLowerCase().includes(bw)) || (matchedExForBw?.isBodyweightExercise === true);
                                     return Array.from({ length: setsCountPlan }, (_, si) => {
                                       // Read bw mode per set, fall back to exercise-level for backward compat
                                       const bwModeKeySet = `__bw_mode__${partName}__${si}`;
                                       const bwModeKeyExercise = `__bw_mode__${partName}`;
                                       const loggedWeights = (completion?.logged_weights as Record<string, any>) || {};
                                        const currentBwMode = (loggedWeights[bwModeKeySet] ?? loggedWeights[bwModeKeyExercise]) === "sub" || isAssistedBodyweightExercise(partName) ? "sub" : "add";
                                       const isSetDone = setsStrPlan[si] === "1";
                                       const saved = planSetData[si];
                                       // Inherit reps/kg from the previous set in this exercise when this set has no logged data
                                       const prevSaved = si > 0 ? planSetData[si - 1] : undefined;
                                       const inheritedReps = prevSaved?.reps && prevSaved.reps.trim() ? prevSaved.reps : defReps;
                                       const inheritedKg = prevSaved?.kg && prevSaved.kg.trim() ? prevSaved.kg : defKg;
                                       return (
                                         <div key={si}>
                                           <div className={`flex items-center gap-1.5 py-0.5 rounded px-1 ${isSetDone ? "opacity-60" : ""}`}>
                                           <Checkbox checked={isSetDone} onCheckedChange={() => toggleSetDone(plan.week, plan.day, partName, si, setsCountPlan, inheritedKg, inheritedReps)} className="h-5 w-5" />
                                           <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">S{si + 1}</span>
                                           <AutoSaveInput type="number" inputMode="numeric" initialValue={circuitDefaultSec ? ((!saved?.reps || saved.reps === partReps || saved.reps === repsStr) ? "" : saved.reps) : (saved?.reps || inheritedReps)} placeholder={circuitDefaultSec ? (findLastReps(partName, si) || inheritedReps || circuitDefaultSec) : undefined} onSave={(v) => saveSetFieldData(plan.week, plan.day, partName, si, 'reps', v, setsCountPlan, inheritedKg, inheritedReps)} className="w-11 bg-primary/10 text-foreground text-xs px-1 py-0.5 rounded border border-primary/30 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                           <span className="text-[10px] text-muted-foreground">{/farmers?\s*walk|yoke\s*walk|sled|bear\s*crawl/i.test(partName) ? "m" : (plan.is_circuit || partIsTimeBased || /^(sido)?planka$|^vila$/i.test(partName.trim()) || customExercises.find(ce => ce.name.toLowerCase() === partName.trim().toLowerCase())?.is_time_based) ? "sek" : "reps"}</span>
                                          {!isBodyweight && (
                                            <>
                                              {isWeightedBw && (
                                                <button
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const newMode = currentBwMode === "add" ? "sub" : "add";
                                                     await updateCompletionWeights(plan.week, plan.day, (existing) => ({
                                                       ...existing,
                                                       [bwModeKeySet]: newMode,
                                                    }));
                                                  }}
                                                  className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold border transition-colors ${
                                                    currentBwMode === "add" 
                                                      ? "bg-primary/10 border-primary/30 text-primary" 
                                                      : "bg-primary/5 border-primary/20 text-primary opacity-70"
                                                  }`}
                                                  title={currentBwMode === "add" ? "Addera vikt till kroppsvikt" : "Dra av vikt från kroppsvikt"}
                                                >
                                                  {currentBwMode === "add" ? "+" : "−"}
                                                </button>
                                              )}
                                              <AutoSaveInput type="number" inputMode="decimal" initialValue={saved?.kg || inheritedKg} onSave={(v) => saveSetFieldData(plan.week, plan.day, partName, si, 'kg', v, setsCountPlan, inheritedKg, inheritedReps)} placeholder="—" className="w-14 bg-primary/10 text-foreground text-xs px-1 py-0.5 rounded border border-primary/30 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                              <span className="text-[10px] text-muted-foreground">kg</span>
                                            </>
                                          )}
                                          </div>
                                          {!isBodyweight && (() => {
                                            const currentKg = parseFloat(saved?.kg || defKg);
                                            if (isWeightedBw && !isNaN(currentKg) && currentKg !== 0) {
                                              if (profileWeight) {
                                                const effective = currentBwMode === "add" ? profileWeight + Math.abs(currentKg) : profileWeight - Math.abs(currentKg);
                                                return <p className="text-[9px] text-muted-foreground pl-8 -mt-0.5">= {Math.round(Math.max(0, effective) * 10) / 10} kg effektiv ({profileWeight} {currentBwMode === "add" ? "+" : "−"} {Math.abs(currentKg)} kg)</p>;
                                              } else {
                                                return <button onClick={() => setShowWeightPrompt(true)} className="text-[9px] text-primary pl-8 -mt-0.5 underline text-left">⚠ Ange din kroppsvikt</button>;
                                              }
                                            }
                                            if (!isNaN(currentKg) && currentKg < 0) {
                                              if (profileWeight) {
                                                return <p className="text-[9px] text-muted-foreground pl-8 -mt-0.5">= {Math.round((profileWeight + currentKg) * 10) / 10} kg effektiv</p>;
                                              } else {
                                                return <button onClick={() => setShowWeightPrompt(true)} className="text-[9px] text-primary pl-8 -mt-0.5 underline text-left">⚠ Ange din kroppsvikt</button>;
                                              }
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 pl-1 pt-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); modifySetCount(plan.id, i, -1, plan.week, plan.day); }}
                                    disabled={setsCountPlan <= 1}
                                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                                    title="Ta bort set">
                                    − Set
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); modifySetCount(plan.id, i, 1, plan.week, plan.day); }}
                                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-primary transition-colors"
                                    title="Lägg till set">
                                    + Set
                                  </button>
                                </div>
                            </div>);

                      })}
                      </div>);

                })()}

                  {/* Reps/sets/weight dialog for plan exercises */}
                  {/* Fallback circuit start button for is_circuit plans without a rounds header */}
                  {plan.is_circuit && plan.details && (() => {
                    const hasRoundsHeader = plan.details.split(/[;\n]/).some(l => /^\d+\s+(?:rundor|cirklar)(?:\s+à\s+\d+\s*min)?\s*:/i.test(l.trim()) || /^\d+\s*(min\s+)?amrap\s*:/i.test(l.trim()));
                    if (hasRoundsHeader) return null;
                    const exerciseLines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                    const parsed = exerciseLines.map(l => parseExerciseWeight(l)).filter(p => p.name && !/^vila$/i.test(p.name.trim()));
                    if (parsed.length === 0) return null;
                    const circuitMatch = plan.tempo?.match(/^circuit:(\d+)(?::(\d+))?(?::(\d+))?$/);
                    const defaultSec = circuitMatch ? parseInt(circuitMatch[1]) : 40;
                    const rounds = circuitMatch?.[2] ? parseInt(circuitMatch[2]) : 3;
                    const vilaLine = exerciseLines.find(l => /^vila\s/i.test(parseExerciseWeight(l).name?.trim() || ""));
                    let restSec = circuitMatch?.[3] ? parseInt(circuitMatch[3]) : 0;
                    if (vilaLine) {
                      const vilaMatch = vilaLine.match(/\d+[×x](\d+)/i);
                      if (vilaMatch) restSec = parseInt(vilaMatch[1]) || restSec;
                    }
                    const exerciseNames = parsed.map(p => p.name);
                    const perExSec: number[][] = parsed.map(p => {
                      const setData = getSetData(key, p.name);
                      const baseSec = (() => {
                        if (p.weight) {
                          const rm = p.weight.match(/\d+×(\d+)/);
                          if (rm) return parseInt(rm[1]) || defaultSec;
                        }
                        return defaultSec;
                      })();
                      return Array.from({ length: rounds }, (_, ri) => {
                        const sd = setData[ri];
                        if (sd?.reps) { const v = parseInt(sd.reps); if (v > 0) return v; }
                        return baseSec;
                      });
                    });
                    return (
                      <button
                        onClick={() => setCircuitTimer({ exercises: exerciseNames, workSeconds: defaultSec, exerciseSeconds: perExSec, roundCount: rounds, restSeconds: restSec, weekDayKey: key, headerIndex: 0 })}
                        className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                      >
                        <Play className="w-4 h-4" /> Starta
                      </button>
                    );
                  })()}

                  {weightDialog && weightDialog.planId === plan.id &&
                <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-primary/30">
                      <h4 className="text-sm font-bold font-sans flex items-center gap-1.5">
                        <Dumbbell className="w-4 h-4 text-primary" />
                        {weightDialog.exerciseName}
                      </h4>
                      {weightDialog.lastWeight &&
                  <p className="text-xs text-muted-foreground">Senast: {weightDialog.lastWeight}</p>
                  }
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Set</label>
                          <input type="number" inputMode="numeric" value={setsInput} onChange={(e) => setSetsInput(e.target.value)} className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-primary" onClick={() => setRepsUnit(u => u === "reps" ? "sek" : "reps")}>{repsUnit === "sek" ? "Sek ⇄" : "Reps ⇄"}</label>
                          <input type="number" inputMode="numeric" value={repsInput} onChange={(e) => setRepsInput(e.target.value)} className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Vikt (kg)</label>
                          <input type="number" inputMode="decimal" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} placeholder="—" className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono placeholder:text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                      onClick={() => addExerciseWithWeight(weightInput.trim() || null)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">

                          <Plus className="w-3.5 h-3.5" /> Lägg till
                        </button>
                        <button
                      onClick={() => {setWeightDialog(null);setWeightInput("");setRepsInput("10");setSetsInput("3");setRepsUnit("reps");}}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">

                          Avbryt
                        </button>
                      </div>
                    </div>
                }

                  {/* Conditioning exercise dialog for plan mode */}
                  {conditioningDialog && conditioningDialog.planId === plan.id &&
                <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-warning/30">
                      <h4 className="text-sm font-bold flex items-center gap-1.5">
                        <Footprints className="w-4 h-4 text-warning" />
                        {conditioningDialog.exerciseName}
                      </h4>
                      {condTempoInput && !isStairMachine(conditioningDialog.exerciseName) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Timer className="w-3 h-3" /> Senast tempo: <span className="font-mono font-semibold text-foreground">{condTempoInput}/km</span>
                        </p>
                      )}
                      {conditioningDialog.exerciseName.toLowerCase().includes("intervall") && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Antal intervaller</label>
                            <input type="number" inputMode="numeric" value={condIntervalsInput} onChange={(e) => setCondIntervalsInput(e.target.value)} placeholder="t.ex. 5" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Vila (min)</label>
                            <input type="number" inputMode="numeric" value={condRestInput} onChange={(e) => setCondRestInput(e.target.value)} placeholder="t.ex. 2" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                        </div>
                      )}
                      {isStairMachine(conditioningDialog.exerciseName) ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid</label>
                            <div className="flex items-center gap-1">
                              <input type="number" inputMode="numeric" min="0" value={condTimeHours} onChange={(e) => handleCondTimeChange('h', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">h</span>
                              <input type="number" inputMode="numeric" min="0" max="59" value={condTimeMinutes} onChange={(e) => handleCondTimeChange('m', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">m</span>
                              <input type="number" inputMode="numeric" min="0" max="59" value={condTimeSeconds} onChange={(e) => handleCondTimeChange('s', e.target.value, false)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              <span className="text-[10px] text-muted-foreground font-medium">s</span>
                            </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">SPM (steg/min)</label>
                              <input type="number" inputMode="numeric" value={condSpmInput} onChange={(e) => setCondSpmInput(e.target.value)} placeholder="t.ex. 80" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                          </div>
                          {(() => {
                            const time = condTimeTotalMin;
                            const spm = parseFloat(condSpmInput.replace(",", "."));
                            if (time > 0 && spm > 0) {
                              return (
                                <div className="bg-primary/10 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                                  <span className="text-muted-foreground">Totalt:</span>
                                  <span className="font-mono font-bold text-foreground">{Math.round(time * spm)} steg</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                            <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                        </>
                      ) : (
                        <>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid</label>
                        <div className="flex items-center gap-1">
                          <input type="number" inputMode="numeric" min="0" value={condTimeHours} onChange={(e) => handleCondTimeChange('h', e.target.value)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          <span className="text-[10px] text-muted-foreground font-medium">h</span>
                          <input type="number" inputMode="numeric" min="0" max="59" value={condTimeMinutes} onChange={(e) => handleCondTimeChange('m', e.target.value)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          <span className="text-[10px] text-muted-foreground font-medium">m</span>
                          <input type="number" inputMode="numeric" min="0" max="59" value={condTimeSeconds} onChange={(e) => handleCondTimeChange('s', e.target.value)} placeholder="0" className="w-14 bg-background text-foreground text-sm px-1 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          <span className="text-[10px] text-muted-foreground font-medium">s</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo</label>
                          <input type="text" value={condTempoInput} onChange={(e) => { const v = e.target.value; setCondTempoInput(v); autoCalcCond(condTimeTotalMin, v, condDistanceInput, "tempo"); }} placeholder="5:30" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Distans</label>
                          <input type="number" inputMode="decimal" value={condDistanceInput} onChange={(e) => { const v = e.target.value; setCondDistanceInput(v); autoCalcCond(condTimeTotalMin, condTempoInput, v, "distance"); }} placeholder="km" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Puls</label>
                          <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="bpm" className="w-full bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                      </div>
                        </>
                      )}
                      <div className="flex gap-2">
                        <button onClick={addConditioningExercise} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">
                          <Plus className="w-3.5 h-3.5" /> Lägg till
                        </button>
                        <button onClick={() => {setConditioningDialog(null);setCondTempoInput("");resetCondTime();setCondDistanceInput("");setCondIntervalsInput("");setCondRestInput("");setCondPulseInput("");setCondSpmInput("");}} className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                          Avbryt
                        </button>
                      </div>
                    </div>
                }

                  {/* Add exercise to plan session */}
                  {!weightDialog && !conditioningDialog &&
                <div className="space-y-1.5">
                  {/* Suggest adding interval training for tröskelpass (plan mode) */}
                  {(() => {
                    const isThresholdSession = plan.session_name.toLowerCase().includes("tröskel") || plan.details.toLowerCase().includes("tröskellöpning");
                    const dp = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                    const hasInterval = dp.some(p => /\d+\s*[×x]\s*\d+\s*min/i.test(p) || p.toLowerCase().includes("intervall"));
                    if (isThresholdSession && !hasInterval) {
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConditioningDialog({ planId: plan.id, exerciseName: "Intervallträning" });
                            const lastCondTempo = findLastCondTempo("Intervallträning");
                            setCondTempoInput(lastCondTempo || "");
                            resetCondTime();
                            setCondDistanceInput("");
                            setCondIntervalsInput("");
                            setCondRestInput("");
                            setCondPulseInput("");
                          }}
                          className="w-full bg-warning/10 border border-warning/30 rounded-lg p-3 text-left hover:bg-warning/20 transition-colors animate-fade-in"
                        >
                          <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" /> Förslag: Lägg till intervallträning
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Tröskelpass inkluderar vanligtvis intervaller. Tryck här för att lägga till.</p>
                        </button>
                      );
                    }
                    return null;
                  })()}
                  {SHOW_STRAVA_INTEGRATION && (
                    <button onClick={() => syncStravaNow(plan)} disabled={stravaSyncing} className="w-full py-2 border border-dashed border-primary/40 rounded-md text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${stravaSyncing ? "animate-spin" : ""}`} /> Synka från Strava
                      </button>
                  )}
                  <button onClick={() => {setShowExercisePicker(plan.id);setSelectedMuscle(null);setIsWarmupMode(false);}} className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> Lägg till övning
                    </button>
                  {plan.is_circuit && (
                    <button
                      onClick={async () => {
                        const restSec = prompt("Antal sekunder vila mellan rundor:", "30");
                        if (!restSec) return;
                        const seconds = parseInt(restSec) || 30;
                        const entry = `Vila — 1×${seconds}`;
                        const separator = plan.details.includes("\n") ? "\n" : "; ";
                        const newDetails = plan.details ? `${plan.details}${separator}${entry}` : entry;
                        await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                        setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
                        triggerSave();
                      }}
                      className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-warning hover:text-warning hover:border-warning transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> Lägg till vila
                    </button>
                  )}
                  <button
                      onClick={() => setImportWorkoutTarget({ planId: plan.id, week: plan.week, day: plan.day })}
                      className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-warning hover:text-warning hover:border-warning transition-colors flex items-center justify-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Importera färdigt pass
                    </button>
                  <button
                      onClick={async () => {
                        if (!confirm(`Rensa alla övningar i "${plan.session_name}"?`)) return;
                        await supabase.from("workout_plans").update({ details: "", session_name: "" }).eq("id", plan.id);
                        setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: "", session_name: "" } : p));
                        triggerSave();
                        toast.success("Passet rensat");
                      }}
                      className="w-full py-2 border border-dashed border-destructive/40 rounded-md text-xs text-destructive hover:text-destructive hover:border-destructive transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Rensa pass
                    </button>
                </div>
                  }
                  <ExercisePickerDialog
                    open={showExercisePicker === plan.id && !weightDialog && !conditioningDialog}
                    onClose={() => { setShowExercisePicker(null); setShowAddCustomExercise(false); setIsWarmupMode(false); setReplaceExerciseTarget(null); }}
                    onSelect={(name) => handleExerciseSelect(plan.id, name)}
                    title={replaceExerciseTarget ? `Byt ut: ${replaceExerciseTarget.name}` : isWarmupMode ? "Välj uppvärmning" : "Lägg till övning"}
                    initialMuscleGroup={selectedMuscle}
                    getLastWeight={findLastWeight}
                    onExerciseInfo={(name) => setExerciseInfoState({ name })}
                    allowCreate
                    userId={userId}
                  />

                  {/* Likes from friends */}
                  {(() => {
                    const dayLikes = workoutLikes.filter((l) => l.week === plan.week && l.day === plan.day);
                    return dayLikes.length > 0 ? (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-sm">🔥</span>
                        <p className="text-[11px] text-muted-foreground">
                          {dayLikes.map((l) => commentNicknames[l.user_id] || "...").join(", ")} gillade detta pass
                        </p>
                      </div>
                    ) : null;
                  })()}

                  {/* Friend comments */}
                  {(() => {
                  const dayComments = friendComments.filter((c) => c.plan_id === plan.id);
                  return dayComments.length > 0 ?
                  <div className="space-y-1.5 bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" /> Kommentarer från vänner
                        </p>
                        {dayComments.map((c) =>
                    <div key={c.id} className="bg-background/80 rounded-md px-3 py-2 flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-xs">
                                <span className="font-semibold text-primary">{commentNicknames[c.author_id] || "..."}</span>{" "}
                                <span className="text-foreground">{c.comment}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(c.created_at).toLocaleDateString("sv-SE")}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteFriendComment(c.id)}
                              className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                              title="Ta bort kommentar">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                    )}
                      </div> :
                  null;
                })()}

                  {/* Own comments display */}
                  {comments[key]?.trim() &&
                <div className="space-y-1">
                      {comments[key].trim().split("\n").filter(Boolean).map((line, i) =>
                  <div key={i} className="bg-accent/30 rounded-lg px-3 py-2 border border-accent/50 flex items-start justify-between gap-2">
                          <p className="text-xs flex items-start gap-1.5 flex-1">
                            <MessageSquare className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-foreground">{line}</span>
                          </p>
                          <button
                      onClick={() => deleteCommentLine(plan.week, plan.day, i)}
                      className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Ta bort kommentar">

                            <X className="w-3 h-3" />
                          </button>
                        </div>
                  )}
                    </div>
                }

                  {/* WOD time logging */}
                  {(() => {
                    const sn = plan.session_name.toLowerCase();
                    const det = plan.details.toLowerCase();
                    const isWod = sn.includes("wod") || sn.includes("amrap") || sn.includes("for time") || sn.includes("emom") || det.includes("amrap") || det.includes("for time") || det.includes("emom");
                    if (!isWod) return null;

                    const comp = completions[key];
                    const weights = (comp?.logged_weights || {}) as Record<string, any>;
                    const savedWodTime = weights["__wod_time__"];
                    const wodData = savedWodTime ? (typeof savedWodTime === "string" ? JSON.parse(savedWodTime) : savedWodTime) : null;

                    // Find previous WOD time from identical session_name
                    const findPrevWodTime = (): { time: string; week: number } | null => {
                      // Look at earlier weeks with same session_name
                      const matchingPlans = plans
                        .filter(p => p.session_name === plan.session_name && p.details === plan.details && (p.week < plan.week || (p.week === plan.week && p.day < plan.day)))
                        .sort((a, b) => b.week - a.week || b.day.localeCompare(a.day));
                      for (const mp of matchingPlans) {
                        const mk = `${mp.week}-${mp.day}`;
                        const mc = completions[mk];
                        if (!mc?.done) continue;
                        const mw = (mc.logged_weights || {}) as Record<string, any>;
                        const mt = mw["__wod_time__"];
                        if (mt) {
                          const mtd = typeof mt === "string" ? JSON.parse(mt) : mt;
                          if (mtd.totalSeconds) return { time: mtd.display || formatWodSeconds(mtd.totalSeconds), week: mp.week };
                        }
                      }
                      return null;
                    };

                    const formatWodSeconds = (s: number): string => {
                      const m = Math.floor(s / 60);
                      const sec = s % 60;
                      return `${m}:${sec.toString().padStart(2, "0")}`;
                    };

                    const prevWod = findPrevWodTime();

                    return (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-xs font-bold text-foreground">WOD-tid</span>
                          {prevWod && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              Förra: <span className="font-semibold text-primary">{prevWod.time}</span> (v{prevWod.week})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <AutoSaveInput
                            type="number"
                            inputMode="numeric"
                            initialValue={wodData?.min?.toString() || ""}
                            onSave={async (v) => {
                              const min = parseInt(v) || 0;
                              const sec = wodData?.sec || 0;
                              const totalSeconds = min * 60 + sec;
                              const display = formatWodSeconds(totalSeconds);
                              const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                              const updated = { ...existing, "__wod_time__": JSON.stringify({ min, sec, totalSeconds, display }) } as any;
                              setCompletions(prev => ({
                                ...prev,
                                [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated } as Completion
                              }));
                              await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                            }}
                            placeholder="0"
                            className="w-16 bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal"
                          />
                          <span className="text-[10px] text-muted-foreground font-medium">min</span>
                          <AutoSaveInput
                            type="number"
                            inputMode="numeric"
                            initialValue={wodData?.sec?.toString() || ""}
                            onSave={async (v) => {
                              const sec = Math.min(59, parseInt(v) || 0);
                              const min = wodData?.min || 0;
                              const totalSeconds = min * 60 + sec;
                              const display = formatWodSeconds(totalSeconds);
                              const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                              const updated = { ...existing, "__wod_time__": JSON.stringify({ min, sec, totalSeconds, display }) } as any;
                              setCompletions(prev => ({
                                ...prev,
                                [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated } as Completion
                              }));
                              await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                            }}
                            placeholder="0"
                            className="w-16 bg-background text-foreground text-sm px-2 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal"
                          />
                          <span className="text-[10px] text-muted-foreground font-medium">sek</span>
                        </div>
                        {isDone && wodData?.totalSeconds > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            Loggad tid: <span className="font-semibold text-foreground">{wodData.display}</span>
                            {prevWod && wodData.totalSeconds < ((() => { const pts = prevWod.time.split(":"); return parseInt(pts[0]) * 60 + parseInt(pts[1]); })()) && (
                              <span className="text-success ml-1.5 font-semibold">⬇ Nytt PB!</span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                      type="text"
                      value={commentInput[key] || ""}
                      onChange={(e) => setCommentInput((prev) => ({ ...prev, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && saveComment(plan.week, plan.day)}
                      placeholder="Skriv en kommentar..."
                      className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />

                    </div>
                  </div>
                    {/* Daily challenge inside today's card */}
                    {isCardToday && (
                      <DailyChallenge userId={userId} onComplete={async (challengeText) => {
                        const cleanChallenge = challengeText.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
                        const challengeEntry = `⚔️ Utmaning: ${cleanChallenge}`;
                        const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
                        const newDetails = plan.details ? `${plan.details}${joinSep}${challengeEntry}` : challengeEntry;
                        await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                        setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
                      }} />
                    )}
                    {/* Calorie burn estimate */}
                    {isDone && plan.details && (
                      profileWeight ? (() => {
                        const comp = completions[key];
                        const cal = estimateCalories(plan.details, comp?.logged_weights as Record<string, any> | null, comp?.logged_pulse || null, profileWeight, profileGender, profileAge);
                        return cal > 0 ? (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-center gap-2">
                            <Flame className="w-4 h-4 flex-shrink-0 text-primary" />
                            <div className="flex-1">
                              <span className="text-xs font-semibold text-primary">~{cal} kcal</span>
                              <span className="text-[10px] ml-1.5 text-primary">
                                {(comp?.logged_weights as any)?.__strava_calories ? "synkat från Strava" : comp?.logged_pulse ? "baserat på puls, vikt & kön" : "uppskattning baserat på vikt"}
                              </span>
                            </div>
                          </div>
                        ) : null;
                      })() : (
                        <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                          <Flame className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <p className="text-[10px] text-muted-foreground">
                            Lägg till din vikt i profilen för att se kaloriförbrukning
                          </p>
                        </div>
                      )
                    )}
                </div>
              }
            </div>
            {/* Add another workout to the same day (shown under last completed plan of the day) */}
            {isDone && !showExercisePicker && !weightDialog && !conditioningDialog && (() => {
              const dayPlansAll = plans.filter(p => p.week === plan.week && sameWorkoutDay(p.day, plan.day));
              const isLastOfDay = dayPlansAll[dayPlansAll.length - 1]?.id === plan.id;
              if (!isLastOfDay) return null;
              // Don't show if last plan of day has no exercises yet
              if (!plan.details?.trim()) return null;
              const isOpen = addExtraDay?.week === plan.week && addExtraDay?.day === getBaseDay(plan.day);
              if (!isOpen) {
                return (
                  <button
                    onClick={() => {
                      setAddExtraDay({ week: plan.week, day: plan.day });
                      setExtraName("");
                      setShowExtraCopyPicker(false);
                    }}
                    className="w-full mt-2 py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Lägg till ett pass till denna dag
                  </button>
                );
              }
              // Inline "Nytt pass" form
              const previousSessions = (() => {
                const uniq = new Map<string, PlanDay>();
                for (const p of plans) {
                  if (!p.session_name?.trim()) continue;
                  const existing = uniq.get(p.session_name);
                  if (!existing || (p.week > existing.week) || (p.week === existing.week && p.day > existing.day)) {
                    uniq.set(p.session_name, p);
                  }
                }
                return Array.from(uniq.values());
              })();
              return (
                <div className="bg-card border border-primary/30 rounded-lg p-4 mt-2 space-y-3 animate-fade-in">
                  <h3 className="text-sm font-semibold">Nytt pass samma dag</h3>

                  <button
                    onClick={() => {
                      setAddExtraDay(null);
                      setShowExtraCopyPicker(false);
                      setImportWorkoutTarget({ planId: "__new__", week: plan.week, day: plan.day });
                    }}
                    className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-warning hover:border-warning transition-colors flex items-center justify-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Importera färdigt pass
                  </button>

                  {previousSessions.length > 0 && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowExtraCopyPicker(!showExtraCopyPicker)}
                        className="w-full py-2 border border-dashed border-primary/40 rounded-md text-xs text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
                      >
                        <TrendingUp className="w-3 h-3" /> Kopiera tidigare pass
                      </button>
                      <p className="text-[10px] text-muted-foreground text-center">Övningar, vikter och reps kopieras — justera själv för progression</p>
                      {showExtraCopyPicker && (
                        <div className="space-y-1 max-h-40 overflow-y-auto animate-fade-in">
                          {previousSessions.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => addExtraWorkoutToDay(plan.week, plan.day, p)}
                              className="w-full text-left p-2.5 bg-secondary rounded-md text-xs hover:bg-primary/10 transition-colors"
                            >
                              <span className="font-semibold block">{p.session_name}</span>
                              {p.details && (
                                <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                                  {p.details.split("\n").slice(0, 2).join(", ")}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    type="text"
                    value={extraName}
                    onChange={(e) => setExtraName(e.target.value)}
                    placeholder="Passnamn (t.ex. Kondition)"
                    className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Lägg till övningar efter att passet skapats
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={extraIsCircuit} onChange={(e) => setExtraIsCircuit(e.target.checked)} className="accent-primary w-4 h-4" />
                    <span className="text-xs text-foreground">Cirkelpass (visar Starta-knapp)</span>
                  </label>
                  {extraIsCircuit && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">Sek/övning:</label>
                        <input type="number" inputMode="numeric" min="5" max="300" value={extraCircuitSeconds} onChange={(e) => setExtraCircuitSeconds(e.target.value)} className="w-16 bg-secondary text-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                        <label className="text-xs text-muted-foreground whitespace-nowrap ml-2">Rundor:</label>
                        <input type="number" inputMode="numeric" min="1" max="20" value={extraCircuitRounds} onChange={(e) => setExtraCircuitRounds(e.target.value)} className="w-16 bg-secondary text-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">Vila mellan rundor:</label>
                        <input type="number" inputMode="numeric" min="0" max="300" value={extraCircuitRest} onChange={(e) => setExtraCircuitRest(e.target.value)} className="w-16 bg-secondary text-foreground text-sm px-2 py-1 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                        <span className="text-xs text-muted-foreground">sek</span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => addExtraWorkoutToDay(plan.week, plan.day)}
                      disabled={!extraName.trim()}
                      className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-40"
                    >
                      Skapa pass
                    </button>
                    <button
                      onClick={() => { setAddExtraDay(null); setShowExtraCopyPicker(false); }}
                      className="px-4 py-2 bg-secondary text-muted-foreground rounded-md text-sm"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>);

        })}
        {/* Empty days – show import button for days without a plan entry */}
        {(() => {
          const occupiedDays = weekDays.map(p => p.day);
          const emptyDays = DAYS.filter(d => !occupiedDays.includes(d));
          if (emptyDays.length === 0 || emptyDays.length === 7) return null;
          // On mobile with swipe, don't show empty days inline
          if (isMobile && weekDays.length > 1) return null;
          return emptyDays.map(day => (
            <div key={`empty-${currentWeek}-${day}`} className="rounded-lg border border-dashed border-border bg-card/50 p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full border-2 border-border flex items-center justify-center">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-muted-foreground">{day}</p>
                  <p className="text-xs text-muted-foreground">Ingen träning planerad</p>
                </div>
              </div>
              <button
                onClick={() => setImportWorkoutTarget({ planId: "__new__", week: currentWeek, day })}
                className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-warning hover:text-warning hover:border-warning transition-colors flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" /> Importera färdigt pass
              </button>
            </div>
          ));
        })()}
      </div>


      {replacementTarget &&
      <ReplacementWorkoutDialog
        userId={userId}
        planId={replacementTarget.planId}
        sessionName={replacementTarget.sessionName}
        week={replacementTarget.week}
        day={replacementTarget.day}
        onClose={() => setReplacementTarget(null)}
        onReplaced={() => {
          setReplacementTarget(null);
          fetchData();
        }}
        onSkipOnly={() => {
          setReplacementTarget(null);
          toggleSkipped(replacementTarget.week, replacementTarget.day);
        }} />

      }

      {/* Run log dialog */}
      {runLogTarget &&
      <WorkoutLogDialog
        userId={userId}
        week={runLogTarget.week}
        day={runLogTarget.day}
        sessionName={runLogTarget.sessionName}
        details={runLogTarget.details}
        planStartDate={planStartDate}
        existingLog={(() => {
          const comp = completions[`${runLogTarget.week}-${runLogTarget.day}`];
          if (!comp) return undefined;
          return {
            logged_tempo: comp.logged_tempo || null,
            logged_pulse: comp.logged_pulse || null,
            logged_distance_km: comp.logged_distance_km || null,
            logged_weights: null
          };
        })()}
        onClose={() => setRunLogTarget(null)}
        onSaved={() => {
          setRunLogTarget(null);
          fetchData();
        }} />

      }
    </div>

    {exerciseInfoState && (
      <ExerciseInfoDialog
        exerciseName={exerciseInfoState.name}
        onClose={() => setExerciseInfoState(null)}
        isAdmin={canEditExercises}
        initialEditMode={exerciseInfoState.editMode}
        onCategoryChanged={() => supabase.from("custom_exercises").select("*").order("name").then(({ data }) => { if (data) setCustomExercises(data); })}
      />
    )}
    {showFireworks && (
      <FireworksOverlay onComplete={() => setShowFireworks(false)} />
    )}
    {/* Circuit Timer */}
    {circuitTimer && (
      <CircuitTimerDialog
        exercises={circuitTimer.exercises}
        workSeconds={circuitTimer.workSeconds}
        exerciseSeconds={circuitTimer.exerciseSeconds}
        roundCount={circuitTimer.roundCount}
        restSeconds={circuitTimer.restSeconds}
        onClose={() => setCircuitTimer(null)}
        onRoundComplete={(roundIndex) => {
          const roundKey = `__wod_rounds_done_${circuitTimer.headerIndex}__`;
          const existing = (completions[circuitTimer.weekDayKey]?.logged_weights || {}) as Record<string, any>;
          const currentStr = (existing[roundKey] as string) || "";
          const newStr = Array.from({ length: circuitTimer.roundCount }, (_, j) => {
            if (j === roundIndex) return "1";
            return currentStr[j] || "0";
          }).join("");
          const updated = { ...existing, [roundKey]: newStr };
          const [wStr, dStr] = circuitTimer.weekDayKey.split("-");
          const w = parseInt(wStr);
          const d = dStr;
          setCompletions(prev => ({
            ...prev,
            [circuitTimer.weekDayKey]: { ...prev[circuitTimer.weekDayKey], week: w, day: d, done: prev[circuitTimer.weekDayKey]?.done || false, skipped: prev[circuitTimer.weekDayKey]?.skipped || false, user_comment: prev[circuitTimer.weekDayKey]?.user_comment || "", logged_weights: updated } as Completion
          }));
          safeUpsertCompletion(w, d, { logged_weights: updated });
        }}
        onRated={(rating) => {
          // Store rating and adjust future difficulty
          const key = `circuit_rating_${circuitTimer.weekDayKey}`;
          const historyKey = "gymberget_circuit_ratings";
          try {
            const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
            history.push({ key, rating, workSeconds: circuitTimer.workSeconds, roundCount: circuitTimer.roundCount, ts: Date.now() });
            // Keep last 50
            if (history.length > 50) history.splice(0, history.length - 50);
            localStorage.setItem(historyKey, JSON.stringify(history));
          } catch {}
          if (rating >= 8) {
            toast("Nästa pass blir lättare — arbetstiden minskas 🔻", { duration: 4000 });
          } else if (rating <= 2) {
            toast("Bra jobbat! Nästa pass blir tuffare 🔺", { duration: 4000 });
          } else {
            toast(`Betyg ${rating}/10 sparat ✅`, { duration: 2000 });
          }
        }}
      />
    )}
    {/* Import workout dialog */}
    {importWorkoutTarget && (
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setImportWorkoutTarget(null)} />
        <div className="relative bg-card rounded-t-xl sm:rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-4 space-y-3 z-10">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Importera färdigt pass</h3>
            <button onClick={() => setImportWorkoutTarget(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          {/* User's own saved workouts */}
          {(() => {
            const myWorkouts = savedWorkouts.filter(sw => sw.user_id === userId);
            if (myWorkouts.length === 0) return null;
            return (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground">⭐ Mina sparade pass</p>
                {myWorkouts.map((sw) => (
                  <button
                    key={sw.id}
                    onClick={() => handleImportWorkout({ name: sw.name, details: sw.details, tempo: sw.tempo })}
                    className="w-full text-left bg-secondary/50 hover:bg-secondary rounded-lg px-3 py-2 transition-colors"
                  >
                    <p className="text-xs font-semibold text-foreground">{sw.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{sw.details.replace(/\n/g, " · ")}</p>
                  </button>
                ))}
              </div>
            );
          })()}
          {/* Public saved workouts from other users */}
          {(() => {
            const publicWorkouts = savedWorkouts.filter(sw => sw.visibility === "public" && sw.user_id !== userId);
            if (publicWorkouts.length === 0) return null;
            return (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground">👥 Skapat av användare</p>
                {publicWorkouts.map((sw) => (
                  <button
                    key={sw.id}
                    onClick={() => handleImportWorkout({ name: sw.name, details: sw.details, tempo: sw.tempo })}
                    className="w-full text-left bg-secondary/50 hover:bg-secondary rounded-lg px-3 py-2 transition-colors"
                  >
                    <p className="text-xs font-semibold text-foreground">{sw.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{sw.details.replace(/\n/g, " · ")}</p>
                  </button>
                ))}
              </div>
            );
          })()}
          {readyWorkoutCategories.map((cat, ci) => (
            <div key={ci} className="space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground">{cat.emoji} {cat.label}</p>
              {cat.workouts.map((w, wi) => {
                const isLocked = wi > 0 && !isHonorary && !isAdmin;
                return (
                <button
                  key={wi}
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    handleImportWorkout({ name: w.name, details: w.details, tempo: w.tempo });
                  }}
                  className={`w-full text-left bg-secondary/50 rounded-lg px-3 py-2 transition-colors flex items-center justify-between ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">{w.name}</p>
                    {isLocked ? <p className="text-[10px] text-warning">🔒 Exklusivt för hedersmedlemmar</p> : <p className="text-[10px] text-muted-foreground line-clamp-1">{w.details.replace(/\n/g, " · ")}</p>}
                  </div>
                  {isLocked && <Lock className="w-3.5 h-3.5 text-warning flex-shrink-0 ml-2" />}
                </button>
                );
              })}
            </div>
          ))}
          {!isHonorary && !isAdmin && (
            <div className="text-center pt-2 space-y-1">
              <p className="text-[10px] text-muted-foreground">🔒 Exklusivt för hedersmedlemmar</p>
              <p className="text-[10px] text-muted-foreground">Som vanlig medlem kan du välja 1 pass per kategori.</p>
            </div>
          )}
        </div>
      </div>
    )}
    {/* Pending import: ask Replace vs Append, then propagation */}
    {pendingImport && pendingImport.step === "conflict" && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setPendingImport(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Detta pass har redan övningar</h3>
          <p className="text-sm text-muted-foreground">
            Vill du <span className="font-semibold text-foreground">ersätta</span> de befintliga övningarna med "{pendingImport.workout.name}", eller <span className="font-semibold text-foreground">lägga till</span> övningarna efter de befintliga?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                const next = { ...pendingImport, mode: "replace" as const };
                if (pendingImport.target.week > 0) {
                  setPendingImport({ ...next, step: "propagate" });
                } else {
                  void executeImport(pendingImport.target, pendingImport.workout, "replace", false);
                }
              }}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Ersätt befintliga övningar
            </button>
            <button
              onClick={() => {
                const next = { ...pendingImport, mode: "append" as const };
                if (pendingImport.target.week > 0) {
                  setPendingImport({ ...next, step: "propagate" });
                } else {
                  void executeImport(pendingImport.target, pendingImport.workout, "append", false);
                }
              }}
              className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
            >
              Lägg till efter befintliga
            </button>
            <button
              onClick={() => setPendingImport(null)}
              className="w-full py-2 text-muted-foreground text-xs hover:text-foreground"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    )}
    {pendingImport && pendingImport.step === "propagate" && pendingImport.mode && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setPendingImport(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Tillämpa på alla {pendingImport.target.day}-pass?</h3>
          <p className="text-sm text-muted-foreground">
            Vill du tillämpa denna ändring på alla framtida {pendingImport.target.day}-pass i planen, eller bara på det aktuella passet?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => void executeImport(pendingImport.target, pendingImport.workout, pendingImport.mode!, true)}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              Alla framtida {pendingImport.target.day}-pass
            </button>
            <button
              onClick={() => void executeImport(pendingImport.target, pendingImport.workout, pendingImport.mode!, false)}
              className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
            >
              Bara denna vecka
            </button>
            <button
              onClick={() => setPendingImport(null)}
              className="w-full py-2 text-muted-foreground text-xs hover:text-foreground"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    )}
    {showWeightPrompt && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowWeightPrompt(false)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Ange din kroppsvikt</h3>
          <p className="text-sm text-muted-foreground">
            Din kroppsvikt behövs för att beräkna effektiv vikt på kroppsviktsövningar.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightPromptValue}
              onChange={(e) => setWeightPromptValue(e.target.value)}
              placeholder="kg"
              className="flex-1 bg-secondary text-foreground text-sm px-3 py-2.5 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              autoFocus
            />
            <span className="text-sm text-muted-foreground">kg</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowWeightPrompt(false)}
              className="flex-1 py-2.5 bg-secondary text-muted-foreground text-sm font-semibold rounded-lg"
            >
              Avbryt
            </button>
            <button
              onClick={async () => {
                const w = parseFloat(weightPromptValue);
                if (isNaN(w) || w <= 0) return;
                await supabase.from("profiles").update({ weight_kg: w }).eq("user_id", userId);
                setProfileWeight(w);
                setShowWeightPrompt(false);
                setWeightPromptValue("");
              }}
              disabled={!weightPromptValue || isNaN(parseFloat(weightPromptValue)) || parseFloat(weightPromptValue) <= 0}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg disabled:opacity-40"
            >
              Spara
            </button>
          </div>
        </div>
      </div>
    )}
    {uncheckedSetsDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setUncheckedSetsDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Obockade set</h3>
          <p className="text-sm text-muted-foreground">
            Du har {uncheckedSetsDialog.uncheckedCount} set som inte är avbockade. Vill du klarmarkera passet ändå?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setUncheckedSetsDialog(null)}
              className="flex-1 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity"
            >
              Avbryt
            </button>
            <button
              onClick={async () => {
                const { week, day } = uncheckedSetsDialog;
                setUncheckedSetsDialog(null);
                const dayPlans = plans.filter(p => p.week === week && p.day === day);
                const k = `${week}-${day}`;

                // Build accumulated logged_weights using fresh state via functional setState
                const accumulated: Record<string, any> = await new Promise((resolve) => {
                  setCompletions((prev) => {
                    const prevComp = prev[k] || ({} as any);
                    const acc: Record<string, any> = { ...((prevComp.logged_weights || {}) as Record<string, any>) };
                    for (const plan of dayPlans) {
                      if (!plan.details) continue;
                      const parts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                      for (const part of parts) {
                        if (part.startsWith("⚔️")) continue;
                        const isCondExercise = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|(?<![-\w])gång(?![-\w])|intervallträning|stair\s*machine|trappmaskin/i.test(part);
                        if (isCondExercise) continue;
                        if (/^(vila|vilodag)/i.test(part)) continue;
                        const { clean: cleanPart } = extractRpe(part);
                        const partStructMatch = cleanPart.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)(s)?(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
                        const fallbackSetsMatch = !partStructMatch ? cleanPart.match(/(\d+)\s*[×x]\s*\S+/) : null;
                        const nameMatch = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d)/);
                        const exerciseName = nameMatch ? nameMatch[1].trim() : null;
                        const pName = partStructMatch ? partStructMatch[1].trim().replace(/\s*—\s*$/, '') : exerciseName || cleanPart;
                        const sc = partStructMatch ? parseInt(partStructMatch[2]) : fallbackSetsMatch ? parseInt(fallbackSetsMatch[1]) : 1;
                        const allChecked = "1".repeat(sc);
                        acc[`__sets__${pName}`] = allChecked;
                        const setDataKey = `__setdata__${pName}`;
                        if (!acc[setDataKey]) {
                          const circuitSecMatch = plan.is_circuit ? plan.tempo?.match(/^circuit:(\d+)(?::\d+)?(?::\d+)?$/) : null;
                          const defReps = partStructMatch ? partStructMatch[3] : (circuitSecMatch ? circuitSecMatch[1] : "10");
                          const defKg = partStructMatch && partStructMatch[5] ? partStructMatch[5] : "";
                          const initData = Array.from({ length: sc }, () => ({ kg: defKg, reps: defReps }));
                          acc[setDataKey] = JSON.stringify(initData);
                        }
                      }
                    }
                    resolve(acc);
                    // Optimistically update state immediately so checkboxes re-render as checked
                    return {
                      ...prev,
                      [k]: { ...(prevComp as any), week, day, logged_weights: acc },
                    };
                  });
                });

                await safeUpsertCompletion(week, day, { logged_weights: accumulated });
                await performToggleDone(week, day);
              }}
              className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity"
            >
              Klarmarkera
            </button>
          </div>
        </div>
      </div>
    )}
    {deleteExerciseConfirm && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteExerciseConfirm(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Ta bort övning?</h3>
          <p className="text-sm text-muted-foreground">
            Är du säker på att du vill ta bort <span className="font-semibold text-foreground">{deleteExerciseConfirm.name}</span>?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteExerciseConfirm(null)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Avbryt
            </button>
            <button onClick={executeDeleteExercise} className="flex-1 py-2.5 bg-destructive text-destructive-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
              Ta bort
            </button>
          </div>
        </div>
      </div>
    )}
    {propagateDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setPropagateDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Tillämpa på framtida veckor?</h3>
          <p className="text-sm text-muted-foreground">
            Vill du tillämpa ändringen på alla <span className="font-semibold text-foreground">{propagateDialog.plan.day}</span>-pass i efterföljande veckor? Vikten ökas progressivt.
          </p>
          <div className="flex gap-2">
            <button onClick={() => handlePropagate(false)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Bara denna vecka
            </button>
            <button onClick={() => handlePropagate(true)} className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
              Alla framtida
            </button>
          </div>
        </div>
      </div>
    )}
    {replacePropagateDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setReplacePropagateDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Byt ut i hela schemat?</h3>
          <p className="text-sm text-muted-foreground">
            Vill du byta ut <span className="font-semibold text-foreground">{replacePropagateDialog.oldExerciseName}</span> i alla veckor?
          </p>
          <div className="flex gap-2">
            <button onClick={() => handleReplacePropagate(false)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Bara denna vecka
            </button>
            <button onClick={() => handleReplacePropagate(true)} className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
              Alla veckor
            </button>
          </div>
        </div>
      </div>
    )}
    {shareTarget && (
      <WorkoutShareCard
        sessionName={shareTarget.plan.session_name}
        day={shareTarget.plan.day}
        week={shareTarget.plan.week}
        details={shareTarget.plan.details}
        tempo={shareTarget.plan.tempo}
        loggedTempo={shareTarget.completion.logged_tempo}
        loggedPulse={shareTarget.completion.logged_pulse}
        loggedDistanceKm={shareTarget.completion.logged_distance_km}
        loggedWeights={shareTarget.completion.logged_weights}
        nickname={userNickname}
        onClose={() => setShareTarget(null)}
        onChatShare={async () => {
          const plan = shareTarget.plan;
          setShareTarget(null);
          const { data: friendships } = await supabase.from("friendships").select("user_id, friend_id").eq("status", "accepted").or(`user_id.eq.${userId},friend_id.eq.${userId}`);
          if (!friendships || friendships.length === 0) return;
          const fIds = friendships.map(f => f.user_id === userId ? f.friend_id : f.user_id);
          const { data: profiles } = await supabase.from("profiles").select("user_id, nickname").in("user_id", fIds);
          setChatFriends(profiles || []);
          setChatShareTarget(plan);
        }}
        onCopyToDate={() => {
          const plan = shareTarget.plan;
          // Gather ALL plans for the same week/day so custom exercises are included
          const allDayPlans = plans.filter(p => p.week === plan.week && p.day === plan.day);
          const combinedDetails = allDayPlans.map(p => p.details.trim()).filter(Boolean).join("\n");
          const combinedSource: PlanDay = {
            ...plan,
            details: combinedDetails || plan.details,
          };
          setShareTarget(null);
          setCopyToDateSource(combinedSource);
          setCopyToDateSelected(new Date());
          setCopyToDateConflict(null);
        }}
        onSaveWorkout={() => {
          const plan = shareTarget.plan;
          setSaveWorkoutSource({ details: plan.details, tempo: plan.tempo, defaultName: plan.session_name });
          setSaveWorkoutName(plan.session_name);
          setSaveWorkoutVisibility("private");
          setSaveWorkoutIsCircuit(!!(plan.is_circuit || (plan.tempo && plan.tempo.startsWith("circuit:"))));
          setShareTarget(null);
        }}
      />
    )}

    {/* Save workout dialog */}
    {saveWorkoutSource && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setSaveWorkoutSource(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Save className="w-4 h-4 text-primary" />
              Spara pass
            </h3>
            <button onClick={() => setSaveWorkoutSource(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Namn på passet</label>
              <input
                type="text"
                value={saveWorkoutName}
                onChange={(e) => setSaveWorkoutName(e.target.value)}
                placeholder="T.ex. Mitt favoritpass"
                className="w-full bg-secondary text-foreground text-sm px-3 py-2.5 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">Synlighet</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSaveWorkoutVisibility("private")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${saveWorkoutVisibility === "private" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  🔒 Bara jag
                </button>
                <button
                  onClick={() => setSaveWorkoutVisibility("public")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${saveWorkoutVisibility === "public" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  🌍 Alla användare
                </button>
              </div>
              {saveWorkoutVisibility === "public" && (
                <p className="text-[10px] text-muted-foreground mt-1">Passet visas under "Skapat av användare" för alla.</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveWorkoutIsCircuit}
                  onChange={(e) => setSaveWorkoutIsCircuit(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                <span className="text-xs text-foreground">Cirkelpass (visar Starta-knapp)</span>
              </label>
              <p className="text-[10px] text-muted-foreground mt-1 ml-6">Avmarkera om det är ett vanligt styrkepass.</p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!saveWorkoutName.trim()) return;
              setSaveWorkoutSaving(true);
              const tempoToSave = saveWorkoutIsCircuit
                ? (saveWorkoutSource.tempo && saveWorkoutSource.tempo.startsWith("circuit:") ? saveWorkoutSource.tempo : "circuit:40:3:0")
                : null;
              const { data, error } = await supabase.from("saved_workouts").insert({
                user_id: userId,
                name: saveWorkoutName.trim(),
                details: saveWorkoutSource.details,
                tempo: tempoToSave,
                visibility: saveWorkoutVisibility,
              } as any).select().single();
              setSaveWorkoutSaving(false);
              if (error) {
                toast.error("Kunde inte spara passet");
              } else {
                setSavedWorkouts(prev => [...prev, data as any]);
                toast.success(`"${saveWorkoutName.trim()}" sparat!`);
                setSaveWorkoutSource(null);
              }
            }}
            disabled={saveWorkoutSaving || !saveWorkoutName.trim()}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
          >
            {saveWorkoutSaving ? "Sparar..." : "Spara"}
          </button>
        </div>
      </div>
    )}

    {changeDayDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setChangeDayDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              Byt veckodag
            </h3>
            <button onClick={() => setChangeDayDialog(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{changeDayDialog.sessionName}</span> — nuvarande dag: <span className="font-mono font-semibold text-foreground">{getBaseDay(changeDayDialog.currentDay)}</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DAYS.map((d) => {
              const isCurrentDay = sameWorkoutDay(d, changeDayDialog.currentDay);
              const isOccupied = !isCurrentDay && plans.some(p => p.week === changeDayDialog.week && sameWorkoutDay(p.day, d));
              return (
                <button
                  key={d}
                  onClick={async () => {
                    if (!isCurrentDay) {
                      if (isOccupied) {
                        // Swap: move target to current day and current to target day
                        const targetPlan = plans.find(p => p.week === changeDayDialog.week && sameWorkoutDay(p.day, d));
                        if (targetPlan) {
                          const week = changeDayDialog.week;
                          const oldDay = changeDayDialog.currentDay;
                          const newDay = d;

                          // Get completions for both days
                          const compOld = completions[`${week}-${oldDay}`];
                          const compNew = completions[`${week}-${newDay}`];

                          // Strip challenge lines from both plans before swapping
                          const cleanDetailsCurrent = stripChallengeLines(
                            plans.find(p => p.id === changeDayDialog.planId)?.details || ""
                          );
                          const cleanDetailsTarget = stripChallengeLines(targetPlan.details || "");

                          // Swap plan days using a temp value to avoid unique constraint conflict
                          const tempDay = `__swap_${Date.now()}`;
                          await supabase.from("workout_plans").update({ day: tempDay, details: cleanDetailsCurrent }).eq("id", changeDayDialog.planId);
                          await supabase.from("workout_plans").update({ day: oldDay, details: cleanDetailsTarget }).eq("id", targetPlan.id);
                          await supabase.from("workout_plans").update({ day: newDay }).eq("id", changeDayDialog.planId);

                          // Delete both completions first, then re-insert swapped
                          await supabase.from("workout_completions").delete()
                            .eq("user_id", userId).eq("week", week).in("day", [oldDay, newDay]);

                          const upserts: any[] = [];
                          if (compOld) {
                            upserts.push({
                              user_id: userId, week, day: newDay, done: compOld.done, skipped: compOld.skipped,
                              user_comment: compOld.user_comment || "",
                              logged_tempo: compOld.logged_tempo, logged_pulse: compOld.logged_pulse,
                              logged_distance_km: compOld.logged_distance_km, logged_weights: compOld.logged_weights as any,
                            });
                          }
                          if (compNew) {
                            upserts.push({
                              user_id: userId, week, day: oldDay, done: compNew.done, skipped: compNew.skipped,
                              user_comment: compNew.user_comment || "",
                              logged_tempo: compNew.logged_tempo, logged_pulse: compNew.logged_pulse,
                              logged_distance_km: compNew.logged_distance_km, logged_weights: compNew.logged_weights as any,
                            });
                          }
                          if (upserts.length > 0) {
                            await supabase.from("workout_completions").upsert(upserts, { onConflict: "user_id,week,day" });
                          }

                          setChangeDayDialog(null);
                          fetchData();
                        }
                      } else {
                        changeWorkoutDay(changeDayDialog.planId, d, changeDayDialog.week);
                      }
                    }
                  }}
                  disabled={isCurrentDay}
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentDay 
                      ? "bg-primary text-primary-foreground" 
                      : isOccupied 
                        ? "bg-secondary text-muted-foreground cursor-pointer border border-border hover:border-primary"
                        : "bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground"
                  }`}
                  title={isOccupied ? `Byt plats med ${plans.find(p => p.week === changeDayDialog.week && sameWorkoutDay(p.day, d))?.session_name}` : undefined}
                >
                  {d}
                  {isOccupied && <span className="block text-[8px] text-muted-foreground/70 mt-0.5">upptagen</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Tryck på en upptagen dag för att byta plats mellan passen.</p>
        </div>
      </div>
    )}

    {/* Session settings dialog */}
    {renameDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setRenameDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Passinställningar
            </h3>
            <button onClick={() => setRenameDialog(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Rename section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Byt namn</label>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && renameSession(renameDialog.planId, renameInput)}
              placeholder="Nytt namn..."
              className="w-full bg-secondary text-foreground text-sm p-2.5 border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              autoFocus
            />
            <button
              onClick={() => renameSession(renameDialog.planId, renameInput)}
              disabled={!renameInput.trim() || renameInput.trim() === renameDialog.currentName}
              className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Spara namn
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {renameDialog.week > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Aktuell träningsdag</label>
              <button
                onClick={setWorkoutAsCurrentDay}
                disabled={settingCurrentDay}
                className="w-full py-2.5 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <CalendarIcon className="w-4 h-4" />
                {settingCurrentDay ? "Uppdaterar..." : "Gör detta pass till dagens pass"}
              </button>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Justerar schemats startdatum så att vecka {renameDialog.week}, {getBaseDay(renameDialog.day)} matchar idag.
              </p>
            </div>
          )}

          <div className="border-t border-border" />

          {/* Skip/miss section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Markera pass</label>
            <button
              onClick={() => {
                if (renameDialog.week === 0) {
                  const { week, day } = renameDialog;
                  setRenameDialog(null);
                  void toggleSkipped(week, day);
                  return;
                }
                setReplacementTarget({
                  planId: renameDialog.planId,
                  sessionName: renameDialog.sessionName,
                  week: renameDialog.week,
                  day: renameDialog.day
                });
                setRenameDialog(null);
              }}
              className="w-full py-2.5 bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              {renameDialog.week === 0 ? "Markera som missat" : "Markera som missat"}
            </button>
          </div>

          <button
            onClick={() => setRenameDialog(null)}
            className="w-full py-2.5 bg-secondary text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    )}

    {/* Share to chat dialog */}
    {chatShareTarget && chatFriends.length > 0 && (
      <>
        <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setChatShareTarget(null)} />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[90] max-w-sm mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Dela pass via chatt
              </h3>
              <button onClick={() => setChatShareTarget(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {chatShareTarget.session_name} – {chatShareTarget.details.split(/[;\n]/).filter(Boolean).length} övningar
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {chatFriends.map(friend => (
              <button
                key={friend.user_id}
                disabled={chatShareSending}
                onClick={async () => {
                  setChatShareSending(true);
                  await supabase.from("chat_messages").insert({
                    sender_id: userId,
                    receiver_id: friend.user_id,
                    message: `Delade passet "${chatShareTarget.session_name}"`,
                    message_type: "workout",
                    shared_workout: {
                      session_name: chatShareTarget.session_name,
                      details: chatShareTarget.details,
                      tempo: chatShareTarget.tempo,
                      week: chatShareTarget.week,
                    },
                  });
                  setChatShareSending(false);
                  setChatShareTarget(null);
                  triggerSave();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{friend.nickname.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium">{friend.nickname}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    )}

    {/* Copy to date dialog */}
    {copyToDateSource && (
      <>
        <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setCopyToDateSource(null)} />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[90] max-w-sm mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Kopiera till datum
              </h3>
              <button onClick={() => setCopyToDateSource(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {copyToDateSource.session_name}
            </p>
          </div>

          {copyToDateConflict === "ask" ? (
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Det finns redan övningar på <span className="font-semibold text-foreground">{format(copyToDateSelected, "d MMMM yyyy", { locale: sv })}</span>. Vad vill du göra?
              </p>
              <button
                onClick={async () => {
                  setCopyToDateConflict("replace");
                  await executeCopyToDate("replace");
                }}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                Ersätt befintliga övningar
              </button>
              <button
                onClick={async () => {
                  setCopyToDateConflict("add");
                  await executeCopyToDate("add");
                }}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                Lägg till efter befintliga
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={copyToDateSelected}
                  onSelect={(d) => d && setCopyToDateSelected(d)}
                  locale={sv}
                  className="p-3 pointer-events-auto bg-card border border-border rounded-lg"
                />
              </div>
              <div className="bg-secondary/50 border border-border rounded-lg p-2.5 text-center">
                <p className="text-xs font-medium">
                  Kopiera till: <span className="text-primary">{format(copyToDateSelected, "EEEE d MMMM yyyy", { locale: sv })}</span>
                </p>
              </div>
              <button
                onClick={handleCopyToDateConfirm}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-50"
              >
                {copyToDateSaving ? "Kopierar..." : "Kopiera"}
              </button>
            </div>
          )}
        </div>
      </>
    )}
    {/* Add week dialog */}
    {showAddWeekDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddWeekDialog(false)}>
        <div className="bg-card rounded-xl border border-border p-5 w-[90%] max-w-sm space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Lägg till vecka</h3>
            <button onClick={() => setShowAddWeekDialog(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Välj vilken vecka du vill kopiera till den nya veckan:</p>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {weeks.filter(w => w > 0).map(w => (
              <button
                key={w}
                onClick={() => setAddWeekSourceWeek(w)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  addWeekSourceWeek === w
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                V{w}
              </button>
            ))}
          </div>
          {addWeekSourceWeek && (
            <p className="text-xs text-muted-foreground text-center">
              Kopierar {plans.filter(p => p.week === addWeekSourceWeek).length} pass från vecka {addWeekSourceWeek}
            </p>
          )}
          <button
            onClick={() => addWeekSourceWeek && addWeekByCopy(addWeekSourceWeek)}
            disabled={!addWeekSourceWeek || addWeekSaving}
            className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-50"
          >
            {addWeekSaving ? "Skapar..." : `Skapa vecka ${(weeks.filter(w => w > 0).length > 0 ? Math.max(...weeks.filter(w => w > 0)) + 1 : 1)}`}
          </button>
        </div>
      </div>
    )}
    {achievementToast && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4" onClick={() => setAchievementToast(null)}>
        <div className="w-full max-w-sm border border-border bg-card p-5 text-center animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="text-5xl mb-3">{achievementToast.achievements[0].emoji}</div>
          <p className="text-xs font-black text-warning uppercase">Achievement upplåst</p>
          <h3 className="text-xl font-black mt-1">{achievementToast.achievements[0].title}</h3>
          <p className="text-sm text-muted-foreground mt-2">{achievementToast.achievements[0].description}</p>
          {achievementToast.achievements.length > 1 && (
            <p className="text-xs text-muted-foreground mt-2">+{achievementToast.achievements.length - 1} till upplåsta</p>
          )}
          <button onClick={() => setAchievementToast(null)} className="mt-4 w-full bg-primary text-primary-foreground py-2.5 text-sm font-bold">
            Grymt
          </button>
        </div>
      </div>
    )}
    </>);

};

export default WorkoutView;