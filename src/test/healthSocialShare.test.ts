import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoShareCompletion, previewWorkoutCaption } from "@/lib/workoutAutoShare";

const state = vi.hoisted(() => ({
  inserted: [] as any[],
  existing: null as any,
  completion: null as any,
  planRows: [] as any[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const result = (table: string) => {
    if (table === "workout_plans") return { data: state.planRows, error: null };
    if (table === "workout_completions") return { data: state.completion, error: null };
    return { data: state.existing, error: null };
  };
  const query = (table: string): any => {
    const q: any = {
      select: () => q,
      eq: () => q,
      maybeSingle: () => Promise.resolve(result(table)),
      then: (resolve: (value: any) => unknown) => Promise.resolve(result(table)).then(resolve),
      insert: (payload: any) => {
        state.inserted.push(payload);
        return Promise.resolve({ error: null });
      },
    };
    return q;
  };
  return {
    supabase: {
      from: (table: string) => query(table),
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  };
});

beforeEach(() => {
  state.inserted = [];
  state.existing = null;
  state.completion = null;
  state.planRows = [];
});

describe("Health Connect-pass till Social", () => {
  it("publicerar med den importerade passets exakta datum- och importnyckel", async () => {
    await autoShareCompletion("user-1", 0, "2026-11-08_hcabc123", "Min löptur", "friends");
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({
      user_id: "user-1",
      caption: "Min löptur",
      visibility: "friends",
      workout_week: 0,
      workout_day: "2026-11-08_hcabc123",
    });
  });

  it("bygger inlägget från importerad tid, distans och puls utan intern metadata", async () => {
    state.planRows = [{ session_name: "Löpning", details: "Löpning — 33 min", tempo: null }];
    state.completion = {
      logged_weights: {
        __cond__Löpning: JSON.stringify({ time: "33", dist: "5.14", pulse: "143", hr: [110, 143, 173] }),
        __hc_meta__: JSON.stringify({ source: "Samsung Health", maxPulse: 173 }),
      },
      user_comment: "",
    };
    const caption = await previewWorkoutCaption("user-1", 0, "2026-11-08_hcabc123");
    expect(caption).toContain("Löpning");
    expect(caption).toContain("5,14 km");
    expect(caption).toContain("33 min");
    expect(caption).toContain("143 bpm");
    expect(caption).not.toContain("Samsung Health");
    expect(caption).not.toContain("__hc_meta__");
  });
});
