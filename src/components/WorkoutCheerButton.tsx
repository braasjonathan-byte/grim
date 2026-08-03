import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticLight } from "@/lib/haptics";

interface WorkoutCheerButtonProps {
  toUserId: string;
  fromUserId: string;
  week: number | null;
  day: string | null;
  fullWidth?: boolean;
}

const EMOJIS = ["💪", "🔥", "👏", "🚀", "🦾"];

const WorkoutCheerButton = ({ toUserId, fromUserId, week, day, fullWidth = false }: WorkoutCheerButtonProps) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentEmoji, setSentEmoji] = useState<string | null>(null);

  if (toUserId === fromUserId) return null;

  const sendCheer = async (emoji: string) => {
    setSending(true);
    hapticLight();
    const { error } = await supabase.from("workout_cheers").insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      emoji,
      workout_week: week,
      workout_day: day,
    } as any);
    setSending(false);
    setOpen(false);
    if (error) {
      toast.error("Kunde inte skicka hejarop");
      return;
    }
    setSentEmoji(emoji);
    toast.success(`${emoji} skickat!`);
    setTimeout(() => setSentEmoji(null), 2500);
  };

  return (
    <div className={`relative inline-flex ${fullWidth ? "flex-1" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={sending}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${
          fullWidth ? "w-full" : ""
        } ${
          sentEmoji
            ? "border-success/40 bg-success/15 text-success"
            : "border-border/60 bg-secondary/50 text-muted-foreground hover:bg-accent"
        }`}
        aria-label="Skicka hejarop"
      >
        <span className="text-sm leading-none">{sentEmoji || "💪"}</span>
        <span>Hejarop</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-[100] bg-card border border-border rounded-2xl p-2 flex gap-1 shadow-lg">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => sendCheer(e)}
                disabled={sending}
                className="text-2xl hover:scale-125 transition-transform p-1 disabled:opacity-50"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default WorkoutCheerButton;
