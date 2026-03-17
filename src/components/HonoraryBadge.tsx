import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HonoraryBadgeProps {
  size?: "xs" | "sm" | "md";
  className?: string;
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

const HonoraryBadge = ({ size = "sm", className }: HonoraryBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full bg-warning/15 text-warning font-bold whitespace-nowrap flex-shrink-0",
      sizeStyles[size],
      className
    )}
  >
    <Crown className={iconSizes[size]} />
    Hedersmedlem
  </span>
);

export default HonoraryBadge;
