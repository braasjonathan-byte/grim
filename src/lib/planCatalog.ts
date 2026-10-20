import type { TemplatePlan } from "@/data/planTemplates";

export interface PlanCatalog {
  hidden: string[];
  order: string[];
  descriptions: Record<string, string>;
  featured: string | null;
}

export const EMPTY_PLAN_CATALOG: PlanCatalog = {
  hidden: [],
  order: [],
  descriptions: {},
  featured: null,
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

export function normalizePlanCatalog(value: unknown): PlanCatalog {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { hidden: [], order: [], descriptions: {}, featured: null };
  }
  const raw = value as Record<string, unknown>;
  const descriptions: Record<string, string> = {};
  if (raw.descriptions && typeof raw.descriptions === "object" && !Array.isArray(raw.descriptions)) {
    for (const [name, text] of Object.entries(raw.descriptions as Record<string, unknown>)) {
      const clean = String(text ?? "").trim();
      if (name.trim() && clean) descriptions[name] = clean;
    }
  }
  const featured = typeof raw.featured === "string" && raw.featured.trim() ? raw.featured.trim() : null;
  return { hidden: strings(raw.hidden), order: strings(raw.order), descriptions, featured };
}

/**
 * Ordning, dolda program, egen beskrivning och utvalt program.
 * Generatorerna på mallarna lämnas orörda.
 */
export function applyPlanCatalog(
  templates: TemplatePlan[],
  catalog: PlanCatalog,
  opts?: { includeHidden?: boolean; pinFeatured?: boolean },
): TemplatePlan[] {
  const known = new Set(templates.map((template) => template.name));
  const byName = new Map(templates.map((template) => [template.name, template]));
  const orderedNames = [
    ...catalog.order.filter((name) => known.has(name)),
    ...templates.map((template) => template.name).filter((name) => !catalog.order.includes(name)),
  ];
  let list = orderedNames.map((name) => {
    const template = byName.get(name)!;
    const description = catalog.descriptions[name];
    return description ? { ...template, description } : template;
  });
  if (!opts?.includeHidden) list = list.filter((template) => !catalog.hidden.includes(template.name));
  if (opts?.pinFeatured !== false && catalog.featured && list.some((template) => template.name === catalog.featured)) {
    const featured = list.find((template) => template.name === catalog.featured)!;
    list = [featured, ...list.filter((template) => template.name !== catalog.featured)];
  }
  return list;
}
