import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hapticMedium } from "@/lib/haptics";

interface CheerOverlay {
  id: string;
  emoji: string;
  fromNickname: string;
}

/**
 * Listens for incoming workout_cheers via Realtime and renders an animated
 * floating emoji overlay when one arrives. Mount once near the app root.
 */
const WorkoutCheerListener = ({ userId }: { userId: string }) => {
  const [overlays, setOverlays] = useState<CheerOverlay[]>([]);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`cheers-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workout_cheers",
          filter: `to_user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          // Ignore historical replays older than mount
          if (row?.created_at && new Date(row.created_at).getTime() < mountedAt.current - 5000) return;

          // Fetch sender nickname
          let nickname = "En vän";
          if (row.from_user_id) {
            const { data } = await supabase
              .from("profiles")
              .select("nickname")
              .eq("user_id", row.from_user_id)
              .maybeSingle();
            if (data?.nickname) nickname = data.nickname;
          }

          const overlay: CheerOverlay = {
            id: row.id || `${Date.now()}`,
            emoji: row.emoji || "💪",
            fromNickname: nickname,
          };
          hapticMedium();
          setOverlays((prev) => [...prev, overlay]);
          setTimeout(() => {
            setOverlays((prev) => prev.filter((o) => o.id !== overlay.id));
          }, 3500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (overlays.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[500] pointer-events-none flex items-center justify-center">
      {overlays.map((o, idx) => (
        <div
          key={o.id}
          className="absolute animate-cheer-pop flex flex-col items-center"
          style={{ animationDelay: `${idx * 100}ms` }}
        >
          <span className="text-7xl drop-shadow-lg">{o.emoji}</span>
          <span className="mt-2 text-sm font-black bg-card border-2 border-border px-3 py-1">
            {o.fromNickname}
          </span>
        </div>
      ))}
      <style>{`
        @keyframes cheer-pop {
          0% { opacity: 0; transform: scale(0.4) translateY(40px); }
          15% { opacity: 1; transform: scale(1.15) translateY(0); }
          70% { opacity: 1; transform: scale(1) translateY(-20px); }
          100% { opacity: 0; transform: scale(0.95) translateY(-60px); }
        }
        .animate-cheer-pop { animation: cheer-pop 3.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default WorkoutCheerListener;
