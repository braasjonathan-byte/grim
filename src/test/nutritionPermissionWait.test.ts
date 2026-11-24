import { afterEach, beforeEach, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android", isPluginAvailable: () => true },
  registerPlugin: () => ({ requestHealthPermissions: request }),
}));
import { requestNutritionWriteAccess } from "@/lib/nutritionHealthWrite";

beforeEach(() => { vi.useFakeTimers(); request.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("keeps a visible nutrition permission request pending beyond 60 seconds and accepts the later result", async () => {
  let finish: (value: unknown) => void = () => {};
  request.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  let hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  let settled = false;
  const result = requestNutritionWriteAccess();
  result.then(() => { settled = true; }, () => { settled = true; });
  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(61_000);
  expect(settled).toBe(false);
  finish({ permissions: { WRITE_NUTRITION: true, WRITE_HYDRATION: true } });
  await expect(result).resolves.toBe(true);
  expect(request).toHaveBeenCalledWith({ permissions: ["WRITE_NUTRITION", "WRITE_HYDRATION"] });
});

it("retains a bounded timeout for a visible permission screen with no result", async () => {
  request.mockReturnValue(new Promise(() => {}));
  let hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  const result = requestNutritionWriteAccess();
  const assertion = expect(result).rejects.toThrow("Health Connect svarade inte.");
  hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(130_001);
  await assertion;
});