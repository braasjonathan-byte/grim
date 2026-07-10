import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  id: string;
  user_id: string;
  week: number;
  day: string;
  updated_at: string;
  nickname: string | null;
  session_name: string;
  published: boolean;
}

const AdminCompletionsList = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: completions } = await supabase
        .from("workout_completions")
        .select("id,user_id,week,day,updated_at")
        .eq("done", true)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (!completions || completions.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const userIds = Array.from(new Set(completions.map((c) => c.user_id)));
      const keys = completions.map((c) => `${c.user_id}|${c.week}|${c.day}`);

      const [{ data: profiles }, { data: plans }, { data: posts }] = await Promise.all([
        supabase.from("profiles").select("user_id,nickname").in("user_id", userIds),
        supabase
          .from("workout_plans")
          .select("user_id,week,day,session_name,details")
          .in("user_id", userIds),
        supabase
          .from("social_posts")
          .select("user_id,workout_week,workout_day")
          .in("user_id", userIds)
          .not("workout_week", "is", null),
      ]);

      const nickMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.nickname]));
      const planMap = new Map<string, string>();
      (plans ?? []).forEach((p: any) => {
        const k = `${p.user_id}|${p.week}|${p.day}`;
        const existing = planMap.get(k) ?? "";
        const name = (p.session_name || "").trim();
        if (name) planMap.set(k, existing ? `${existing} + ${name}` : name);
      });
      const postSet = new Set(
        (posts ?? []).map((p: any) => `${p.user_id}|${p.workout_week}|${p.workout_day}`)
      );

      setRows(
        completions.map((c) => {
          const k = `${c.user_id}|${c.week}|${c.day}`;
          return {
            id: c.id,
            user_id: c.user_id,
            week: c.week,
            day: c.day,
            updated_at: c.updated_at,
            nickname: nickMap.get(c.user_id) ?? null,
            session_name: planMap.get(k) || "(namnlöst pass)",
            published: postSet.has(k),
          };
        })
      );
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="border border-border bg-secondary p-3 space-y-2">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        Senaste klarmarkerade pass (50)
      </h3>
      {rows && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga klarmarkerade pass.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows?.map((r) => (
            <li key={r.id} className="py-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">
                  {r.nickname || r.user_id.slice(0, 8)} · {r.session_name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  V{r.week} · {r.day} · {new Date(r.updated_at).toLocaleString("sv-SE")}
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-1 whitespace-nowrap flex items-center gap-1 ${
                  r.published
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Share2 className="w-3 h-3" />
                {r.published ? "Publicerat" : "Ej publ."}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminCompletionsList;
