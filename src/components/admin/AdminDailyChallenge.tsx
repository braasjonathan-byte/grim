import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BUNDLED_CHALLENGES, resetDailyChallenges, saveDailyChallenges, useDailyChallenges, useLiveContentReady } from "@/lib/liveContent";
import UndoContentButton from "@/components/admin/UndoContentButton";

export default function AdminDailyChallenge({ userId }: { userId: string }) {
  const live = useDailyChallenges();
  const ready = useLiveContentReady();
  const [text, setText] = useState("");
  useEffect(() => { if (ready) setText(live.join("\n")); }, [ready, live]);

  const save = async () => {
    const list = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!list.length) return toast.error("Minst en utmaning");
    try {
      await saveDailyChallenges(list, userId);
      toast.success("Dagens utmaning är uppdaterad för alla");
    } catch (e: any) { toast.error(e?.message || "Kunde inte spara"); }
  };
  const reset = async () => {
    try {
      await resetDailyChallenges();
      setText(BUNDLED_CHALLENGES.join("\n"));
      toast.success("Återställd till originalet");
    } catch (e: any) { toast.error(e?.message || "Kunde inte återställa"); }
  };

  return (
    <div className="space-y-2 text-sm">
      <p className="text-[11px] text-muted-foreground">En rad per utmaning. Appen tar nästa i listan varje dag. Syns direkt för alla.</p>
      <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save}>Spara för alla</Button>
        <Button size="sm" variant="outline" onClick={reset}>Original</Button>
        <UndoContentButton contentKey="daily_challenges" userId={userId} />
      </div>
    </div>
  );
}
