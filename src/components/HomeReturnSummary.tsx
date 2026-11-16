import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadWorkoutHistory, WORKOUTS_CHANGED_EVENT } from "@/lib/workoutHistory";
import { homeReturnSummary } from "@/lib/homeReturn";

export default function HomeReturnSummary({ userId, today, onOpenStats }: { userId: string; today: string; onOpenStats: () => void }) {
  const [summary, setSummary] = useState<ReturnType<typeof homeReturnSummary> | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let request = 0;
    setSummary(null);
    const load = async () => {
      const current = ++request;
      setFailed(false);
      try {
        const sessions = await loadWorkoutHistory(userId);
        if (!cancelled && current === request) setSummary(homeReturnSummary(sessions, today));
      } catch {
        if (!cancelled && current === request) setFailed(true);
      }
    };
    void load();
    window.addEventListener(WORKOUTS_CHANGED_EVENT, load);
    return () => { cancelled = true; window.removeEventListener(WORKOUTS_CHANGED_EVENT, load); };
  }, [userId, today, revision]);

  return <section className="border-b border-border py-4 space-y-3" aria-label="Senaste sju dagarna">
    <div className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold">Senaste sju dagarna</h2>
      <Button variant="ghost" size="icon" className="ml-auto shrink-0" onClick={onOpenStats} aria-label="Visa utvecklingen i Statistik"><ChevronRight className="h-5 w-5" /></Button>
    </div>
    {failed ? <div role="status" className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">Sammanfattningen kunde inte hämtas.</p>
      <Button variant="outline" size="icon" aria-label="Försök hämta sammanfattningen igen" onClick={() => setRevision(r => r + 1)}><RefreshCw className="h-4 w-4" /></Button>
    </div> : !summary ? <Skeleton className="h-16 w-full" /> : <>
      <p className="text-xs text-muted-foreground">{summary.from} – {summary.to} · registrerade pass</p>
      <p className="text-lg font-semibold tabular-nums">{summary.sessions} pass · {summary.days} träningsdagar</p>
      {summary.sessions > 0 ? <p className="text-xs text-muted-foreground">Föregående sju dagar: {summary.previousSessions} registrerade pass. Flera pass samma dag räknas som en träningsdag.</p> : <p className="text-sm text-muted-foreground">Inga registrerade pass under perioden. Det betyder inte att du inte har tränat.</p>}
      {summary.insight && <div className="space-y-1"><p className="text-sm font-semibold">{summary.insight.title}</p><p className="text-xs text-muted-foreground leading-relaxed">{summary.insight.detail}</p></div>}
    </>}
  </section>;
}