import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Medal, Crown, ChevronLeft, ChevronRight } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";

interface LeaderboardProps {
  userId: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

interface LeaderboardEntry {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  done_count: number;
  is_honorary: boolean;
}

const Leaderboard = ({ userId }: LeaderboardProps) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .rpc("get_leaderboard", {
        filter_year: year,
        filter_month: month,
      })
      .then(({ data }) => {
        if (data) {
          setEntries(
            (data as any[]).map((d) => ({
              ...d,
              done_count: Number(d.done_count),
            }))
          );
        }
        setLoading(false);
      });
  }, [year, month]);

  const handlePrevMonth = () => {
    if (month === null) {
      setYear((y) => y - 1);
    } else if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => (m ?? 1) - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === null) {
      setYear((y) => y + 1);
    } else if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => (m ?? 1) + 1);
    }
  };

  const toggleAllYear = () => {
    setMonth(month === null ? now.getMonth() + 1 : null);
  };

  const getMedalColor = (index: number) => {
    if (index === 0) return "text-warning";
    if (index === 1) return "text-muted-foreground";
    if (index === 2) return "text-orange-400";
    return "text-muted-foreground/40";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Medal className="w-5 h-5 text-warning" />
        <h3 className="text-lg font-bold tracking-tight">Topplista</h3>
      </div>

      {/* Filter controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <button
            onClick={toggleAllYear}
            className="text-sm font-bold hover:text-primary transition-colors"
          >
            {month === null ? `Hela ${year}` : `${MONTHS[month - 1]} ${year}`}
          </button>
          <p className="text-[10px] text-muted-foreground">
            {month === null ? "Tryck för att visa per månad" : "Tryck för att visa hela året"}
          </p>
        </div>
        <button
          onClick={handleNextMonth}
          className="p-1.5 rounded-lg bg-secondary text-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Entries */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Laddar...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Inga registrerade pass</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, i) => (
            <div
              key={entry.user_id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                entry.user_id === userId
                  ? "bg-primary/5 border-primary/30"
                  : "bg-card border-border"
              }`}
            >
              {/* Rank */}
              <div className="w-7 text-center flex-shrink-0">
                {i < 3 ? (
                  <Medal className={`w-5 h-5 mx-auto ${getMedalColor(i)}`} />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <div className="relative w-8 h-8 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt={entry.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-primary">{entry.nickname[0]?.toUpperCase()}</span>
                  )}
                </div>
                {entry.is_honorary && (
                  <div className="absolute -top-1.5 -left-1.5 z-10 -rotate-[22deg]">
                    <Crown className="w-4 h-4 text-warning" />
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate">{entry.nickname}</span>
                {entry.is_honorary && <HonoraryBadge size="sm" />}
              </div>

              {/* Count */}
              <span className="text-sm font-black text-primary">{entry.done_count}</span>
              <span className="text-[10px] text-muted-foreground">pass</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
