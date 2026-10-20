import { describe, expect, it } from "vitest";
import { canUseFeature, needsForceUpdate, resolveAudience } from "@/lib/featureFlags";
import { applyPlanCatalog, normalizePlanCatalog, type PlanCatalog } from "@/lib/planCatalog";
import { pushRevision, takeRevision } from "@/lib/contentHistory";
import type { TemplatePlan } from "@/data/planTemplates";

const settings = { feature_flags: {}, ai_food_for_all: false };

const plan = (name: string, description = name): TemplatePlan => ({
  name,
  description,
  weeks: 4,
  category: "styrka",
  requiredLifts: [],
});

describe("feature flags", () => {
  it("keeps today's defaults until an admin saves a flag", () => {
    expect(resolveAudience(settings, "ai_food")).toBe("honorary");
    expect(resolveAudience(settings, "ai_workout")).toBe("honorary");
    expect(resolveAudience(settings, "strava")).toBe("off");
    expect(resolveAudience(settings, "gps")).toBe("all");
    expect(resolveAudience({ ...settings, ai_food_for_all: true }, "ai_food")).toBe("all");
  });

  it("lets an explicit flag override the default", () => {
    const next = { ...settings, feature_flags: { gps: "off" as const, strava: "all" as const } };
    expect(canUseFeature(next, "gps", { isAdmin: true })).toBe(false);
    expect(canUseFeature(next, "strava", {})).toBe(true);
    expect(canUseFeature(settings, "ai_food", { isHonorary: true })).toBe(true);
    expect(canUseFeature(settings, "ai_food", {})).toBe(false);
  });

  it("forces an update only when the build is older than the limit", () => {
    expect(needsForceUpdate("dev", "2026-10-20T12:00:00.000Z")).toBe(false);
    expect(needsForceUpdate("2026-10-19T12:00:00.000Z", "")).toBe(false);
    expect(needsForceUpdate("2026-10-19T12:00:00.000Z", "2026-10-20T12:00:00.000Z")).toBe(true);
    expect(needsForceUpdate("2026-10-21T12:00:00.000Z", "2026-10-20T12:00:00.000Z")).toBe(false);
  });
});

describe("plan catalog", () => {
  const templates = [plan("A", "original"), plan("B"), plan("C")];
  const catalog: PlanCatalog = {
    hidden: ["B"],
    order: ["C", "A", "B"],
    descriptions: { A: "ny text" },
    featured: "A",
  };

  it("hides, reorders, overrides the description and pins the featured plan", () => {
    const visible = applyPlanCatalog(templates, catalog);
    expect(visible.map((item) => item.name)).toEqual(["A", "C"]);
    expect(visible[0].description).toBe("ny text");
    expect(visible[0].requiredLifts).toEqual([]);
  });

  it("keeps hidden plans in the admin list without pinning", () => {
    const all = applyPlanCatalog(templates, catalog, { includeHidden: true, pinFeatured: false });
    expect(all.map((item) => item.name)).toEqual(["C", "A", "B"]);
  });

  it("drops junk from a stored catalog", () => {
    expect(normalizePlanCatalog({ hidden: ["  A "], featured: "  ", descriptions: { A: "  " } })).toEqual({
      hidden: ["A"],
      order: [],
      descriptions: {},
      featured: null,
    });
  });
});

describe("content history", () => {
  it("keeps the newest revision first and restores one key", () => {
    const list = pushRevision(pushRevision([], { key: "a", at: "1", value: 1 }), { key: "b", at: "2", value: 2 });
    expect(list.map((item) => item.key)).toEqual(["b", "a"]);
    const undone = takeRevision(list, "a");
    expect(undone.rev?.value).toBe(1);
    expect(undone.rest.map((item) => item.key)).toEqual(["b"]);
    expect(takeRevision(undone.rest, "a").rev).toBeNull();
  });
});
