import { describe, expect, it, vi } from "vitest";
import { LocalWriteGuard, fieldsEqual } from "@/lib/localWriteGuard";
import { buildPrIndex, isPrWeight } from "@/lib/prBadges";

type Plan = { id: string; details: string };

describe("LocalWriteGuard", () => {
  it("keeps a fresh local edit when a stale refetch returns the old value", () => {
    const guard = new LocalWriteGuard<Plan>(20000, fieldsEqual<Plan>(["details"]));
    guard.mark("p1", { id: "p1", details: "Benpress — 3×10 @ 75 kg" });
    // Refetch answers with the pre-edit row (replica lag)
    expect(guard.shouldKeepLocal("p1", { id: "p1", details: "Benpress — 3×10 @ 30 kg" })).toBe(true);
  });

  it("hands control back once the backend confirms the value", () => {
    const guard = new LocalWriteGuard<Plan>(20000, fieldsEqual<Plan>(["details"]));
    guard.mark("p1", { id: "p1", details: "75 kg" });
    expect(guard.shouldKeepLocal("p1", { id: "p1", details: "75 kg" })).toBe(false);
    expect(guard.hasPending("p1")).toBe(false);
  });

  it("still protects the edit after 10 seconds, and self-heals after the TTL", () => {
    vi.useFakeTimers();
    try {
      const guard = new LocalWriteGuard<Plan>(20000, fieldsEqual<Plan>(["details"]));
      guard.mark("p1", { id: "p1", details: "75 kg" });
      vi.advanceTimersByTime(10_000);
      expect(guard.shouldKeepLocal("p1", { id: "p1", details: "30 kg" })).toBe(true);
      vi.advanceTimersByTime(11_000);
      expect(guard.shouldKeepLocal("p1", { id: "p1", details: "30 kg" })).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not interfere with rows the user never touched", () => {
    const guard = new LocalWriteGuard<Plan>(20000, fieldsEqual<Plan>(["details"]));
    expect(guard.shouldKeepLocal("other", { id: "other", details: "x" })).toBe(false);
  });
});

describe("PR badge stability", () => {
  const local = [{ logged_weights: { "__setdata__Benpress": JSON.stringify([{ kg: "120" }, { kg: "100" }]) } }];
  // A stale refetch that has not yet seen the row the user just logged.
  const stale: Array<{ logged_weights: Record<string, string> }> = [];

  it("flags a new best as PR", () => {
    expect(isPrWeight(buildPrIndex(local), "Benpress", "120")).toBe(true);
  });

  it("loses the PR when a stale response drops the freshly logged row (the bug we guard against)", () => {
    expect(isPrWeight(buildPrIndex(stale), "Benpress", "120")).toBe(false);
  });
});


describe("Hold-time (seconds) edits – Jessicas plankfall", () => {
  type Plan = { id: string; details: string; tempo: string | null };

  it("keeps a plank hold time changed 30s -> 75s when a stale refetch returns 30s", () => {
    const guard = new LocalWriteGuard<Plan>(20000, fieldsEqual<Plan>(["details", "tempo"]));
    guard.mark("p-plank", { id: "p-plank", details: "Planka — 3×75 s", tempo: null });
    expect(
      guard.shouldKeepLocal("p-plank", { id: "p-plank", details: "Planka — 3×30 s", tempo: null }),
    ).toBe(true);
  });

  it("still protects the 75 s value after 10 seconds", () => {
    vi.useFakeTimers();
    try {
      const guard = new LocalWriteGuard<Plan>(20000, fieldsEqual<Plan>(["details", "tempo"]));
      guard.mark("p-plank", { id: "p-plank", details: "Planka — 3×75 s", tempo: null });
      vi.advanceTimersByTime(10_000);
      expect(
        guard.shouldKeepLocal("p-plank", { id: "p-plank", details: "Planka — 3×30 s", tempo: null }),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases the value once the backend confirms 75 s", () => {
    const guard = new LocalWriteGuard<Plan>(20000, fieldsEqual<Plan>(["details", "tempo"]));
    guard.mark("p-plank", { id: "p-plank", details: "Planka — 3×75 s", tempo: null });
    expect(
      guard.shouldKeepLocal("p-plank", { id: "p-plank", details: "Planka — 3×75 s", tempo: null }),
    ).toBe(false);
  });

  it("protects logged hold times (time-based set data) exactly like kg/reps", () => {
    type Completion = { done: boolean; logged_weights: Record<string, string> | null };
    const guard = new LocalWriteGuard<Completion>(
      20000,
      fieldsEqual<Completion>(["done", "logged_weights"]),
    );
    const local: Completion = {
      done: false,
      logged_weights: { "__setdata__Planka": JSON.stringify([{ time: "75" }]) },
    };
    const stale: Completion = {
      done: false,
      logged_weights: { "__setdata__Planka": JSON.stringify([{ time: "30" }]) },
    };
    guard.mark("u|1|Måndag", local);
    expect(guard.shouldKeepLocal("u|1|Måndag", stale)).toBe(true);
    expect(guard.shouldKeepLocal("u|1|Måndag", local)).toBe(false);
  });
});
