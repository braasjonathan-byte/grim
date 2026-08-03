import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  emoji?: string;
  /** Primary call-to-action label — always pair it with onAction */
  actionLabel?: string;
  onAction?: () => void;
  /** Optional secondary call-to-action */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

const EmptyState = ({
  icon: Icon,
  title,
  description,
  emoji,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) => (
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
      <p className="text-xs text-muted-foreground text-center max-w-[240px] leading-relaxed">
        {description}
      </p>
    )}
    {(actionLabel && onAction) || (secondaryLabel && onSecondary) ? (
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="pill-btn bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="pill-btn-ghost shadow-soft px-4 py-2 text-xs font-semibold"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    ) : null}
  </div>
);

export default EmptyState;
