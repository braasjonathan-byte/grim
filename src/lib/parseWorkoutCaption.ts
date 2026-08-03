import type { LucideIcon } from "lucide-react";
import { Activity, Bike, Dumbbell, Footprints, Heart, Ruler, Timer, Waves, Weight } from "lucide-react";

export type ChipTone = "primary" | "success" | "warning" | "muted";

export interface CaptionStatChip {
  icon: LucideIcon;
  label: string;
  tone: ChipTone;
}

export type WorkoutKind = "strength" | "running" | "cycling" | "swimming" | "other";

export interface CaptionExercise {
  name: string;
  detail: string;
}

interface ParsedCaption {
  chips: CaptionStatChip[];
  text: string;
  title: string;
  kind: WorkoutKind;
  exercises: CaptionExercise[];
}

const STAT_MATCHERS: {
  emoji: string;
  icon: LucideIcon;
  tone: ChipTone;
  format: (rest: string) => string;
}[] = [
  { emoji: "📏", icon: Ruler, tone: "primary", format: (r) => r },
  { emoji: "⏱", icon: Timer, tone: "muted", format: (r) => r },
  { emoji: "❤️", icon: Heart, tone: "warning", format: (r) => r },
  { emoji: "💪", icon: Dumbbell, tone: "success", format: (r) => r },
  { emoji: "🏋️‍♂️", icon: Weight, tone: "primary", format: (r) => r.replace(/\s*volym$/i, "") },
  { emoji: "🏋️", icon: Weight, tone: "primary", format: (r) => r.replace(/\s*volym$/i, "") },
];

const parseToken = (token: string): CaptionStatChip | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;
  for (const matcher of STAT_MATCHERS) {
    if (trimmed.startsWith(matcher.emoji)) {
      const rest = trimmed.slice(matcher.emoji.length).trim();
      if (!rest) return null;
      return { icon: matcher.icon, label: matcher.format(rest), tone: matcher.tone };
    }
  }
  return null;
};

const LEADING_EMOJI = /^[\p{Extended_Pictographic}\u200d\ufe0f]+\s*/u;

const detectKind = (title: string): WorkoutKind => {
  const n = title.toLowerCase();
  if (/löp|jogg|spring|interval|tröskel|långpass|km-pass|5k|10k|maraton/.test(n)) return "running";
  if (/cykel|cykl|spinning|bike|brick/.test(n)) return "cycling";
  if (/sim|crawl|bröstsim|pool/.test(n)) return "swimming";
  if (/styrka|helkropp|överkropp|underkropp|push|pull|ben|bröst|rygg|axlar|arm|gym/.test(n)) return "strength";
  return "other";
};

export const WORKOUT_KIND_META: Record<WorkoutKind, { icon: LucideIcon; accent: string; badge: string }> = {
  strength: { icon: Dumbbell, accent: "bg-primary", badge: "bg-primary/15 text-primary" },
  running: { icon: Footprints, accent: "bg-warning", badge: "bg-warning/15 text-warning" },
  cycling: { icon: Bike, accent: "bg-success", badge: "bg-success/15 text-success" },
  swimming: { icon: Waves, accent: "bg-primary", badge: "bg-primary/15 text-primary" },
  other: { icon: Activity, accent: "bg-muted-foreground/40", badge: "bg-secondary text-foreground/70" },
};

export const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-secondary text-foreground/70",
};

/**
 * Splits an auto-generated workout caption into a title, stat chips, a
 * per-exercise log list and the remaining free text. Captions without a
 * recognisable structure degrade gracefully to plain text.
 */
export const parseWorkoutCaption = (caption: string | null | undefined): ParsedCaption => {
  if (!caption) return { chips: [], text: "", title: "", kind: "other", exercises: [] };

  const lines = caption.split("\n");
  const chips: CaptionStatChip[] = [];
  const exercises: CaptionExercise[] = [];
  const kept: string[] = [];
  let title = "";

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Title: first non-empty line starting with an emoji
    if (!title && index < 2 && trimmed && LEADING_EMOJI.test(trimmed)) {
      title = trimmed.replace(LEADING_EMOJI, "").trim();
      return;
    }

    // Exercise bullet lines
    if (/^[•\-*]\s+/.test(trimmed)) {
      const body = trimmed.replace(/^[•\-*]\s+/, "");
      const sepIndex = body.indexOf(":");
      if (sepIndex > 0) {
        exercises.push({ name: body.slice(0, sepIndex).trim(), detail: body.slice(sepIndex + 1).trim() });
      } else {
        exercises.push({ name: body, detail: "" });
      }
      return;
    }

    const tokens = line.split("·");
    const parsed = tokens.map(parseToken);
    const isStatLine = trimmed.length > 0 && parsed.every((p) => p !== null);
    if (isStatLine) {
      parsed.forEach((p) => p && chips.push(p));
    } else {
      kept.push(line);
    }
  });

  const text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { chips, text, title, kind: detectKind(title || text), exercises };
};
