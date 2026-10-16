import { Suspense, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, Shield } from "lucide-react";
import { useAppSettings } from "@/lib/appSettings";
import { getAdminGroups, type AdminTool } from "@/components/admin/adminCatalog";

function ToolButton({ tool, onOpen }: { tool: AdminTool; onOpen: () => void }) {
  const Icon = tool.icon;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-muted/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{tool.title}</span>
        <span className="block text-[11px] text-muted-foreground">{tool.subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function AdminPanel({ userId, onViewUserPlan }: { userId: string; onViewUserPlan?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const settings = useAppSettings();
  const groups = useMemo(() => getAdminGroups(), []);
  const ctx = { userId, onViewUserPlan };
  const q = query.trim().toLowerCase();
  const active = groups.flatMap((g) => g.items).find((t) => t.id === activeId) ?? null;

  return (
    <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Shield className="h-4 w-4 text-primary" /> Admin
        </span>
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && active && (
        <div className="space-y-3">
          <button type="button" onClick={() => setActiveId(null)} className="flex items-center gap-1 text-xs font-semibold text-primary">
            <ChevronLeft className="h-4 w-4" /> Alla verktyg
          </button>
          <div>
            <p className="text-sm font-bold">{active.title}</p>
            <p className="text-[11px] text-muted-foreground">{active.subtitle}. Sparat innehåll syns direkt för alla, även i webbappen.</p>
          </div>
          <Suspense fallback={<Loader2 className="mx-auto my-4 h-4 w-4 animate-spin" />}>{active.content(ctx)}</Suspense>
        </div>
      )}

      {open && !active && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Här ändrar du det appen redan visar. Det slår igenom för alla utan en ny version, även i webbappen.
            {settings.banner_message.trim() ? " Ett meddelande visas överst just nu." : ""}
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök verktyg"
              className="w-full rounded-xl border border-input bg-background py-2 pl-8 pr-3 text-sm outline-none"
            />
          </div>
          {groups.map((group) => {
            const items = group.items.filter((t) => !q || `${t.title} ${t.subtitle} ${t.keywords}`.toLowerCase().includes(q));
            if (!items.length) return null;
            return (
              <div key={group.id}>
                <p className="text-xs font-semibold">{group.title}</p>
                <p className="mb-1 text-[10px] text-muted-foreground">{group.hint}</p>
                <div className="divide-y divide-border/70">
                  {items.map((tool) => (
                    <ToolButton key={tool.id} tool={tool} onOpen={() => setActiveId(tool.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
