/**
 * Lokalt UI-state för WorkoutViews dialoger, utbrutet ur WorkoutView.tsx (ren flytt – samma
 * initialvärden och setters, inget beteendebyte).
 */
import { useState } from "react";
import type { CardioMode } from "@/lib/cardioUnits";

export function useExerciseFormState() {
  const [weightDialog, setWeightDialog] = useState<{planId: string;exerciseName: string;lastWeight: string | null;} | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("10");
  const [repsUnit, setRepsUnit] = useState<"reps" | "sek">("reps");
  const [setsInput, setSetsInput] = useState("3");
  const [showAddCustomExercise, setShowAddCustomExercise] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExCategory, setNewExCategory] = useState("styrka");
  const [newExMuscle, setNewExMuscle] = useState("Helkropp");
  return { weightDialog, setWeightDialog, weightInput, setWeightInput, repsInput, setRepsInput, repsUnit, setRepsUnit, setsInput, setSetsInput, showAddCustomExercise, setShowAddCustomExercise, newExName, setNewExName, newExCategory, setNewExCategory, newExMuscle, setNewExMuscle };
}

export function useConditioningDialogState() {
  const [conditioningDialog, setConditioningDialog] = useState<{planId: string;exerciseName: string;} | null>(null);
  const [condTempoInput, setCondTempoInput] = useState("");
  const [condTimeHours, setCondTimeHours] = useState("");
  const [condTimeMinutes, setCondTimeMinutes] = useState("");
  const [condTimeSeconds, setCondTimeSeconds] = useState("");
  const [condDistanceInput, setCondDistanceInput] = useState("");
  const [condAutoField, setCondAutoField] = useState<"time" | "tempo" | "distance" | null>(null);
  const [condMode, setCondMode] = useState<CardioMode>("minkm");
  const [condEditName, setCondEditName] = useState("");
  return { conditioningDialog, setConditioningDialog, condTempoInput, setCondTempoInput, condTimeHours, setCondTimeHours, condTimeMinutes, setCondTimeMinutes, condTimeSeconds, setCondTimeSeconds, condDistanceInput, setCondDistanceInput, condAutoField, setCondAutoField, condMode, setCondMode, condEditName, setCondEditName };
}

