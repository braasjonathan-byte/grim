import { useEffect, useState } from "react";
import { Sparkles, Lock, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadIdentityTitles, type IdentityTitle } from "@/lib/identityTitles";
import { toast } from "sonner";

interface IdentityTitleCardProps {
  userId: string;
}

/**
 * Personal identity marker: behaviour-unlocked titles the user can pick from.
 * The chosen title is stored on the profile and shown to friends.
 */
const IdentityTitleCard = ({ userId }: IdentityTitleCardProps) => {
  const [titles, setTitles] = useState<IdentityTitle[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ titles: list }, profileRes] = await Promise.all([
        loadIdentityTitles(userId),
        supabase.from("profiles").select("display_title").eq("user_id", userId).maybeSingle(),
      ]);
      if (!active) return;
      setTitles(list);
      setSelected(((profileRes.data as any)?.display_title as string) || null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const unlocked = titles.filter((t) => t.unlocked);
  const locked = titles.filter((t) => !t.unlocked);
  const current = titles.find((t) => t.id === selected) || unlocked[0] || null;
  const nextUp = locked.slice(0, showAll ? locked.length : 3);

  const choose = async (id: string) => {
    setSelected(id);
    const { error } = await supabase.from("profiles").update({ display_title: id } as any).eq("user_id", userId);
    if (error) toast.error("Kunde inte spara titeln");
    else toast.success("Din titel är uppdaterad");
  };

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">Din titel</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-primary/10 border border-primary/25 p-4 text-center">
            <p className="text-3xl leading-none">{current?.emoji ?? "🌱"}</p>
            <p className="text-lg font-bold mt-1.5">{current?.label ?? "Ingen titel än"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {current ? "Syns för dina vänner" : "Slutför ditt första pass för att låsa upp en titel"}
            </p>
          </div>

          {unlocked.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Upplåsta titlar
              </p>
              <div className="flex flex-wrap gap-2">
                {unlocked.map((t) => {
                  const isActive = current?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => choose(t.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-foreground border-border/60"
                      }`}
                    >
                      <span>{t.emoji}</span>
                      {t.label}
                      {isActive && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {locked.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                På väg att låsas upp
              </p>
              {nextUp.map((t) => (
                <div key={t.id} className="rounded-xl bg-secondary/60 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base opacity-60">{t.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        {t.label}
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      </p>
                      <p className="text-[11px] text-muted-foreground">{t.requirement}</p>
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {Math.round(t.progress * 100)} %
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-background overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                  </div>
                </div>
              ))}
              {locked.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs font-semibold text-primary"
                >
                  {showAll ? "Visa färre" : `Visa alla ${locked.length} titlar`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IdentityTitleCard;
