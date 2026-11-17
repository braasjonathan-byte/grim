import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ save: vi.fn(), success: vi.fn(), error: vi.fn(), read: vi.fn(), access: vi.fn() }));
const workouts = [
  { key: "ok", start: "2026-11-08T10:00:00+01:00", label: "Löpning", type: "running", source: "Samsung" },
  { key: "fail", start: "2026-11-08T12:00:00+01:00", label: "Cykling", type: "cycling", source: "Samsung" },
];
vi.mock("@/lib/healthSync", () => ({
  isHealthSupported: () => true, checkHealthAccess: mocks.access,
  readHealthWorkouts: mocks.read, recordHealthSyncError: vi.fn(),
}));
vi.mock("@/lib/healthWorkoutImport", () => ({
  healthWorkoutDayKey: (w: { key: string }) => w.key,
  findImportedHealthWorkouts: async () => new Set(), importHealthWorkouts: mocks.save,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
import HealthWorkoutPrompt from "@/components/HealthWorkoutPrompt";
beforeEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); mocks.read.mockResolvedValue(workouts); mocks.access.mockResolvedValue({ activity: false, workouts: true }); });
describe("HealthWorkoutPrompt partial failure", () => {
  it("dismisses only successful keys and keeps failed workouts open for retry", async () => {
    mocks.save.mockResolvedValueOnce({ imported: 1, failed: 1, skipped: 0, successfulKeys: ["ok"] });
    render(<HealthWorkoutPrompt userId="u" />);
    fireEvent.click(await screen.findByRole("button", { name: "Registrera" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("grim_health_prompt_dismissed:u") || "[]")).toEqual(["ok"]));
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
    expect(JSON.parse(localStorage.getItem("grim_health_prompt_dismissed:u") || "[]")).toEqual([]);
    expect(screen.getByRole("button", { name: "Registrera" })).toBeInTheDocument();
  });
  it("detects a Tacx workout on return without requiring step permission", async () => {
    mocks.read.mockResolvedValueOnce([]).mockResolvedValueOnce([workouts[1]]);
    render(<HealthWorkoutPrompt userId="u" />);
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.access).toHaveBeenCalledWith(true));
    fireEvent.focus(window);
    await screen.findByRole("button", { name: "Registrera" });
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });
  it("does not read workouts with only activity permission", async () => {
    mocks.access.mockResolvedValue({ activity: true, workouts: false });
    render(<HealthWorkoutPrompt userId="u" />);
    await waitFor(() => expect(mocks.access).toHaveBeenCalled());
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("does not reuse another account's dismissed workouts", async () => {
    localStorage.setItem("grim_health_prompt_dismissed:other", JSON.stringify(["ok", "fail"]));
    render(<HealthWorkoutPrompt userId="u" />);
    await screen.findByRole("button", { name: "Registrera" });
    expect(screen.getByText("Cykling")).toBeInTheDocument();
  });
});
