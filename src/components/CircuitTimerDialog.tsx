import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, X, RotateCcw } from "lucide-react";
import { playExerciseSwitch, playCountdownBeep, playGoBeep } from "@/lib/sounds";

interface CircuitTimerDialogProps {
  exercises: string[];
  workSeconds: number;
  /** Per-exercise per-round seconds override. exerciseSeconds[exerciseIdx][roundIdx] */
  exerciseSeconds?: number[][];
  roundCount: number;
  restSeconds?: number;
  onClose: () => void;
  onRoundComplete?: (roundIndex: number) => void;
  onRated?: (rating: number) => void;
}

type Phase = "ready" | "countdown" | "work" | "transition" | "rest" | "done";

const CircuitTimerDialog = ({
  exercises,
  workSeconds,
  exerciseSeconds,
  roundCount,
  restSeconds = 0,
  onClose,
  onRoundComplete,
  onRated,
}: CircuitTimerDialogProps) => {

  const getExerciseSec = (exIdx: number, roundIdx?: number) => {
    const r = roundIdx ?? 0;
    if (exerciseSeconds?.[exIdx]) {
      return exerciseSeconds[exIdx][r] ?? exerciseSeconds[exIdx][0] ?? workSeconds;
    }
    return workSeconds;
  };
  const [phase, setPhase] = useState<Phase>("ready");
  const [currentRound, setCurrentRound] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(getExerciseSec(0));
  const [countdownValue, setCountdownValue] = useState(3);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Countdown phase
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdownValue(3);
    playCountdownBeep();
    intervalRef.current = window.setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          clearTimer();
          playGoBeep();
          setPhase("work");
           setSecondsLeft(getExerciseSec(currentExerciseIndex, currentRound));
          return 0;
        }
        playCountdownBeep();
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, clearTimer, workSeconds, exerciseSeconds, currentExerciseIndex]);

  // Work phase
  useEffect(() => {
    if (phase !== "work" || paused) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          const nextExIdx = currentExerciseIndex + 1;
          if (nextExIdx < exercises.length) {
            // Transition to next exercise
            playExerciseSwitch();
            setCurrentExerciseIndex(nextExIdx);
            setPhase("transition");
            return 3;
          } else {
            onRoundComplete?.(currentRound);
            const nextRound = currentRound + 1;
            if (nextRound < roundCount) {
              if (restSeconds > 0) {
                playExerciseSwitch();
                setPhase("rest");
                return restSeconds;
              }
              playExerciseSwitch();
              setCurrentRound(nextRound);
              setCurrentExerciseIndex(0);
              setPhase("transition");
              return 3;
            } else {
              playExerciseSwitch();
              setPhase("done");
              return 0;
            }
          }
        }
        if (prev <= 4 && prev > 1) {
          playCountdownBeep();
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, paused, currentExerciseIndex, currentRound, exercises.length, roundCount, workSeconds, exerciseSeconds, restSeconds, clearTimer, onRoundComplete]);

  // Transition phase (3s between exercises)
  useEffect(() => {
    if (phase !== "transition" || paused) return;
    playCountdownBeep();
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          playGoBeep();
          setPhase("work");
          return getExerciseSec(currentExerciseIndex, currentRound);
        }
        playCountdownBeep();
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, paused, currentExerciseIndex, currentRound, clearTimer]);

  // Rest phase
  useEffect(() => {
    if (phase !== "rest" || paused) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          playGoBeep();
          const nextRound = currentRound + 1;
          setCurrentRound(nextRound);
          setCurrentExerciseIndex(0);
          setPhase("work");
          return getExerciseSec(0, nextRound);
        }
        if (prev <= 4 && prev > 1) {
          playCountdownBeep();
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, paused, currentRound, clearTimer, restSeconds]);

  const startWorkout = () => {
    setPhase("countdown");
  };

  const togglePause = () => {
    setPaused((p) => !p);
  };

  const restart = () => {
    clearTimer();
    setPhase("ready");
    setCurrentRound(0);
    setCurrentExerciseIndex(0);
    setSecondsLeft(getExerciseSec(0, 0));
    setPaused(false);
  };

  const totalExercises = exercises.length;
  const totalTime = (() => {
    let t = 0;
    for (let r = 0; r < roundCount; r++) {
      for (let e = 0; e < totalExercises; e++) {
        t += getExerciseSec(e, r);
      }
    }
    return t;
  })();
  const elapsedExercises = currentRound * totalExercises + currentExerciseIndex;
  const elapsed = (() => {
    let t = 0;
    for (let r = 0; r < currentRound; r++) {
      for (let e = 0; e < totalExercises; e++) t += getExerciseSec(e, r);
    }
    for (let e = 0; e < currentExerciseIndex; e++) t += getExerciseSec(e, currentRound);
    t += getExerciseSec(currentExerciseIndex, currentRound) - secondsLeft;
    return t;
  })();
  const progressPct = totalTime > 0 ? Math.round((elapsed / totalTime) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-sm flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold text-foreground">
          Runda {currentRound + 1} / {roundCount}
        </span>
        <button onClick={restart} className="p-2 text-muted-foreground hover:text-foreground">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-1000"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {phase === "ready" && (
          <>
            <div className="text-center space-y-3">
              <p className="text-lg font-bold text-foreground">Redo att köra?</p>
              <p className="text-sm text-muted-foreground">
                {roundCount} rundor × {totalExercises} övningar × {workSeconds}s
                {restSeconds > 0 && ` • ${restSeconds}s vila`}
              </p>
              <div className="space-y-1 max-w-xs mx-auto">
                {exercises.map((ex, i) => (
                  <p key={i} className="text-xs text-foreground flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    {ex}
                  </p>
                ))}
              </div>
            </div>
            <button
              onClick={startWorkout}
              className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
            >
              <Play className="w-8 h-8 ml-1" />
            </button>
          </>
        )}

        {phase === "countdown" && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">Gör dig redo!</p>
            <span className="text-8xl font-black font-mono text-primary animate-pulse">
              {countdownValue}
            </span>
          </div>
        )}

        {phase === "work" && (
          <>
            {/* Current exercise name - large */}
            <div className="text-center px-4">
              <p className="text-3xl font-black text-foreground leading-tight">
                {exercises[currentExerciseIndex]}
              </p>
              {currentExerciseIndex < exercises.length - 1 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Nästa: {exercises[currentExerciseIndex + 1]}
                </p>
              )}
              {currentExerciseIndex === exercises.length - 1 && currentRound < roundCount - 1 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Nästa runda: {exercises[0]}
                </p>
              )}
              {currentExerciseIndex === exercises.length - 1 && currentRound === roundCount - 1 && (
                <p className="text-sm text-success mt-2 font-semibold">
                  Sista övningen!
                </p>
              )}
            </div>

            {/* Timer */}
            <div className="text-center">
              <span className="text-7xl font-black font-mono text-foreground tracking-wider">
                {secondsLeft}
              </span>
              <p className="text-xs text-muted-foreground mt-1">sekunder kvar</p>
            </div>

            {/* Exercise progress dots */}
            <div className="flex items-center gap-2 justify-center flex-wrap">
              {exercises.map((_, i) => {
                const isActive = i === currentExerciseIndex;
                const isDone = i < currentExerciseIndex;
                return (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-all ${
                      isActive
                        ? "bg-primary scale-125"
                        : isDone
                        ? "bg-primary/40"
                        : "bg-secondary"
                    }`}
                  />
                );
              })}
            </div>

            {/* Pause button */}
            <button
              onClick={togglePause}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                paused
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {paused ? <Play className="w-6 h-6 ml-0.5" /> : <Pause className="w-6 h-6" />}
            </button>
            {paused && (
              <p className="text-xs text-warning font-semibold">PAUSAD</p>
            )}
          </>
        )}

        {phase === "transition" && (
          <>
            <div className="text-center px-4">
              <p className="text-sm text-muted-foreground mb-2">Nästa övning</p>
              <p className="text-3xl font-black text-primary leading-tight">
                {exercises[currentExerciseIndex]}
              </p>
            </div>
            <div className="text-center">
              <span className="text-8xl font-black font-mono text-primary animate-pulse">
                {secondsLeft}
              </span>
              <p className="text-xs text-muted-foreground mt-1">Gör dig redo!</p>
            </div>
            <button onClick={togglePause} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${paused ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {paused ? <Play className="w-6 h-6 ml-0.5" /> : <Pause className="w-6 h-6" />}
            </button>
            {paused && <p className="text-xs text-warning font-semibold">PAUSAD</p>}
          </>
        )}

        {phase === "rest" && (
          <>
            <div className="text-center px-4">
              <p className="text-3xl font-black text-warning leading-tight">VILA</p>
              <p className="text-sm text-muted-foreground mt-2">Nästa runda: {currentRound + 2} / {roundCount}</p>
            </div>
            <div className="text-center">
              <span className="text-7xl font-black font-mono text-warning tracking-wider">{secondsLeft}</span>
              <p className="text-xs text-muted-foreground mt-1">sekunder vila</p>
            </div>
            <button onClick={togglePause} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${paused ? "bg-warning text-warning-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {paused ? <Play className="w-6 h-6 ml-0.5" /> : <Pause className="w-6 h-6" />}
            </button>
            {paused && <p className="text-xs text-warning font-semibold">PAUSAD</p>}
          </>
        )}

        {phase === "done" && (
          <div className="text-center space-y-5 w-full max-w-sm">
            <p className="text-4xl">🎉</p>
            <p className="text-lg font-bold text-foreground">Passet klart!</p>
            <p className="text-sm text-muted-foreground">
              {roundCount} rundor × {totalExercises} övningar avklarat
            </p>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Hur svårt var det?</p>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      onRated?.(n);
                      onClose();
                    }}
                    className={`w-9 h-9 rounded-lg text-sm font-bold transition-all active:scale-90 ${
                      n <= 3
                        ? "bg-success/20 text-success hover:bg-success/30"
                        : n <= 6
                        ? "bg-warning/20 text-warning hover:bg-warning/30"
                        : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">1 = Lätt &nbsp;·&nbsp; 10 = Extremt svårt</p>
            </div>
            <button
              onClick={onClose}
              className="text-xs text-muted-foreground underline"
            >
              Hoppa över
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CircuitTimerDialog;
