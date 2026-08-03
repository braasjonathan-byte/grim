import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SettingsSectionProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "danger";
}

/** Collapsible soft card used across the profile / settings surface. */
const SettingsSection = ({ title, icon: Icon, children, defaultOpen = true, tone = "default" }: SettingsSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const danger = tone === "danger";

  return (
    <section
      className={`rounded-2xl shadow-soft border p-4 ${
        danger ? "bg-destructive/5 border-destructive/30" : "bg-card border-border/40"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${danger ? "text-destructive" : "text-primary"}`} />
          <span className={`text-sm font-bold ${danger ? "text-destructive" : ""}`}>{title}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="pt-4">{children}</div>}
    </section>
  );
};

export default SettingsSection;
