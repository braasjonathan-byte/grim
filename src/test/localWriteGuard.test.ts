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
  const stale = [{ logged_weights: { "__setdata__Benpress": JSON.stringify([{ kg: "100" }]) } }];

  it("flags a new best as PR", () => {
    expect(isPrWeight(buildPrIndex(local), "Benpress", "120")).toBe(true);
  });

  it("would lose the PR if a stale row replaced the local one (the bug we guard against)", () => {
    expect(isPrWeight(buildPrIndex(stale), "Benpress", "120")).toBe(false);
  });
});
