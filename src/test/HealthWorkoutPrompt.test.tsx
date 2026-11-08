import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ save: vi.fn(), success: vi.fn(), error: vi.fn() }));
const workouts = [
  { key: "ok", start: "2026-11-08T10:00:00+01:00", label: "Löpning", type: "running", source: "Samsung" },
  { key: "fail", start: "2026-11-08T12:00:00+01:00", label: "Cykling", type: "cycling", source: "Samsung" },
];
vi.mock("@/lib/healthSync", () => ({
  isHealthSupported: () => true, hasHealthPermissions: async () => true,
  readHealthWorkouts: async () => workouts, recordHealthSyncError: vi.fn(),
}));
vi.mock("@/lib/healthWorkoutImport", () => ({
  healthWorkoutDayKey: (w: { key: string }) => w.key,
  findImportedHealthWorkouts: async () => new Set(), importHealthWorkouts: mocks.save,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
import HealthWorkoutPrompt from "@/components/HealthWorkoutPrompt";
beforeEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
describe("HealthWorkoutPrompt partial failure", () => {
  it("dismisses only successful keys and keeps failed workouts open for retry", async () => {
    mocks.save.mockResolvedValueOnce({ imported: 1, failed: 1, skipped: 0, successfulKeys: ["ok"] });
    render(<HealthWorkoutPrompt userId="u" />);
    fireEvent.click(await screen.findByRole("button", { name: "Registrera" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("grim_health_prompt_dismissed") || "[]")).toEqual(["ok"]));
    expect(screen.getByRole("button", { name: "Registrera" })).toBeInTheDocument();
    expect(screen.queryByText("Löpning")).toBeNull();
    expect(screen.getByText("Cykling")).toBeInTheDocument();
    mocks.save.mockResolvedValueOnce({ imported: 1, failed: 0, skipped: 0, successfulKeys: ["fail"] });
    fireEvent.click(screen.getByRole("button", { name: "Registrera" }));
    await waitFor(() => expect(mocks.save).toHaveBeenLastCalledWith("u", [workouts[1]]));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Registrera" })).toBeNull());
  });
  it("does not show success or dismiss anything when all imports fail", async () => {
    mocks.save.mockResolvedValueOnce({ imported: 0, failed: 2, skipped: 0, successfulKeys: [] });
    render(<HealthWorkoutPrompt userId="u" />);
    fireEvent.click(await screen.findByRole("button", { name: "Registrera" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("grim_health_prompt_dismissed") || "[]")).toEqual([]);
    expect(screen.getByRole("button", { name: "Registrera" })).toBeInTheDocument();
  });
});
