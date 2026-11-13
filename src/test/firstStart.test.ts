import { beforeEach, describe, expect, it } from "vitest";
import { firstTask, getFirstFocus, saveFirstFocus } from "@/lib/firstStart";
import { getModules, setModules } from "@/lib/modules";

describe("First registration focus", () => {
  beforeEach(() => localStorage.clear());
  it("offers training, nutrition and both through existing tasks", () => {
    expect(firstTask("training")).toBe("workout");
    expect(firstTask("nutrition")).toBe("nutrition");
    expect(firstTask("both")).toBe("workout");
  });
  it("keeps another user's choice separate", () => {
    saveFirstFocus("one", "nutrition");
    expect(getFirstFocus("one")).toBe("nutrition");
    expect(getFirstFocus("two")).toBeNull();
  });
  it("does not disable other features when choosing training", () => {
    setModules({ nutrition: true, social: true });
    saveFirstFocus("one", "training");
    expect(getModules()).toEqual({ nutrition: true, social: true });
  });
});