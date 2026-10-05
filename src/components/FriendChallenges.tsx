import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Plus, Medal, Loader2, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { summarizeCompletion } from "@/lib/workoutSummary";
import { getWorkoutDistanceKm } from "@/lib/workoutDistance";

type Metric = "pass" | "distance" | "volume";

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "pass", label: "Flest pass", unit: "pass" },
  { key: "distance", label: "Längst sträcka", unit: "km" },
  { key: "volume", label: "Mest lyft", unit: "ton" },
];

interface Challenge {
  id: string;
  title: string;
  metric: string;
  target: number | null;
  start_date: string;
  end_date: string;
  created_by: string;
}

interface Standing { userId: string; nickname: string; value: number }

const todayIso = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const fmt = (n: number, d = 1) => Number(n || 0).toLocaleString("sv-SE", { maximumFractionDigits: d });

interface Props { userId: string }

/** Utmaningar mellan vänner med liveställning. */
export default function FriendChallenges({ userId }: Props) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [standings, setStandings] = useState<Record<string, Standing[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [friends, setFriends] = useState<{ user_id: string; nickname: string }[]>([]);

  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<Metric>("pass");
  const [target, setTarget] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(inDays(30));
  const [invited, setInvited] = useState<string[]>([]);

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [inviterNames, setInviterNames] = useState<Record<string, string>>({});

  const loadChallenges = useCallback(async () => {
    const { data: memberships } = await supabase
      .from("friend_challenge_participants")
      .select("challenge_id, status")
      .eq("user_id", userId);
    const ids = (memberships || []).map((m) => m.challenge_id);
    setPendingIds(new Set((memberships || []).filter((m) => m.status === "pending").map((m) => m.challenge_id)));
    if (ids.length === 0) { setChallenges([]); setLoading(false); return; }
    const { data } = await supabase
      .from("friend_challenges")
      .select("*")
      .in("id", ids)
      .order("end_date", { ascending: true });
    const list = (data || []) as Challenge[];
    setChallenges(list);
    const creatorIds = [...new Set(list.map((c) => c.created_by))];
    if (creatorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nickname").in("user_id", creatorIds);
      setInviterNames(Object.fromEntries((profs || []).map((p) => [p.user_id, p.nickname])));
    }
    setLoading(false);
  }, [userId]);

  // Live: new invites appear without reload
  useEffect(() => {
    const ch = supabase
      .channel(`challenge-invites-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_challenge_participants", filter: `user_id=eq.${userId}` }, () => loadChallenges())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadChallenges]);

  const respondInvite = async (c: Challenge, accept: boolean) => {
    const q = supabase.from("friend_challenge_participants");
    const { error } = accept
      ? await q.update({ status: "accepted" }).eq("challenge_id", c.id).eq("user_id", userId)
      : await q.delete().eq("challenge_id", c.id).eq("user_id", userId);
    if (error) { toast.error("Något gick fel"); return; }
    toast.success(accept ? "Du är med i utmaningen!" : "Inbjudan avböjd");
    loadChallenges();
  };

  const loadFriends = useCallback(async () => {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id, status")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");
    const otherIds = (friendships || []).map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
    if (otherIds.length === 0) { setFriends([]); return; }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", otherIds);
    setFriends((profiles || []) as { user_id: string; nickname: string }[]);
  }, [userId]);

  useEffect(() => { loadChallenges(); loadFriends(); }, [loadChallenges, loadFriends]);

  const loadStandings = useCallback(async (challenge: Challenge) => {
    const { data: parts } = await supabase
      .from("friend_challenge_participants")
      .select("user_id")
      .eq("challenge_id", challenge.id)
      .eq("status", "accepted");
    const userIds = (parts || []).map((p) => p.user_id);
    if (userIds.length === 0) return;

    const [{ data: profiles }, { data: completions }] = await Promise.all([
      supabase.from("profiles").select("user_id, nickname").in("user_id", userIds),
      supabase
        .from("workout_completions")
        .select("user_id, done, updated_at, logged_distance_km, logged_weights")
        .in("user_id", userIds)
        .eq("done", true)
        .gte("updated_at", `${challenge.start_date}T00:00:00Z`)
        .lte("updated_at", `${challenge.end_date}T23:59:59Z`),
    ]);

    const nicknames = new Map((profiles || []).map((p) => [p.user_id, p.nickname]));
    const totals = new Map<string, number>(userIds.map((id) => [id, 0]));

    for (const row of completions || []) {
      const summary = summarizeCompletion(row.logged_weights);
      let value = 0;
      if (challenge.metric === "pass") value = summary.sets > 0 || summary.cardio ? 1 : 0;
      else if (challenge.metric === "distance") {
        value = getWorkoutDistanceKm({
          loggedDistanceKm: row.logged_distance_km,
          loggedWeights: row.logged_weights as never,
          planDetails: null,
        });
      } else value = summary.volumeKg / 1000;
      totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + value);
    }

    const list: Standing[] = userIds
      .map((id) => ({ userId: id, nickname: nicknames.get(id) || "Okänd", value: totals.get(id) ?? 0 }))
      .sort((a, b) => b.value - a.value);
    setStandings((prev) => ({ ...prev, [challenge.id]: list }));
  }, []);

  const toggle = (challenge: Challenge) => {
    const next = expanded === challenge.id ? null : challenge.id;
    setExpanded(next);
    if (next && !standings[challenge.id]) loadStandings(challenge);
  };

  const createChallenge = async () => {
    if (!title.trim()) { toast.error("Ge utmaningen ett namn"); return; }
    if (endDate < startDate) { toast.error("Slutdatum måste vara efter startdatum"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("friend_challenges")
      .insert({
        title: title.trim(),
        metric,
        target: target ? Number(target.replace(",", ".")) : null,
        start_date: startDate,
        end_date: endDate,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error("Kunde inte skapa utmaningen");
      return;
    }

    const rows = [
      { challenge_id: data.id, user_id: userId, status: "accepted" },
      ...invited.map((id) => ({ challenge_id: data.id, user_id: id, status: "pending", invited_by: userId })),
    ];
    await supabase.from("friend_challenge_participants").insert(rows);
    setSaving(false);
    setCreateOpen(false);
    setTitle(""); setTarget(""); setInvited([]); setMetric("pass");
    toast.success(invited.length ? "Utmaningen är igång – inbjudningar skickade!" : "Utmaningen är igång!");
    loadChallenges();
  };

  const removeChallenge = async (challenge: Challenge) => {
    if (challenge.created_by !== userId) return;
    if (!window.confirm(`Ta bort "${challenge.title}"?`)) return;
    await supabase.from("friend_challenges").delete().eq("id", challenge.id);
    setChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
  };

  const unitFor = (m: string) => METRICS.find((x) => x.key === m)?.unit ?? "";

  const active = useMemo(() => {
    const today = todayIso();
    return challenges.filter((c) => c.end_date >= today && !pendingIds.has(c.id));
  }, [challenges, pendingIds]);
  const invites = useMemo(() => {
    const today = todayIso();
    return challenges.filter((c) => pendingIds.has(c.id) && c.end_date >= today);
  }, [challenges, pendingIds]);
  const finished = useMemo(() => {
    const today = todayIso();
    return challenges.filter((c) => c.end_date < today && !pendingIds.has(c.id));
  }, [challenges, pendingIds]);

  const card = (c: Challenge, done: boolean) => {
    const list = standings[c.id] || [];
    const leader = list[0];
    return (
      <div key={c.id} className="bg-card border border-border rounded-2xl overflow-hidden">
        <button onClick={() => toggle(c)} className="w-full flex items-center gap-2 p-3 text-left">
          <Trophy className={`w-4 h-4 ${done ? "text-muted-foreground" : "text-warning"}`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{c.title}</div>
            <div className="text-[11px] text-muted-foreground">
              {METRICS.find((m) => m.key === c.metric)?.label} · {c.start_date} – {c.end_date}
              {c.target ? ` · mål ${fmt(c.target)} ${unitFor(c.metric)}` : ""}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === c.id ? "rotate-180" : ""}`} />
        </button>

        {expanded === c.id && (
          <div className="px-3 pb-3 space-y-1.5 animate-fade-in">
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground">Laddar ställning…</p>
            ) : (
              list.map((s, i) => {
                const pct = leader && leader.value > 0 ? (s.value / leader.value) * 100 : 0;
                return (
                  <div key={s.userId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 truncate">
                        {i < 3 && <Medal className={`w-3.5 h-3.5 ${i === 0 ? "text-warning" : i === 1 ? "text-muted-foreground" : "text-primary"}`} />}
                        <span className={s.userId === userId ? "font-bold" : ""}>{i + 1}. {s.nickname}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{fmt(s.value, c.metric === "pass" ? 0 : 1)} {unitFor(c.metric)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })
            )}
            {c.created_by === userId && (
              <button onClick={() => removeChallenge(c)} className="flex items-center gap-1 text-[11px] text-destructive pt-1">
                <Trash2 className="w-3 h-3" /> Ta bort utmaningen
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-warning" /> Utmaningar
        </h3>
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold">
          <Plus className="w-3.5 h-3.5" /> Ny
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Laddar…</p>
      ) : (active.length + finished.length + invites.length) === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-4 text-center space-y-1">
          <p className="text-xs font-semibold">Inga utmaningar än</p>
          <p className="text-[11px] text-muted-foreground">Utmana dina vänner på flest pass, längst sträcka eller mest lyft.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map((c) => (
            <div key={c.id} className="bg-card border border-primary/40 rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-primary">Inbjudan väntar</div>
                  <div className="text-sm font-bold truncate">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {inviterNames[c.created_by] || "En vän"} · {METRICS.find((m) => m.key === c.metric)?.label} · {c.start_date} – {c.end_date}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => respondInvite(c, true)}>Gå med</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => respondInvite(c, false)}>Avböj</Button>
              </div>
            </div>
          ))}
          {active.map((c) => card(c, false))}
          {finished.length > 0 && (
            <>
              <p className="text-[11px] text-muted-foreground pt-1">Avslutade</p>
              {finished.map((c) => card(c, true))}
            </>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">Ny utmaning</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Namn</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Flest pass i mars" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Vad tävlar ni i?</label>
              <div className="grid grid-cols-3 gap-1.5">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMetric(m.key)}
                    className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors ${
                      metric === m.key ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Start</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Slut</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Mål (valfritt, {METRICS.find((m) => m.key === metric)?.unit})</label>
              <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="t.ex. 100" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Bjud in vänner</label>
              {friends.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Du har inga vänner att bjuda in än.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {friends.map((f) => {
                    const on = invited.includes(f.user_id);
                    return (
                      <button
                        key={f.user_id}
                        onClick={() => setInvited((prev) => on ? prev.filter((id) => id !== f.user_id) : [...prev, f.user_id])}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                          on ? "border-primary bg-primary/10" : "border-border text-muted-foreground"
                        }`}
                      >
                        {f.nickname}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Button className="w-full" onClick={createChallenge} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Skapar…</> : "Starta utmaningen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
