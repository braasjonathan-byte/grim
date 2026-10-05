import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { summarizeCompletion } from "@/lib/workoutSummary";
import { findWorkoutImprovements } from "@/lib/workoutImprovements";

const db = vi.hoisted(() => ({ rows: [] as Array<{ logged_weights: Record<string, string> }> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const result = { data: table === "workout_completions" ? db.rows : [] };
      const query = {
        select: () => query, eq: () => query, order: () => query,
        limit: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  },
}));

const strength = (name: string, kg: number, reps: number, sets = 1) => ({
  [`__setdata__${name}`]: JSON.stringify(Array.from({ length: sets }, () => ({ kg, reps }))),
  [`__sets__${name}`]: "1".repeat(sets),
});
const cardio = (name: string, minutes: number, km: number, pulse?: number) => ({
  [`__cond__${name}`]: JSON.stringify({ time: String(minutes), dist: String(km), pulse }),
});
const compare = (current: Record<string, string>, previous: Record<string, string>[]) => {
  db.rows = previous.map((logged_weights) => ({ logged_weights }));
  return findWorkoutImprovements("test-user", summarizeCompletion(current));
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("passanpassad pepp", () => {
  it("har 133 unika formuleringar efter 100 tillägg, med endast giltiga variabler", () => {
    const source = readFileSync("src/lib/workoutImprovements.ts", "utf8");
    const block = source.slice(source.indexOf("  heavier: ["), source.indexOf("const RECENT_KEY"));
    const vars: Record<string, string[]> = {
      heavier: ["ex", "now", "prev", "diff"], moreReps: ["ex", "kg", "now", "prev", "diff"],
      exerciseVolume: ["ex", "now", "prev", "pct"], faster: ["sport", "now", "prev"],
      longerDistance: ["sport", "now", "prev", "diff"], longerTime: ["sport", "now", "prev", "diff"],
      lowerPulse: ["sport", "now", "prev", "diff"], sessionVolume: ["now", "prev", "pct"],
      moreSets: ["now", "prev", "diff"],
    };
    const texts: string[] = [];
    for (const match of block.matchAll(/  (\w+): \[([\s\S]*?)\n  \],/g)) {
      const kind = match[1];
      for (const text of match[2].matchAll(/(?:"text"|text): "([^"]+)"/g)) {
        texts.push(text[1]);
        for (const placeholder of text[1].matchAll(/\{(\w+)\}/g)) expect(vars[kind]).toContain(placeholder[1]);
        expect(text[1]).toMatch(/\{(?:now|diff|pct)\}/);
        if (["heavier", "moreReps", "exerciseVolume"].includes(kind)) expect(text[1]).toContain("{ex}");
        if (["faster", "longerDistance", "longerTime", "lowerPulse"].includes(kind)) expect(text[1]).toContain("{sport}");
      }
    }
    expect(texts).toHaveLength(133);
    expect(new Set(texts).size).toBe(133);
  });

  it("peppar med den aktuella övningens riktiga viktbästa", async () => {
    const result = await compare(strength("Knäböj", 90, 5), [strength("Knäböj", 80, 5)]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("Knäböj");
    expect(result[0].text).toMatch(/90 kg|10 kg/);
    expect(result[0].text).not.toMatch(/\{\w+\}/);
  });

  it("jämför reps mot tidigare bästa på samma vikt, inte senaste passet", async () => {
    const result = await compare(strength("Bänkpress", 60, 10), [strength("Bänkpress", 60, 6), strength("Bänkpress", 60, 8)]);
    expect(result[0].text).toContain("Bänkpress");
    expect(result[0].text).toContain("60 kg");
    expect(result[0].text).toMatch(/10|2/);
    expect(result[0].text).not.toContain("6 reps");
  });

  it("ger ingen påhittad förbättring för ett sämre eller första pass", async () => {
    expect(await compare(strength("Knäböj", 70, 5), [strength("Knäböj", 80, 5)])).toEqual([]);
    expect(await compare(strength("Knäböj", 90, 5), [])).toEqual([]);
  });

  it("jämför inte totalsiffror mot helt andra övningar", async () => {
    expect(await compare(strength("Knäböj", 90, 5, 5), Array.from({ length: 3 }, () => strength("Bicepscurl", 10, 5)))).toEqual([]);
  });

  it("kan visa högre passvolym för samma övningar", async () => {
    const result = await compare(strength("Knäböj", 80, 5, 5), Array.from({ length: 3 }, () => strength("Knäböj", 80, 5, 2)));
    expect(result).toHaveLength(2);
    expect(result.some((r) => r.text.includes("snitt"))).toBe(true);
  });

  it("hittar snabbare cykling men inte jämförelser mot löpning", async () => {
    const result = await compare(cardio("Cykling", 30, 15), [cardio("Cykling", 35, 15)]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("cykling");
    expect(result[0].text).not.toMatch(/\{\w+\}/);
    expect(await compare(cardio("Cykling", 30, 15), [cardio("Löpning", 35, 5)])).toEqual([]);
  });

  it("använder inte blandade konditionstotaler som sportspecifika rekord", async () => {
    const mixed = { ...cardio("Cykling", 40, 20), ...cardio("Löpning", 25, 5) };
    expect(await compare(mixed, [cardio("Cykling", 30, 10)])).toEqual([]);
    expect(await compare(cardio("Cykling", 30, 15), [mixed])).toEqual([]);
  });

  it("undviker den senast visade formuleringen", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const first = await compare(strength("Knäböj", 90, 5), [strength("Knäböj", 80, 5)]);
    const next = await compare(strength("Knäböj", 90, 5), [strength("Knäböj", 80, 5)]);
    expect(first[0].text).not.toBe(next[0].text);
  });
});