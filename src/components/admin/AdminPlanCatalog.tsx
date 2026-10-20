import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { planTemplates } from "@/data/planTemplates";
import { saveAppSetting, useAppSettings } from "@/lib/appSettings";
import { applyPlanCatalog, EMPTY_PLAN_CATALOG, type PlanCatalog } from "@/lib/planCatalog";
import UndoContentButton from "@/components/admin/UndoContentButton";

const clone = (catalog: PlanCatalog): PlanCatalog => ({
  hidden: [...catalog.hidden],
  order: [...catalog.order],
  descriptions: { ...catalog.descriptions },
  featured: catalog.featured,
});

export default function AdminPlanCatalog({ userId }: { userId: string }) {
  const settings = useAppSettings();
  const [draft, setDraft] = useState<PlanCatalog | null>(null);
  const [query, setQuery] = useState("");
  const [openName, setOpenName] = useState<string | null>(null);

  useEffect(() => { setDraft(clone(settings.plan_catalog)); }, [settings.plan_catalog]);

  const rows = useMemo(() => {
    if (!draft) return [];
    const needle = query.trim().toLowerCase();
    return applyPlanCatalog(planTemplates, draft, { includeHidden: true, pinFeatured: false })
      .filter((template) => !needle || template.name.toLowerCase().includes(needle));
  }, [draft, query]);

  if (!draft) return null;

  const move = (name: string, direction: -1 | 1) => {
    const order = applyPlanCatalog(planTemplates, draft, { includeHidden: true, pinFeatured: false }).map((template) => template.name);
    const index = order.indexOf(name);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    setDraft({ ...draft, order });
  };

  const save = async () => {
    try {
      await saveAppSetting("plan_catalog", draft, userId);
      toast.success("Programlistan är uppdaterad för alla");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara");
    }
  };

  const reset = async () => {
    try {
      await saveAppSetting("plan_catalog", EMPTY_PLAN_CATALOG, userId);
      toast.success("Programlistan är återställd");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kunde inte återställa");
    }
  };

  return (
    <div className="space-y-2 text-sm">
      <p className="text-[11px] text-muted-foreground">Dölj, sortera, byt beskrivning eller lyft fram ett program. Själva passen räknas fortfarande ut av appen.</p>
      <Input value={query} placeholder="Sök program" onChange={(e) => setQuery(e.target.value)} />
      <ul className="divide-y divide-border">
        {rows.map((template) => {
          const hidden = draft.hidden.includes(template.name);
          const featured = draft.featured === template.name;
          return (
            <li key={template.name} className="py-2">
              <div className="flex items-start gap-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenName(openName === template.name ? null : template.name)}>
                  <span className={`block font-medium ${hidden ? "text-muted-foreground line-through" : ""}`}>{template.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{featured ? "Utvalt · " : ""}{hidden ? "Dolt" : "Synligt"}</span>
                </button>
                <button type="button" aria-label="Utvalt program" onClick={() => setDraft({ ...draft, featured: featured ? null : template.name })} className={featured ? "text-primary" : "text-muted-foreground"}>
                  <Star className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Flytta upp" onClick={() => move(template.name, -1)} className="text-muted-foreground"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Flytta ner" onClick={() => move(template.name, 1)} className="text-muted-foreground"><ArrowDown className="h-4 w-4" /></button>
              </div>
              {openName === template.name && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={4}
                    value={draft.descriptions[template.name] ?? template.description}
                    onChange={(e) => setDraft({ ...draft, descriptions: { ...draft.descriptions, [template.name]: e.target.value } })}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft({
                      ...draft,
                      hidden: hidden ? draft.hidden.filter((name) => name !== template.name) : [...draft.hidden, template.name],
                    })}
                  >
                    {hidden ? "Visa igen" : "Dölj för alla"}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void save()}>Spara för alla</Button>
        <Button size="sm" variant="outline" onClick={() => void reset()}>Återställ original</Button>
        <UndoContentButton contentKey="plan_catalog" userId={userId} />
      </div>
    </div>
  );
}
