import { describe, it, expect } from "vitest";
import { gramsForFood } from "@/lib/nutritionCalc";

describe("volume units use food density", () => {
  const cases: [string, string, number, number][] = [
    ["Havregryn Garant", "dl", 3, 105],
    ["Havremjölk", "dl", 1, 103],
    ["Mjölk 3%", "dl", 1, 103],
    ["Vetemjöl", "dl", 1, 60],
    ["Ris basmati okokt", "dl", 1, 85],
    ["Cornflakes", "dl", 1, 13],
    ["Olivolja", "msk", 1, 13.8],
    ["Strösocker", "tsk", 1, 4.25],
    ["Ägg", "st", 2, 106],
    ["Banan", "st", 1, 120],
    ["Okänt livsmedel", "dl", 1, 100],
    ["Vetekli", "dl", 1, 25],
    ["Chips potatis naturell", "dl", 1, 10],
    ["Ost hårdost fett 26%", "dl", 1, 45],
    ["Kanel malen", "tsk", 1, 2.5],
    ["Nudlar äggnudlar okokta", "dl", 1, 35],
  ];
  it.each(cases)("%s %s", (name, unit, amt, expected) => {
    expect(gramsForFood(amt, unit, name)).toBeCloseTo(expected, 1);
  });
});
