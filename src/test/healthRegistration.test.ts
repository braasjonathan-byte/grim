import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>, writes: [] as string[], failCompletion: false, failDelete: false,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let operation = "select", payload: any, filters: ((r: any) => boolean)[] = [], single = false;
  const q: any = {
    select: () => q,
    eq: (k: string, v: any) => { filters.push(r => r[k] === v); return q; },
    gt: (k: string, v: number) => { filters.push(r => r[k] > v); return q; },
    like: (k: string, v: string) => { const re = new RegExp("^" + v.replace(/\\_/g, "_").replace(/%/g, ".*") + "$"); filters.push(r => re.test(r[k])); return q; },
    in: (k: string, vs: any[]) => { filters.push(r => vs.includes(r[k])); return q; },
    order: () => q, limit: () => q,
    maybeSingle: () => { single = true; return q; },
    insert: (p: any) => { operation = "insert"; payload = p; return q; },
    upsert: (p: any) => { operation = "upsert"; payload = p; return q; },
    update: (p: any) => { operation = "update"; payload = p; return q; },
    delete: () => { operation = "delete"; return q; },
    then: (resolve: any, reject: any) => Promise.resolve().then(() => {
      const rows = db.rows[table] ?? [];
      const matches = rows.filter(r => filters.every(f => f(r)));
      if (operation === "select") return { data: single ? matches[0] ?? null : matches, error: null };
      db.writes.push(`${table}:${operation}`);
      if ((table === "workout_completions" && db.failCompletion) || (operation === "delete" && db.failDelete)) {
        db.failCompletion = false; db.failDelete = false;
        return { data: null, error: { message: "network failure" } };
      }
      if (operation === "delete") db.rows[table] = rows.filter(r => !matches.includes(r));
      else if (operation === "update") matches.forEach(r => Object.assign(r, payload));
      else {
        const old = operation === "upsert" && rows.find(r => r.user_id === payload.user_id && r.week === payload.week && r.day === payload.day);
        if (old) Object.assign(old, payload); else rows.push({ id: `id-${rows.length}`, ...payload });
        db.rows[table] = rows;
      }
      return { data: operation === "update" ? matches : null, error: null };
    }).then(resolve, reject),
  };
  return q;
} } }));
vi.mock("@/lib/healthSync", () => ({ healthLog: vi.fn(), withTimeout: (p: any) => p }));
vi.mock("@/lib/workoutHistory", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/workoutHistory")>(), notifyWorkoutsChanged: vi.fn(),
}));
vi.mock("@/lib/workoutAutoShare", () => ({ previewWorkoutCaption: async () => "Updated existing workout" }));

import { findImportedHealthWorkouts, healthWorkoutDayKey, importHealthWorkouts } from "@/lib/healthWorkoutImport";
import { getCardioCategory } from "@/lib/cardioVisibility";
import { isCompletedWorkout } from "@/lib/completionCounting";
const workout = { key: "abc123", start: "2026-11-08T10:00:00+01:00", end: "2026-11-08T11:00:00+01:00", label: "Löpning", type: "running", source: "Samsung", minutes: 60, distanceKm: 10, avgHeartRate: 140, calories: null, steps: null, maxHeartRate: null };
const plan = (day: string, id: string, week = 5) => ({ id, user_id: "u", week, day, details: "Knäböj — 3x5", session_name: "Styrka" });

beforeEach(() => {
  db.rows = { profiles: [{ user_id: "u", plan_start_date: "2026-10-05" }], workout_plans: [plan("Sön", "planned"), plan("Lör", "other-date")], workout_completions: [] };
  db.writes = []; db.failCompletion = false; db.failDelete = false;
});

describe("HC registration replacement and retry", () => {
  it.each(["plan", "completion", "both", "exercise"])("allows reimport after removal of %s", async removal => {
    await importHealthWorkouts("u", [workout]);
    expect((await findImportedHealthWorkouts("u", [workout])).size).toBe(1);
    if (removal === "plan" || removal === "both") db.rows.workout_plans = db.rows.workout_plans.filter(r => !r.day.endsWith("_hcabc123"));
    if (removal === "completion" || removal === "both") db.rows.workout_completions = [];
    if (removal === "exercise") db.rows.workout_plans.find(r => r.day.endsWith("_hcabc123")).details = "";
    expect((await findImportedHealthWorkouts("u", [workout])).size).toBe(0);
    expect((await importHealthWorkouts("u", [workout])).imported).toBe(1);
    expect(db.rows.workout_plans.filter(r => r.day.endsWith("_hcabc123"))).toHaveLength(1);
    expect(db.rows.workout_completions.filter(r => r.day.endsWith("_hcabc123"))).toHaveLength(1);
  });
  it("does not duplicate an import that still exists", async () => {
    await importHealthWorkouts("u", [workout]);
    const result = await importHealthWorkouts("u", [workout]);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(db.rows.workout_completions.filter(r => r.day.endsWith("_hcabc123"))).toHaveLength(1);
  });
  it("fills previously missing Tacx distance on fetch without duplicating or resetting the workout", async () => {
    const cycling = { ...workout, label: "Cykling", type: "cycling", source: "Tacx", distanceKm: null };
    await importHealthWorkouts("u", [cycling]);
    const saved = db.rows.workout_completions.find(r => r.day.endsWith("_hcabc123"));
    saved.user_comment = "Keep my notes";
    const timestamp = saved.updated_at;
    const weights = JSON.stringify(saved.logged_weights);
    const postsBefore = (db.rows.social_posts ?? []).length;
    await findImportedHealthWorkouts("u", [{ ...cycling, distanceKm: 32.5 }]);
    expect(saved.logged_distance_km).toBe(32.5);
    expect(JSON.parse(saved.logged_weights.__cond__Cykling).dist).toBe("32.5");
    expect(saved.updated_at).toBe(timestamp);
    expect(saved.user_comment).toBe("Keep my notes");
    expect(db.rows.workout_completions.filter(r => r.day.endsWith("_hcabc123"))).toHaveLength(1);
    expect((db.rows.social_posts ?? []).length).toBe(postsBefore);
    expect(JSON.stringify(saved.logged_weights)).not.toBe(weights);
  });
  it("stores a Health Connect route with the cardio row so the imported pass shows its map", async () => {
    const route: [number, number][] = [[59.3293, 18.0686], [59.3326, 18.0649]];
    await importHealthWorkouts("u", [{ ...workout, key: "routed1", route }]);
    const completion = db.rows.workout_completions.find((c) => String(c.day).endsWith("_hcrouted1"));
    const cond = JSON.parse(completion.logged_weights["__cond__Löpning"]);
    expect(cond.route).toEqual(route);
    expect(cond.routeSource).toBe("health_connect");
    const { importedRoute } = await import("@/lib/importedRoute");
    expect(importedRoute(cond)).toEqual(route);
  });

  it("registers a Tacx cycling import as completed cycling with its real distance", async () => {
    const imported = { ...workout, type: "cycling", label: "Cykling", source: "Tacx", distanceKm: 32.5 };
    const result = await importHealthWorkouts("u", [imported]);
    expect(result.imported).toBe(1);
    const savedPlan = db.rows.workout_plans.find(r => r.day.endsWith("_hcabc123"));
    const savedCompletion = db.rows.workout_completions.find(r => r.day.endsWith("_hcabc123"));
    expect(getCardioCategory(savedPlan.details)).toBe("cykling");
    expect(isCompletedWorkout(savedCompletion)).toBe(true);
    expect(savedCompletion.logged_distance_km).toBe(32.5);
  });
  it("saves the completed HC workout before removing only unfinished workouts on the same date", async () => {
    db.rows.workout_plans.push(plan("Sön_extra1", "same-date"), plan("Sön_extra2", "completed"), plan("Sön_hcold", "other-hc"));
    db.rows.workout_completions.push({ user_id: "u", week: 5, day: "Sön_extra2", done: true });
    const result = await importHealthWorkouts("u", [workout]);
    expect(result.imported).toBe(1);
    expect(db.rows.workout_plans.map(r => r.id)).not.toContain("planned");
    expect(db.rows.workout_plans.map(r => r.id)).not.toContain("same-date");
    expect(db.rows.workout_plans.map(r => r.id)).toEqual(expect.arrayContaining(["completed", "other-date", "other-hc"]));
    expect(db.writes.indexOf("workout_plans:delete")).toBeGreaterThan(db.writes.indexOf("workout_completions:upsert"));
    expect(result.successfulKeys).toEqual([healthWorkoutDayKey(workout)]);
  });
  it("keeps the planned workout after a completion failure and retries a half-written import", async () => {
    db.failCompletion = true;
    const first = await importHealthWorkouts("u", [workout]);
    expect(first.failed).toBe(1);
    expect(first.successfulKeys).toEqual([]);
    expect(db.rows.workout_plans.some(r => r.id === "planned")).toBe(true);
    expect(await findImportedHealthWorkouts("u", [workout])).toEqual(new Set());
    const retry = await importHealthWorkouts("u", [workout]);
    expect(retry.imported).toBe(1);
    expect(db.rows.workout_plans.filter(r => r.day.endsWith("_hcabc123"))).toHaveLength(1);
    expect(db.rows.workout_plans.some(r => r.id === "planned")).toBe(false);
  });
  it("reuses a half-written HC identity if program context changes before retry", async () => {
    db.rows.profiles = [];
    db.failCompletion = true;
    await importHealthWorkouts("u", [workout]);
    db.rows.profiles = [{ user_id: "u", plan_start_date: "2026-10-05" }];
    const retry = await importHealthWorkouts("u", [workout]);
    expect(retry.imported).toBe(1);
    expect(db.rows.workout_plans.filter(r => r.day.endsWith("_hcabc123"))).toHaveLength(1);
  });
  it("retries replacement after cleanup fails, even when the HC completion is already saved", async () => {
    db.failDelete = true;
    const first = await importHealthWorkouts("u", [workout]);
    expect(first.failed).toBe(1);
    expect(first.successfulKeys).toEqual([]);
    expect(db.rows.workout_plans.some(r => r.id === "planned")).toBe(true);
    expect(await findImportedHealthWorkouts("u", [workout])).toEqual(new Set());
    const retry = await importHealthWorkouts("u", [workout]);
    expect(retry.successfulKeys).toEqual([healthWorkoutDayKey(workout)]);
    expect(db.rows.workout_plans.some(r => r.id === "planned")).toBe(false);
  });
  it("replaces standalone planned workouts by local date without touching completed or other dates", async () => {
    db.rows.profiles = [];
    db.rows.workout_plans = [plan("2026-11-08", "planned", 0), plan("2026-11-08_done", "completed", 0), plan("2026-11-07", "other", 0)];
    db.rows.workout_completions = [{ user_id: "u", week: 0, day: "2026-11-08_done", done: true }];
    await importHealthWorkouts("u", [workout]);
    expect(db.rows.workout_plans.map(r => r.id)).not.toContain("planned");
    expect(db.rows.workout_plans.map(r => r.id)).toEqual(expect.arrayContaining(["completed", "other"]));
  });
});
