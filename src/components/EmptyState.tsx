import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  emoji?: string;
}

const EmptyState = ({ icon: Icon, title, description, emoji }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-10 px-4 space-y-3">
    <div className="relative">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      {emoji && (
        <span className="absolute -top-1 -right-2 text-lg" aria-hidden="true">
          {emoji}
        </span>
      )}
    </div>
    <h3 className="text-sm font-semibold text-foreground text-center">{title}</h3>
    {description && (
      <p className="text-xs text-muted-foreground text-center max-w-[220px] leading-relaxed">
        {description}
      </p>
    )}
  </div>
);

export default EmptyState;
