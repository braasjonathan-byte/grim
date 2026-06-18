import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticLight } from "@/lib/haptics";

interface WorkoutCheerButtonProps {
  toUserId: string;
  fromUserId: string;
  week: number | null;
  day: string | null;
}

const EMOJIS = ["💪", "🔥", "👏", "🚀", "🦾"];

const WorkoutCheerButton = ({ toUserId, fromUserId, week, day }: WorkoutCheerButtonProps) => {
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
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={sending}
        className="flex items-center gap-1.5 text-sm disabled:opacity-50"
        aria-label="Skicka hejarop"
      >
        <span className="text-base leading-none">{sentEmoji || "💪"}</span>
        <span className="text-xs text-muted-foreground">Hejarop</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-[100] bg-card border-2 border-border p-2 flex gap-1 shadow-lg">
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
