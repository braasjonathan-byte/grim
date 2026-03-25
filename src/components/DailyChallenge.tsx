import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Swords, Check, X, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const challenges = [
  "20 armhävningar 💪",
  "30 squats 🦵",
  "1 minut planka 🧘",
  "40 situps 🔥",
  "50 jumping jacks ⭐",
  "15 burpees 🥵",
  "20 lunges per ben 🏃",
  "25 tricep dips 💎",
  "30 sekunders väggstol 🧱",
  "10 pike push-ups 🤸",
  "20 mountain climbers 🏔️",
  "15 jump squats 🚀",
  "40 höga knän 🦿",
  "1 minut hälspark 🔄",
  "20 diamant-armhävningar 💠",
  "30 calf raises 🦶",
  "15 superman holds (3 sek) 🦸",
  "25 ryska twists 🌀",
  "20 glute bridges 🍑",
  "10 handstående mot vägg (5 sek) 🤚",
  "3×10 bakåtfällning 🔙",
  "50 steg lungewalk 🚶",
  "20 decline push-ups 📐",
  "30 flutter kicks 🦋",
  "45 sekunders sidoplanka per sida ⚖️",
  "15 box jumps (eller trappsteg) 📦",
  "20 commando planks 🎖️",
  "30 bicycle crunches 🚲",
  "2 minuter skipping (utan rep) 🤾",
  "10 pistol squats per ben 🔫",
  "25 push-up shoulder taps 👋",
];

const getDailyChallenge = (): string => {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return challenges[dayOfYear % challenges.length];
};

const getTodayStr = () => new Date().toISOString().slice(0, 10);

interface DailyChallengeProps {
  userId: string;
  onComplete?: (challengeText: string) => void;
}

const DailyChallenge = ({ userId, onComplete }: DailyChallengeProps) => {
  const [status, setStatus] = useState<"loading" | "show" | "completed" | "declined">("loading");
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const challenge = useMemo(() => getDailyChallenge(), []);
  const today = useMemo(() => getTodayStr(), []);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from("daily_challenge_completions")
        .select("id")
        .eq("user_id", userId)
        .eq("challenge_date", today)
        .maybeSingle();

      if (data) {
        setStatus("completed");
        return;
      }

      const declined = localStorage.getItem(`challenge_declined_${today}`);
      if (declined) {
        setStatus("declined");
        return;
      }

      setStatus("show");
    };
    check();
  }, [userId, today]);

  const handleAccept = async () => {
    await supabase.from("daily_challenge_completions").insert({
      user_id: userId,
      challenge_date: today,
      challenge_text: challenge,
    });
    setStatus("completed");
    onComplete?.(challenge);
  };

  const handleDecline = () => {
    setShowDeclineConfirm(true);
  };

  const confirmDecline = () => {
    localStorage.setItem(`challenge_declined_${today}`, "1");
    setShowDeclineConfirm(false);
    setStatus("declined");
  };

  if (status === "loading" || status === "declined") return null;

  if (status === "completed") {
    return (
      <div className="bg-muted/30 border border-border rounded-lg p-2.5 flex items-center gap-2.5">
        <Swords className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Utmaning klarad</p>
          <p className="text-[11px] text-muted-foreground truncate">{challenge}</p>
        </div>
        <Check className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-muted/20 border border-border rounded-lg p-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Swords className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dagens utmaning</p>
        </div>
        <p className="text-xs font-semibold text-foreground mb-2">{challenge}</p>
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] font-semibold rounded-md bg-muted text-foreground hover:bg-muted/80 transition-colors"
          >
            <Check className="w-3 h-3" />
            Klarad
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] font-semibold rounded-md bg-muted/50 text-muted-foreground hover:bg-muted/70 transition-colors"
          >
            <X className="w-3 h-3" />
            Neka
          </button>
        </div>
      </div>

      <AlertDialog open={showDeclineConfirm} onOpenChange={setShowDeclineConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
              Neka utmaningen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill neka dagens utmaning? Du kan inte ångra detta idag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDecline} className="bg-muted text-foreground hover:bg-muted/80">
              Ja, neka
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DailyChallenge;
