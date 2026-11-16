import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Completion } from "./types";
import { useWorkoutCompletionWriter } from "./useWorkoutCompletionWriter";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(), queue: vi.fn(), dequeue: vi.fn(), patch: vi.fn(),
  remember: vi.fn(), triggerSave: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ upsert: mocks.upsert }) } }));
vi.mock("@/hooks/useOfflineSync", () => ({ queueOfflineUpsert: mocks.queue, dequeueOfflineUpsert: mocks.dequeue }));
vi.mock("@/lib/offlineWorkoutCache", () => ({ patchOfflineWorkoutCache: mocks.patch }));
vi.mock("@/lib/completionGuard", () => ({
  countCheckmarks: () => 1, detectDestructiveWrite: () => false,
  getKnownCheckmarkCount: () => 0, rememberCheckmarkCount: mocks.remember,
  logDestructiveWrite: vi.fn(),
}));

function useFixture() {
  const [completions, setCompletions] = useState<Record<string, Completion>>({
    "1-Måndag": { week: 1, day: "Måndag", done: false, skipped: false, user_comment: "Behåll", logged_pulse: 120, logged_weights: { other: 42 } },
  });
  const writer = useWorkoutCompletionWriter({ userId: "user-a", setCompletions, triggerSave: mocks.triggerSave });
  return { completions, ...writer };
}

describe("workout completion writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it("preserves other fields and stores the fallback before the network write", async () => {
    const { result } = renderHook(useFixture);
    let saving: Promise<void> | undefined;
    act(() => { saving = result.current.safeUpsertCompletion(1, "Måndag", { logged_tempo: "5:00" }); });
    await act(async () => { await saving; });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-a", user_comment: "Behåll", logged_pulse: 120,
      logged_weights: { other: 42 }, logged_tempo: "5:00",
    }), { onConflict: "user_id,week,day" });
    expect(mocks.queue.mock.invocationCallOrder[0]).toBeLessThan(mocks.upsert.mock.invocationCallOrder[0]);
    expect(mocks.patch).toHaveBeenCalledWith("user-a", expect.objectContaining({ logged_tempo: "5:00" }));
    expect(mocks.dequeue).toHaveBeenCalledWith("workout_completions", { user_id: "user-a", week: 1, day: "Måndag" });
  });

  it("keeps failed writes queued", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "network" } });
    const { result } = renderHook(useFixture);
    let saving: Promise<void> | undefined;
    act(() => { saving = result.current.safeUpsertCompletion(1, "Måndag", { logged_distance_km: 5 }); });
    await act(async () => { await saving; });
    expect(mocks.queue).toHaveBeenCalledTimes(1);
    expect(mocks.dequeue).not.toHaveBeenCalled();
    expect(result.current.completions["1-Måndag"].logged_distance_km).toBe(5);
  });

  it("saves offline without waiting for a network call", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(useFixture);
    let saving: Promise<void> | undefined;
    act(() => { saving = result.current.updateCompletionWeights(1, "Måndag", (current) => ({ ...current, newSet: 1 })); });
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledTimes(1));
    await act(async () => { await saving; });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.dequeue).not.toHaveBeenCalled();
    expect(mocks.queue).toHaveBeenCalledWith("workout_completions", expect.objectContaining({ logged_weights: { other: 42, newSet: 1 } }), "user_id,week,day");
  });
});