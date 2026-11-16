import { describe, it, expect } from "vitest";
import { belongsTo } from "./useOfflineSync";

describe("offline queue ownership", () => {
  it("replays only rows owned by the signed-in user", () => {
    expect(belongsTo({ data: { user_id: "a" } }, "a")).toBe(true);
    expect(belongsTo({ data: { user_id: "b" } }, "a")).toBe(false);
    expect(belongsTo({ data: {} }, "a")).toBe(false);
  });
});
