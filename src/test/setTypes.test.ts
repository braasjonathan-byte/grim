import { describe, it, expect } from "vitest";
import { getSetType, nextSetType, withSetType, setLabel, getSuperset, nextSupersetLetter, shouldStartRest, supersetMembers } from "@/lib/setTypes";
import { getRestSecondsFor } from "@/lib/restTimer";

describe("setTypes", () => {
  it("cyklar n→w→d→n", () => {
    expect(nextSetType("n")).toBe("w");
    expect(nextSetType("w")).toBe("d");
    expect(nextSetType("d")).toBe("n");
  });
  it("skriver och läser typ per set", () => {
    const s = withSetType("", 0, "w", 4);
    expect(s).toBe("wnnn");
    const w = { "__settypes__Knäböj": s };
    expect(getSetType(w, "knäböj", 0)).toBe("w");
    expect(getSetType(w, "Knäböj", 2)).toBe("n");
    expect(withSetType(s, 0, "n", 4)).toBe("");
  });
  it("etiketter numrerar bara arbetsset", () => {
    expect(["wwnnd"].flatMap(t => [0, 1, 2, 3, 4].map(i => setLabel(t, i)))).toEqual(["U", "U", "1", "2", "D"]);
  });
  it("superset", () => {
    const w = { "__superset__Bänkpress": "A", "__superset__Rodd": "A", "__superset__Curl": "B" };
    expect(getSuperset(w, "bänkpress")).toBe("A");
    expect(nextSupersetLetter(["A", "B"])).toBe("C");
    const order = ["Bänkpress", "Knäböj", "Rodd", "Curl"];
    expect(supersetMembers(w, "Rodd", order)).toEqual(["Bänkpress", "Rodd"]);
    expect(supersetMembers(w, "Curl", order)).toBeNull();
  });
  it("vila startar inte efter uppvärmning/dropset eller mitt i superset", () => {
    expect(shouldStartRest({ setType: "w", exercise: "X" })).toBe(false);
    expect(shouldStartRest({ setType: "d", exercise: "X" })).toBe(false);
    expect(shouldStartRest({ setType: "n", exercise: "A", supersetOrder: ["A", "B"] })).toBe(false);
    expect(shouldStartRest({ setType: "n", exercise: "B", supersetOrder: ["A", "B"] })).toBe(true);
    expect(shouldStartRest({ setType: "n", exercise: "X" })).toBe(true);
  });
});

describe("getRestSecondsFor", () => {
  const mk = (o: Record<string, string>) => ({ getItem: (k: string) => o[k] ?? null });
  it("per övning > global > 90", () => {
    expect(getRestSecondsFor("Knäböj", mk({}))).toBe(90);
    expect(getRestSecondsFor("Knäböj", mk({ grim_set_rest_timer_seconds: "120" }))).toBe(120);
    expect(getRestSecondsFor("Knäböj", mk({ grim_set_rest_timer_seconds: "120", grim_rest_seconds_by_exercise: JSON.stringify({ "knäböj": 180 }) }))).toBe(180);
    expect(getRestSecondsFor("Knäböj", mk({ grim_set_rest_timer_enabled: "false" }))).toBe(0);
  });
});
