import { ArrowDown, ArrowUp } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { STATS_SECTIONS, useStatsSettings, type StatsSection } from "@/lib/statsSettings";

export default function StatsLayoutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const layout = useStatsSettings();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Anpassa statistik</SheetTitle>
          <SheetDescription>Välj vad som syns och i vilken ordning. Det sparas på den här enheten.</SheetDescription>
        </SheetHeader>
        <ul className="mt-4 divide-y divide-border">
          {layout.order.map((key) => {
            const section = STATS_SECTIONS.find((item) => item.key === key);
            if (!section) return null;
            const on = layout.isVisible(key);
            return (
              <li key={key} className="flex items-center gap-2 py-2.5">
                <button
                  type="button"
                  onClick={() => layout.toggle(key)}
                  aria-pressed={on}
                  className={`h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-secondary border border-border"}`}
                  aria-label={`Visa ${section.label}`}
                >
                  <span className={`block h-5 w-5 rounded-full transition-transform ${on ? "translate-x-5 bg-primary-foreground" : "translate-x-0.5 bg-muted-foreground"}`} />
                </button>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${on ? "" : "text-muted-foreground"}`}>{section.label}</span>
                  {section.hint && <span className="block text-[11px] text-muted-foreground">{section.hint}</span>}
                </span>
                <button type="button" aria-label="Flytta upp" onClick={() => layout.move(key, -1)} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Flytta ner" onClick={() => layout.move(key, 1)} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                  <ArrowDown className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => layout.reset()} className="mt-3 text-xs font-semibold text-muted-foreground">
          Återställ ordning och visa allt
        </button>
      </SheetContent>
    </Sheet>
  );
}

export type { StatsSection };
