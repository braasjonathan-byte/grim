import { useState } from "react";
import { Check, MessageSquare, ChevronDown, ChevronUp, Dumbbell, Footprints, Moon, Bike } from "lucide-react";
import type { WorkoutDay, Profile, CompletionData } from "@/data/workoutData";
import { getCompletion, setCompletion } from "@/data/workoutData";

interface WorkoutCardProps {
  workout: WorkoutDay;
  profile: Profile;
  onUpdate: () => void;
}

const getSessionIcon = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return Dumbbell;
  if (s.includes("löpning") || s.includes("jogg") || s.includes("långpass")) return Footprints;
  if (s.includes("cykel") || s.includes("återhämtning")) return Bike;
  return Moon;
};

const getSessionColor = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return "text-primary";
  if (s.includes("löpning") || s.includes("tröskel")) return "text-warning";
  if (s.includes("långpass")) return "text-destructive";
  if (s.includes("vila")) return "text-muted-foreground";
  return "text-secondary-foreground";
};

const isRestDay = (session: string) => {
  const s = session.toLowerCase();
  return s.includes("vila") || s.includes("återhämtning");
};

const WorkoutCard = ({ workout, profile, onUpdate }: WorkoutCardProps) => {
  const completion = getCompletion(profile, workout.week, workout.day);
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState(completion.userComment);
  const Icon = getSessionIcon(workout.session);
  const colorClass = getSessionColor(workout.session);
  const rest = isRestDay(workout.session);

  const toggleDone = () => {
    const newData: CompletionData = {
      done: !completion.done,
      userComment: comment,
    };
    setCompletion(profile, workout.week, workout.day, newData);
    onUpdate();
  };

  const saveComment = () => {
    setCompletion(profile, workout.week, workout.day, {
      ...completion,
      userComment: comment,
    });
    onUpdate();
  };

  return (
    <div
      className={`rounded-lg border bg-card transition-all animate-fade-in ${
        completion.done ? "workout-done opacity-80" : ""
      } ${rest ? "workout-rest" : ""}`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Done toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleDone();
          }}
          className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
            completion.done
              ? "bg-success border-success"
              : "border-muted-foreground/30 hover:border-primary"
          }`}
        >
          {completion.done && <Check className="w-4 h-4 text-success-foreground" />}
        </button>

        {/* Icon */}
        <div className={`flex-shrink-0 ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-mono text-muted-foreground uppercase">
              {workout.day}
            </span>
            <span className={`font-semibold text-sm truncate ${completion.done ? "line-through text-muted-foreground" : ""}`}>
              {workout.session}
            </span>
          </div>
          {workout.tempo && workout.tempo !== "—" && (
            <span className="text-xs text-muted-foreground font-mono">
              {workout.tempo}
            </span>
          )}
        </div>

        {/* Expand */}
        <div className="text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Details */}
          <div>
            <p className="text-sm text-foreground leading-relaxed">{workout.details}</p>
          </div>

          {/* Pre-filled comment from plan */}
          {workout.comment && (
            <div className="text-xs text-muted-foreground bg-secondary rounded-md p-2">
              📝 {workout.comment}
            </div>
          )}

          {/* User comment */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onBlur={saveComment}
                onKeyDown={(e) => e.key === "Enter" && saveComment()}
                placeholder="Lägg till kommentar..."
                className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutCard;
