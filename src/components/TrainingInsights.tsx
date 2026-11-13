import { useEffect, useState } from "react";
import { loadWorkoutHistory, WORKOUTS_CHANGED_EVENT } from "@/lib/workoutHistory";
import { insightAnswers, type InsightAnswer } from "@/lib/trainingInsights";
import { supabase } from "@/integrations/supabase/client";
import { WEIGHT_CHANGED_EVENT } from "@/lib/bodyWeight";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp } from "lucide-react";

export default function TrainingInsights({ userId }: { userId: string }) {
  const [answers, setAnswers] = useState<InsightAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    Promise.all([loadWorkoutHistory(userId), supabase.from("body_weight_logs").select("log_date,weight_kg").eq("user_id", userId).order("log_date")]).then(([sessions, weights]) => {
      if (weights.error) throw weights.error;
      if (!cancelled) setAnswers(insightAnswers(sessions, (weights.data || []).map(row => ({ ...row, weight_kg: Number(row.weight_kg) }))));
    })
      .catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, retry]);
  useEffect(() => {
    const refresh = () => setRetry(n => n + 1);
    window.addEventListener(WEIGHT_CHANGED_EVENT, refresh);
    window.addEventListener(WORKOUTS_CHANGED_EVENT, refresh);
    return () => { window.removeEventListener(WEIGHT_CHANGED_EVENT, refresh); window.removeEventListener(WORKOUTS_CHANGED_EVENT, refresh); };
  }, []);
  return <section aria-label="Din utveckling" className="space-y-3 border-y border-border py-4">
    <h3 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary" />Din utveckling</h3>
    {loading ? <p className="text-sm text-muted-foreground" role="status">Hämtar dina resultat…</p> : error ? <div className="space-y-2" role="alert"><p className="text-sm text-muted-foreground">Resultaten kunde inte hämtas.</p><Button size="sm" variant="outline" onClick={() => setRetry(n => n + 1)}><RefreshCw className="h-4 w-4" /> Försök igen</Button></div> : answers.map(answer => <div key={answer.question} className="space-y-2 border-t border-border pt-3"><h4 className="text-sm font-semibold">{answer.question}</h4><p className="text-xs text-muted-foreground">{answer.period}</p>{answer.items.map(item => <div key={item.title}><p className="text-sm font-medium">{item.title}</p><p className="text-xs leading-relaxed text-muted-foreground">{item.detail}</p></div>)}</div>)}
  </section>;
}