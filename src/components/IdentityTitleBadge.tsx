import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadIdentityTitles, type IdentityTitle } from "@/lib/identityTitles";

interface IdentityTitleBadgeProps {
  userId: string;
  className?: string;
}

/**
 * Read-only identity title badge, e.g. shown on a friend's profile.
 * Falls back to the highest unlocked title when no explicit pick exists.
 */
const IdentityTitleBadge = ({ userId, className = "" }: IdentityTitleBadgeProps) => {
  const [title, setTitle] = useState<IdentityTitle | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ titles }, profileRes] = await Promise.all([
        loadIdentityTitles(userId),
        supabase.from("profiles").select("display_title").eq("user_id", userId).maybeSingle(),
      ]);
      if (!active) return;
      const chosenId = ((profileRes.data as any)?.display_title as string) || null;
      const unlocked = titles.filter((t) => t.unlocked);
      setTitle(unlocked.find((t) => t.id === chosenId) || unlocked[0] || null);
    })();
    return () => { active = false; };
  }, [userId]);

  if (!title) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold ${className}`}
    >
      <span>{title.emoji}</span>
      {title.label}
    </span>
  );
};

export default IdentityTitleBadge;
