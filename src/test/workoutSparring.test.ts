import { describe, expect, it } from "vitest";
import { compareSparring, sparringSet, readSparring } from "@/lib/workoutSparring";
const weights = (kg = "60", reps = "10", marks = "1") => ({ __setdata__Bänkpress: JSON.stringify([{ kg, reps }]), __sets__Bänkpress: marks });
const reference = { post_id: "post", nickname: "Vän", logged_weights: weights() };
describe("private sparring comparison", () => {
  it("only scores same exercise, checked set position and reps", () => {
    expect(compareSparring(reference, weights("65"), "Bänkpress — 1×10")).toMatchObject({ higher: 1, compared: 1 });
    expect(compareSparring(reference, weights("60"), "Bänkpress — 1×10").matched).toBe(1);
    expect(compareSparring(reference, weights("65", "8"), "Bänkpress — 1×10").compared).toBe(0);
    expect(compareSparring(reference, weights("65", "10", "0"), "Bänkpress — 1×10").compared).toBe(0);
    expect(compareSparring(reference, weights("65"), "Knäböj — 1×10").compared).toBe(0);
  });
  it("never displays unchecked, warmup or implausible reference sets", () => {
    expect(sparringSet(weights("60", "10", "0"), "Bänkpress", 0)).toBeNull();
    expect(sparringSet({ ...weights(), __settypes__Bänkpress: "w" }, "Bänkpress", 0)).toBeNull();
    expect(sparringSet(weights("99999"), "Bänkpress", 0)).toBeNull();
  });
  it("does not compare assisted bodyweight modes", () => {
    expect(compareSparring(reference, { ...weights("65"), __bw_mode__Bänkpress: "sub" }, "Bänkpress — 1×10").compared).toBe(0);
  });
  it("only compares cardio for identical exercise and distance", () => {
    const cardio = (name: string, dist: string, time: string) => ({ [`__cond__${name}`]: JSON.stringify({ dist, time }), [`__cond_done__${name}`]: "1" });
    const r = { ...reference, logged_weights: cardio("Löpning", "5", "30") };
    expect(compareSparring(r, cardio("Löpning", "5", "25"), "Löpning").cardio).toBe("5 min snabbare på samma distans");
    expect(compareSparring(r, cardio("Cykling", "5", "25"), "Cykling").cardio).toBeNull();
    expect(compareSparring(r, cardio("Löpning", "10", "25"), "Löpning").cardio).toBeNull();
  });
  it("rejects malformed snapshots", () => { expect(readSparring({})).toBeNull(); });
});