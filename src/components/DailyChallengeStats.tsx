import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Swords } from "lucide-react";

interface DailyChallengeStatsProps {
  userId: string;
}

interface ChallengeRecord {
  challenge_date: string;
  challenge_text: string;
  completed_at: string;
}

const DailyChallengeStats = ({ userId }: DailyChallengeStatsProps) => {
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);

  useEffect(() => {
    supabase
      .from("daily_challenge_completions")
      .select("challenge_date, challenge_text, completed_at")
      .eq("user_id", userId)
      .order("challenge_date", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setChallenges(data);
      });
  }, [userId]);

  if (challenges.length === 0) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex items-center gap-2">
        <Swords className="w-5 h-5 text-warning" />
        <h3 className="text-base font-bold tracking-tight">Dagens utmaning</h3>
        <span className="text-xs text-muted-foreground ml-auto">{challenges.length} klarade</span>
      </div>
      <div className="space-y-1.5">
        {challenges.map((c) => (
          <div
            key={c.challenge_date}
            className="bg-card border border-border rounded-lg p-2.5 flex items-center gap-3"
          >
            <span className="text-xs text-muted-foreground font-mono w-14 flex-shrink-0">
              {new Date(c.challenge_date + "T00:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
            </span>
            <span className="text-xs font-medium flex-1 truncate">{c.challenge_text}</span>
            <span className="text-success text-xs">✅</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyChallengeStats;
