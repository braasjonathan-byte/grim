import { describe, it, expect } from "vitest";
import { e1rm, bestE1rm, suggestProgression } from "@/lib/progression";
describe("progression", () => {
  it("e1rm epley", () => { expect(e1rm(100, 1)).toBe(100); expect(e1rm(100, 5)).toBeCloseTo(116.7, 1); expect(e1rm(0, 5)).toBe(0); });
  it("best", () => { expect(bestE1rm([{ kg: 80, reps: 8 }, { kg: 100, reps: 3 }])).toBe(110); });
  it("+2.5 när mål nått", () => { expect(suggestProgression([{ kg: 80, reps: 8 }, { kg: 80, reps: 8 }], 8)?.kg).toBe(82.5); });
  it("+1 rep annars", () => { const s = suggestProgression([{ kg: 80, reps: 8 }, { kg: 80, reps: 6 }], 8); expect(s?.kg).toBe(80); expect(s?.reps).toBe(7); });
  it("lätt vikt 1.25", () => { expect(suggestProgression([{ kg: 10, reps: 12 }], 12)?.kg).toBe(11.25); });
  it("kroppsvikt", () => { expect(suggestProgression([{ kg: 0, reps: 10 }])?.reps).toBe(11); });
  it("tomt", () => { expect(suggestProgression([])).toBeNull(); });
});
