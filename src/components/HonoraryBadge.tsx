import { Crown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface HonoraryBadgeProps {
  size?: "xs" | "sm" | "md";
  className?: string;
  /** When provided, special users (e.g. "Grim") render as "Skapare" instead of "Hedersmedlem". */
  nickname?: string | null;
}

const sizeStyles = {
  xs: "px-1.5 py-0.5 text-[9px] gap-0.5",
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1",
};

const iconSizes = {
  xs: "w-2.5 h-2.5",
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
};

const ADMIN_NICKNAMES = new Set(["jonne"]);

const HonoraryBadge = ({ size = "sm", className, nickname }: HonoraryBadgeProps) => {
  const isAdmin = nickname ? ADMIN_NICKNAMES.has(nickname.trim().toLowerCase()) : false;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold whitespace-nowrap flex-shrink-0",
        isAdmin ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning",
        sizeStyles[size],
        className
      )}
    >
      {isAdmin ? (
        <Shield className={iconSizes[size]} />
      ) : (
        <Crown className={iconSizes[size]} />
      )}
      {isAdmin ? "Admin" : "Hedersmedlem"}
    </span>
  );
};

export default HonoraryBadge;
