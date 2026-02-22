import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SNAPSHOT_KEY = "grim_data_snapshots";
const MAX_SNAPSHOTS = 7;

export interface DataSnapshot {
  id: string;
  timestamp: string;
  label: string;
  data: {
    workout_plans: any[];
    workout_completions: any[];
    profile: any;
    pr_stars: any[];
    pr_goals: any[];
    custom_exercises: any[];
  };
}

function getSnapshots(): DataSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: DataSnapshot[]) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // localStorage full – remove oldest and retry
    const trimmed = snapshots.slice(-MAX_SNAPSHOTS + 1);
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(trimmed)); } catch { /* give up */ }
  }
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

async function fetchAllUserData(userId: string) {
  const [plans, completions, profile, stars, goals, exercises] = await Promise.all([
    supabase.from("workout_plans").select("*").eq("user_id", userId),
    supabase.from("workout_completions").select("*").eq("user_id", userId),
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    supabase.from("pr_stars").select("*").eq("user_id", userId),
    supabase.from("pr_goals").select("*").eq("user_id", userId),
    supabase.from("custom_exercises").select("*").eq("created_by", userId),
  ]);

  return {
    workout_plans: plans.data || [],
    workout_completions: completions.data || [],
    profile: profile.data || null,
    pr_stars: stars.data || [],
    pr_goals: goals.data || [],
    custom_exercises: exercises.data || [],
  };
}

export function getSnapshotSummaries(): { id: string; timestamp: string; label: string }[] {
  return getSnapshots().map(s => ({ id: s.id, timestamp: s.timestamp, label: s.label }));
}

export function getSnapshotById(id: string): DataSnapshot | undefined {
  return getSnapshots().find(s => s.id === id);
}

export function useDataSnapshots(userId: string | null) {
  const takeSnapshot = useCallback(async () => {
    if (!userId) return;

    const existing = getSnapshots();
    const today = todayKey();

    // Only one snapshot per day
    if (existing.some(s => s.id === today)) return;

    const data = await fetchAllUserData(userId);
    const now = new Date();
    const snapshot: DataSnapshot = {
      id: today,
      timestamp: now.toISOString(),
      label: now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" }),
      data,
    };

    const updated = [...existing, snapshot].slice(-MAX_SNAPSHOTS);
    saveSnapshots(updated);
    console.log("[Grim] Daily snapshot saved:", today);
  }, [userId]);

  // Take snapshot on mount (once per day)
  useEffect(() => {
    if (!userId) return;
    takeSnapshot();
  }, [userId, takeSnapshot]);

  return { takeSnapshot, getSnapshots, getSnapshotById };
}
