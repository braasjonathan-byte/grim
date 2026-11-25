import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { buildWorkoutSeries } from "@/lib/workoutSeries";

vi.mock("@/lib/profileBasics", () => ({ useProfileBasics: () => ({ age: 40, maxHeartRate: 190 }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } } }));
const history = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/cardioHistory", async (orig) => ({ ...(await orig<typeof import("@/lib/cardioHistory")>()), loadHistoryCached: history.load }));
vi.mock("@/components/RouteMap", () => ({ default: ({ highlight }: { highlight?: [number, number] | null }) => <div data-testid="map">{highlight ? highlight.join(",") : "none"}</div> }));

import PulseAnalysis from "@/components/PulseAnalysis";

// jsdom saknar PointerEvent; utan den följer inte clientX med.
if (!("PointerEvent" in window)) {
  class PE extends MouseEvent {
    pointerId: number; pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? "touch"; }
  }
  (window as any).PointerEvent = PE;
}

const T0 = Date.UTC(2026, 10, 20, 7);
const n = 1800;
const series = buildWorkoutSeries({
  start: T0, end: T0 + n * 1000,
  hr: Array.from({ length: n }, (_, i) => ({ t: T0 + i * 1000, v: i < 900 ? 130 : 165 })),
  speed: Array.from({ length: n + 1 }, (_, i) => ({ t: T0 + i * 1000, v: 1000 / 300 })),
})!;

describe("PulseAnalysis", () => {
  it("visar zoner, belastning, delsträckor och markerar vald punkt på kartan", async () => {
    history.load.mockResolvedValue([]);
    const route = Array.from({ length: 50 }, (_, i) => [59 + i * 0.001, 18] as [number, number]);
    render(<PulseAnalysis name="Löpning" cond={{ time: "30", dist: "6", pulse: "148", series, route, routeSource: "health_connect" }} />);
    expect(screen.getByText(/Zoner från maxpuls 190 bpm/)).toBeTruthy();
    expect(screen.getByText(/Måttlig/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tempo" })).toBeTruthy();
    expect(screen.getByTestId("map").textContent).toBe("none");

    const svg = screen.getByRole("img", { name: /Puls över tid/ });
    svg.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(svg, { clientX: 75, pointerId: 1 });
    expect(screen.getByText(/165 bpm · Z4/)).toBeTruthy();
    expect(screen.getByTestId("map").textContent).not.toBe("none");

    fireEvent.click(screen.getByRole("button", { name: /Visa delsträckor/ }));
    expect(screen.getAllByText(/\/km$/).length).toBeGreaterThanOrEqual(6);
    await waitFor(() => expect(history.load).toHaveBeenCalledWith("u1"));
  });

  it("döljer graf och delsträckor när bara snittpuls finns, och visar ingen karta för egna GPS-pass", () => {
    render(<PulseAnalysis name="Löpning" cond={{ time: "30", dist: "6", pulse: "148", route: [[59, 18], [59.01, 18]] }} />);
    expect(screen.queryByRole("img", { name: /Puls över tid/ })).toBeNull();
    expect(screen.queryByTestId("map")).toBeNull();
    expect(screen.getByText("148")).toBeTruthy();
  });

  it("renderar inget utan pulsdata och rutt", () => {
    const { container } = render(<PulseAnalysis name="Löpning" cond={{ time: "30" }} />);
    expect(container.innerHTML).toBe("");
  });
});
