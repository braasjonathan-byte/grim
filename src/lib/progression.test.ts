import { describe, it, expect } from "vitest";
import { suggestFromRpe } from "./progression";

describe("suggestFromRpe", () => {
  const sets = [{ kg: 80, reps: 8 }, { kg: 80, reps: 8 }];
  it("null utan RPE", () => expect(suggestFromRpe(sets, [null, null])).toBeNull());
  it("lätt → +2,5 kg", () => expect(suggestFromRpe(sets, [6, 7])?.kg).toBe(82.5));
  it("lagom → +1 rep", () => expect(suggestFromRpe(sets, [8, 8])).toMatchObject({ kg: 80, reps: 9 }));
  it("tungt → håll", () => expect(suggestFromRpe(sets, [9, 9])).toMatchObject({ kg: 80, reps: 8 }));
  it("max → −5 %", () => expect(suggestFromRpe(sets, [9, 10])?.kg).toBe(75));
  it("lätt vikt → +1,25", () => expect(suggestFromRpe([{ kg: 12, reps: 10 }], [7])?.kg).toBe(13.25));
});
