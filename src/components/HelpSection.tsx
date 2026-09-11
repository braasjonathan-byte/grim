import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { helpCategories } from "@/data/helpTopics";
import GuidedTourCard from "@/components/GuidedTourCard";

const HelpSection = () => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <GuidedTourCard />

      <div className="rounded-2xl bg-card shadow-soft border border-border/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <HelpCircle className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Hjälp & tips</h3>
        </div>

        <div className="divide-y divide-border/40">
          {helpCategories.map((cat) => {
            const isOpen = expandedCategory === cat.title;
            const Icon = cat.icon;
            return (
              <div key={cat.title}>
                <button
                  onClick={() => setExpandedCategory(isOpen ? null : cat.title)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{cat.title}</span>
                    <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5">
                      {cat.tips.length}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <ul className="px-4 pb-3 space-y-2">
                    {cat.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                        <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HelpSection;
