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
  /** Fyll ut tomma vyer (Mina pass, Vänner, Chatt, Grupper) så att innehållet hamnar mitt i skärmen */
  fill?: boolean;
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
  fill = false,
}: EmptyStateProps) => (
  <div className={`flex flex-col items-center justify-center py-12 px-4 space-y-3 ${fill ? "min-h-[50vh]" : ""}`}>
    <div className="relative mb-1">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-9 h-9" strokeWidth={1.75} />
      </div>
      {emoji && (
        <span className="absolute -top-1 -right-2 text-lg" aria-hidden="true">
          {emoji}
        </span>
      )}
    </div>
    <h3 className="text-base font-bold font-sans text-foreground text-center">{title}</h3>
    {description && (
      <p className="text-sm text-muted-foreground text-center max-w-[260px] leading-relaxed">
        {description}
      </p>
    )}
    {(actionLabel && onAction) || (secondaryLabel && onSecondary) ? (
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="pill-btn-primary px-5 py-2.5 text-sm font-semibold"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="pill-btn-ghost px-5 py-2.5 text-sm font-semibold"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    ) : null}
  </div>
);

export default EmptyState;
