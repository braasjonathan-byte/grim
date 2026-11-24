import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import * as healthSync from "@/lib/healthSync";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  },
}));

const imports = vi.hoisted(() => ({ find: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/healthWorkoutImport", () => ({
  healthWorkoutDayKey: (w: { key: string }) => w.key,
  findImportedHealthWorkouts: imports.find,
  importHealthWorkouts: imports.save,
  relocateHealthImports: async () => 0,
  cleanupHealthImportDetails: async () => 0,
}));

const rows = [
  { day: "2026-09-19", steps: 6000, activeCalories: 400, sleepMinutes: 400 },
  { day: "2026-09-20", steps: 8421, activeCalories: 624, sleepMinutes: 437 },
];

import HealthConnectCard from "@/components/HealthConnectCard";

describe("HealthConnectCard", () => {
  afterEach(() => { vi.useRealTimers(); });
  beforeEach(() => {
    vi.restoreAllMocks();
    imports.find.mockReset().mockResolvedValue(new Set());
    imports.save.mockReset().mockResolvedValue({ imported: 1, failed: 0, skipped: 0, successfulKeys: ["hc1"] });
    vi.spyOn(healthSync, "isHealthSupported").mockReturnValue(true);
    vi.spyOn(healthSync, "isHealthAvailable").mockResolvedValue(true);
    vi.spyOn(healthSync, "loadStoredHealthDays").mockResolvedValue(rows);
  });

  it.each(["single", "all"])("rechecks previously imported workouts before %s import after deletion", async mode => {
    vi.spyOn(healthSync, "checkHealthAccess").mockResolvedValue({ activity: true, workouts: true, heartRate: true, sleep: true, weight: true });
    const workout = { key: "hc1", label: "Cykling", start: "2026-11-17T10:00:00Z", minutes: 59, source: "Tacx" } as healthSync.HealthWorkout;
    vi.spyOn(healthSync, "readHealthWorkouts").mockResolvedValue([workout]);
    imports.find.mockResolvedValue(new Set(["hc1"]));
    render(<HealthConnectCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Hämta genomförda pass/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Hämta genomförda pass/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Kontrollera och importera/ })).toBeEnabled());
    // No change event arrives: the old imported marker remains on screen.
    imports.find.mockResolvedValue(new Set());
    fireEvent.click(screen.getByRole("button", { name: mode === "single" ? /Kontrollera och importera/ : "Importera alla" }));
    await waitFor(() => expect(imports.save).toHaveBeenCalledWith("u1", [workout]));
    expect(imports.save).toHaveBeenCalledTimes(1);
  });

  it("does not apply the data-sync 60-second deadline while the user chooses permissions", async () => {
    const denied = { activity: false, workouts: false, heartRate: false, sleep: false, weight: false };
    const granted = { activity: true, workouts: true, heartRate: true, sleep: true, weight: true };
    vi.spyOn(healthSync, "checkHealthAccess").mockResolvedValue(denied);
    let finish: (value: healthSync.HealthAccess) => void = () => {};
    vi.spyOn(healthSync, "requestHealthPermissions").mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const read = vi.spyOn(healthSync, "readHealthDays").mockResolvedValue(rows);
    vi.spyOn(healthSync, "saveHealthDays").mockResolvedValue(undefined);
    const errors = vi.spyOn(toast, "error");
    render(<HealthConnectCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Synka hälsodata/ })).toBeEnabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /Synka hälsodata/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    expect(errors).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    await act(async () => { finish(granted); await vi.advanceTimersByTimeAsync(0); });
    expect(read).toHaveBeenCalledOnce();
  });

  it("visar status per datatyp och knapp för det som saknas", async () => {
    vi.spyOn(healthSync, "checkHealthAccess").mockResolvedValue({
      activity: true,
      workouts: true,
      heartRate: false,
      sleep: false, weight: false });

    render(<HealthConnectCard />);

    await waitFor(() => expect(screen.getByText(/Kopplingen är aktiv/)).toBeInTheDocument());
    expect(screen.getByText("Steg, kalorier och distans")).toBeInTheDocument();
    expect(screen.getByText("Genomförda pass")).toBeInTheDocument();
    expect(screen.getByText(/^Puls – saknas$/)).toBeInTheDocument();
    expect(screen.getByText(/^Sömn – saknas$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tillåt puls, sömn/i })).toBeInTheDocument();
  });

  it("visar sparad data med steg, kalorier och sömn", async () => {
    vi.spyOn(healthSync, "checkHealthAccess").mockResolvedValue({
      activity: true,
      workouts: true,
      heartRate: true,
      sleep: true, weight: true });

    render(<HealthConnectCard />);

    await waitFor(() => expect(screen.getByText(/steg/)).toBeInTheDocument());
    const today = screen.getByText(/Idag:/).textContent ?? "";
    expect(today).toContain("8");
    expect(today).toContain("624 kcal");
    expect(today).toContain("7 h 17 min sömn");
    expect(screen.queryByRole("button", { name: /Tillåt/i })).toBeNull();
  });

  it("visar inte kopplad när behörighet saknas helt", async () => {
    vi.spyOn(healthSync, "checkHealthAccess").mockResolvedValue({
      activity: false,
      workouts: false,
      heartRate: false,
      sleep: false, weight: false });

    render(<HealthConnectCard />);

    await waitFor(() => expect(screen.getByText(/Inte kopplad ännu/)).toBeInTheDocument());
    expect(
      screen.getByRole("button", { name: /Tillåt steg, kalorier och distans/i }),
    ).toBeInTheDocument();
  });
});
