import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY = "grim_profile_banner_dismissed_v1";

interface Props {
  userId: string;
  onOpenProfile?: () => void;
}

/**
 * Discreet banner shown on the Tools tab when key fitness profile fields are missing.
 * Helps the AI give better suggestions. Dismissable.
 */
const ProfileCompletenessBanner = ({ userId, onOpenProfile }: Props) => {
  const [missing, setMissing] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<boolean>(() => !!localStorage.getItem(DISMISS_KEY));

  useEffect(() => {
    if (dismissed || !userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("age, gender, weight_kg")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const m: string[] = [];
      if (!data.age) m.push("ålder");
      if (!data.gender) m.push("kön");
      if (!(data as any).weight_kg) m.push("vikt");
      setMissing(m);
    })();
    return () => { cancelled = true; };
  }, [userId, dismissed]);

  if (dismissed || missing.length === 0) return null;

  return (
    <div className="bg-primary/10 border border-primary/30 px-3 py-2.5 mb-3 flex items-start gap-2.5">
      <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground font-medium">
          Komplettera din profil för bättre AI-förslag
        </p>
        <p className="text-[11px] text-muted-foreground">
          Saknas: {missing.join(", ")}
        </p>
        {onOpenProfile && (
          <button
            onClick={onOpenProfile}
            className="text-[11px] text-primary font-bold mt-1 underline underline-offset-2"
          >
            Komplettera nu →
          </button>
        )}
      </div>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Stäng"
        className="text-muted-foreground p-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default ProfileCompletenessBanner;
