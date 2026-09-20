import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as healthSync from "@/lib/healthSync";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  },
}));

vi.mock("@/lib/healthWorkoutImport", () => ({
  healthWorkoutDayKey: (w: { key: string }) => w.key,
  findImportedHealthWorkouts: async () => new Set<string>(),
  importHealthWorkouts: async () => ({ imported: 0 }),
}));

const rows = [
  { day: "2026-09-19", steps: 6000, activeCalories: 400, sleepMinutes: 400 },
  { day: "2026-09-20", steps: 8421, activeCalories: 624, sleepMinutes: 437 },
];

import HealthConnectCard from "@/components/HealthConnectCard";

describe("HealthConnectCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(healthSync, "isHealthSupported").mockReturnValue(true);
    vi.spyOn(healthSync, "isHealthAvailable").mockResolvedValue(true);
    vi.spyOn(healthSync, "loadStoredHealthDays").mockResolvedValue(rows);
  });

  it("visar status per datatyp och knapp för det som saknas", async () => {
    vi.spyOn(healthSync, "checkHealthAccess").mockResolvedValue({
      activity: true,
      workouts: true,
      heartRate: false,
      sleep: false,
    });

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
      sleep: true,
    });

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
      sleep: false,
    });

    render(<HealthConnectCard />);

    await waitFor(() => expect(screen.getByText(/Inte kopplad ännu/)).toBeInTheDocument());
    expect(
      screen.getByRole("button", { name: /Tillåt steg, kalorier och distans/i }),
    ).toBeInTheDocument();
  });
});
