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
      return { data: null, error: null };
    }).then(resolve, reject),
  };
  return q;
} } }));
vi.mock("@/lib/healthSync", () => ({ healthLog: vi.fn(), withTimeout: (p: any) => p }));
vi.mock("@/lib/workoutHistory", () => ({ notifyWorkoutsChanged: vi.fn() }));

import { findImportedHealthWorkouts, healthWorkoutDayKey, importHealthWorkouts } from "@/lib/healthWorkoutImport";
const workout = { key: "abc123", start: "2026-11-08T10:00:00+01:00", end: "2026-11-08T11:00:00+01:00", label: "Löpning", type: "running", source: "Samsung", minutes: 60, distanceKm: 10, avgHeartRate: 140, calories: null, steps: null, maxHeartRate: null };
const plan = (day: string, id: string, week = 5) => ({ id, user_id: "u", week, day, details: "Knäböj — 3x5", session_name: "Styrka" });

beforeEach(() => {
  db.rows = { profiles: [{ user_id: "u", plan_start_date: "2026-10-05" }], workout_plans: [plan("Sön", "planned"), plan("Lör", "other-date")], workout_completions: [] };
  db.writes = []; db.failCompletion = false; db.failDelete = false;
});

describe("HC registration replacement and retry", () => {
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
