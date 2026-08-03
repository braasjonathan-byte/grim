import type { LucideIcon } from "lucide-react";
import { Dumbbell, Heart, Ruler, Timer, Weight } from "lucide-react";

export interface CaptionStatChip {
  icon: LucideIcon;
  label: string;
}

interface ParsedCaption {
  chips: CaptionStatChip[];
  text: string;
}

const STAT_MATCHERS: { emoji: string; icon: LucideIcon; format: (rest: string) => string }[] = [
  { emoji: "📏", icon: Ruler, format: (r) => r },
  { emoji: "⏱", icon: Timer, format: (r) => r },
  { emoji: "❤️", icon: Heart, format: (r) => r },
  { emoji: "💪", icon: Dumbbell, format: (r) => r },
  { emoji: "🏋️‍♂️", icon: Weight, format: (r) => r.replace(/\s*volym$/i, "") },
  { emoji: "🏋️", icon: Weight, format: (r) => r.replace(/\s*volym$/i, "") },
];

const parseToken = (token: string): CaptionStatChip | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;
  for (const matcher of STAT_MATCHERS) {
    if (trimmed.startsWith(matcher.emoji)) {
      const rest = trimmed.slice(matcher.emoji.length).trim();
      if (!rest) return null;
      return { icon: matcher.icon, label: matcher.format(rest) };
    }
  }
  return null;
};

/**
 * Splits an auto-generated workout caption into stat chips (sets, volume,
 * distance, pace, pulse) and the remaining caption text. Captions without a
 * recognisable stat line are returned unchanged with no chips.
 */
export const parseWorkoutCaption = (caption: string | null | undefined): ParsedCaption => {
  if (!caption) return { chips: [], text: "" };

  const lines = caption.split("\n");
  const chips: CaptionStatChip[] = [];
  const kept: string[] = [];

  for (const line of lines) {
    const tokens = line.split("·");
    const parsed = tokens.map(parseToken);
    const isStatLine = line.trim().length > 0 && parsed.every((p) => p !== null);
    if (isStatLine) {
      parsed.forEach((p) => p && chips.push(p));
    } else {
      kept.push(line);
    }
  }

  const text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { chips, text };
};
