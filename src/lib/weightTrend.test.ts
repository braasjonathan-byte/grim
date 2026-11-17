import { describe, expect, it } from "vitest";
import { rollingAverage7 } from "./weightTrend";

describe("rollingAverage7", () => {
  it("ger null tills minst två vägningar finns i fönstret", () => {
    const result = rollingAverage7([{ log_date: "2026-11-10", weight_kg: 80 }]);
    expect(result).toEqual([null]);
  });

  it("räknar medelvärdet av vägningarna inom de senaste 7 dagarna", () => {
    const result = rollingAverage7([
      { log_date: "2026-11-10", weight_kg: 80 },
      { log_date: "2026-11-12", weight_kg: 82 },
      { log_date: "2026-11-16", weight_kg: 81 },
    ]);
    expect(result).toEqual([null, 81, 81]);
  });

  it("utelämnar vägningar som är äldre än 7 dagar", () => {
    const result = rollingAverage7([
      { log_date: "2026-11-01", weight_kg: 90 },
      { log_date: "2026-11-10", weight_kg: 80 },
      { log_date: "2026-11-12", weight_kg: 82 },
    ]);
    // 1 nov ligger utanför fönstret för 10 nov (9 dagar senare) – bara en
    // vägning kvar i fönstret ger null, och 12 nov räknas utan 90 kg-vägningen
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(81);
  });

  it("hanterar månadsskiften i fönstret", () => {
    const result = rollingAverage7([
      { log_date: "2026-10-30", weight_kg: 100 },
      { log_date: "2026-11-02", weight_kg: 90 },
    ]);
    expect(result[1]).toBe(95);
  });
});
