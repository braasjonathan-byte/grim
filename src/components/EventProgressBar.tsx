import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

interface EventProgressBarProps {
  userId: string;
}

const EventProgressBar = ({ userId }: EventProgressBarProps) => {
  const [event, setEvent] = useState<{ event_name: string; event_date: string; created_at: string } | null>(null);

  useEffect(() => {
    // Get the closest upcoming event
    supabase
      .from("event_countdowns")
      .select("event_name, event_date, created_at")
      .eq("user_id", userId)
      .gte("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEvent(data);
      });
  }, [userId]);

  if (!event) return null;

  const now = new Date();
  const eventDate = new Date(event.event_date);
  const createdDate = new Date(event.created_at);
  const totalDays = differenceInDays(eventDate, createdDate);
  const daysLeft = differenceInDays(eventDate, now);

  if (daysLeft < 0 || totalDays <= 0) return null;

  const progress = Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100));

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate max-w-[60%]">
          {event.event_name}
        </span>
        <span className="text-[10px] font-bold text-muted-foreground">
          {daysLeft} {daysLeft === 1 ? "dag" : "dagar"} kvar
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, hsl(var(--muted-foreground) / 0.4), hsl(var(--muted-foreground) / 0.6), hsl(var(--muted-foreground) / 0.2))",
          }}
        />
      </div>
    </div>
  );
};

export default EventProgressBar;
