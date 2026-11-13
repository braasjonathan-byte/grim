import { useCallback, useEffect, useMemo, useState } from "react";
import { MEDALS } from "@/lib/medals";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Plus, Medal, Loader2, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { summarizeCompletion } from "@/lib/workoutSummary";
import { getWorkoutDistanceKm } from "@/lib/workoutDistance";

type Metric = "pass" | "days" | "distance" | "volume";

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "pass", label: "Flest pass", unit: "pass" },
  { key: "days", label: "Träningsdagar", unit: "dagar" },
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
  const [loadError, setLoadError] = useState(false);
  const [standingError, setStandingError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(inDays(30));
  const [invited, setInvited] = useState<string[]>([]);

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [inviterNames, setInviterNames] = useState<Record<string, string>>({});

  const loadChallenges = useCallback(async () => {
    setLoadError(false);
    const { data: memberships, error: membershipError } = await supabase
      .from("friend_challenge_participants")
      .select("challenge_id, status")
      .eq("user_id", userId);
    if (membershipError) { setLoadError(true); setLoading(false); return; }
    const ids = (memberships || []).map((m) => m.challenge_id);
    setPendingIds(new Set((memberships || []).filter((m) => m.status === "pending").map((m) => m.challenge_id)));
    if (ids.length === 0) { setChallenges([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("friend_challenges")
      .select("*")
      .in("id", ids)
      .order("end_date", { ascending: true });
    if (error) { setLoadError(true); setLoading(false); return; }
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
    setStandingError(null);
    if (challenge.metric === "pass" || challenge.metric === "days") {
      const { data, error } = await supabase.rpc("voluntary_challenge_standings", { _challenge: challenge.id });
      if (error) { setStandingError(challenge.id); return; }
      setStandings(prev => ({ ...prev, [challenge.id]: (data || []).map(row => ({ userId: row.user_id, nickname: row.nickname, value: Number(row.value) })) }));
    } else {
      const { data: parts, error: partsError } = await supabase.from("friend_challenge_participants").select("user_id").eq("challenge_id", challenge.id).eq("status", "accepted");
      if (partsError) { setStandingError(challenge.id); return; }
      const ids = (parts || []).map(p => p.user_id);
      const [{ data: profiles, error: profileError }, { data: completions, error: completionError }] = await Promise.all([
        supabase.from("profiles").select("user_id, nickname").in("user_id", ids),
        supabase.from("workout_completions").select("user_id, logged_distance_km, logged_weights").in("user_id", ids).eq("done", true).gte("updated_at", `${challenge.start_date}T00:00:00Z`).lte("updated_at", `${challenge.end_date}T23:59:59Z`),
      ]);
      if (profileError || completionError) { setStandingError(challenge.id); return; }
      setStandings(prev => ({ ...prev, [challenge.id]: (profiles || []).map(p => ({ userId: p.user_id, nickname: p.nickname, value: (completions || []).filter(row => row.user_id === p.user_id).reduce((sum, row) => sum + (challenge.metric === "distance" ? getWorkoutDistanceKm({ loggedDistanceKm: row.logged_distance_km, loggedWeights: row.logged_weights as never, planDetails: null }) : summarizeCompletion(row.logged_weights).volumeKg / 1000), 0) })).sort((a, b) => b.value - a.value) }));
    }

  }, []);

  const toggle = (challenge: Challenge) => {
    const next = expanded === challenge.id ? null : challenge.id;
    setExpanded(next);
    if (next && !standings[challenge.id]) loadStandings(challenge);
  };

  const createChallenge = async () => {
    if (saving) return;
    if (!title.trim()) { toast.error("Ge utmaningen ett namn"); return; }
    if (endDate < startDate) { toast.error("Slutdatum måste vara efter startdatum"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("create_voluntary_challenge", {
      _title: title.trim(), _metric: metric, _start: startDate, _end: endDate, _friends: invited,
    });
    setSaving(false);
    if (error) { toast.error("Kunde inte skapa utmaningen. Dina val finns kvar – försök igen."); return; }
    setCreateOpen(false);
    setTitle(""); setInvited([]); setMetric("pass");
    toast.success(invited.length ? "Inbjudningar skickade – vännerna väljer själva om de vill delta." : "Utmaningen är igång!");
    loadChallenges();
  };

  const removeChallenge = async (challenge: Challenge) => {
    if (challenge.created_by !== userId) return;
    if (!window.confirm(`Ta bort "${challenge.title}"?`)) return;
    const { error } = await supabase.from("friend_challenges").delete().eq("id", challenge.id);
    if (error) { toast.error("Kunde inte ta bort utmaningen"); return; }
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
              {METRICS.find((m) => m.key === c.metric)?.label || "Tidigare utmaning"} · {c.start_date} – {c.end_date}
              {c.target ? ` · mål ${fmt(c.target)} ${unitFor(c.metric)}` : ""}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === c.id ? "rotate-180" : ""}`} />
        </button>

        {expanded === c.id && (
          <div className="px-3 pb-3 space-y-1.5 animate-fade-in">
            {standingError === c.id ? <div className="space-y-2"><p className="text-xs text-muted-foreground">{c.metric === "pass" || c.metric === "days" ? "Ställningen kunde inte hämtas." : "Den här äldre utmaningstypen stöds inte av den nya ställningen."}</p>{(c.metric === "pass" || c.metric === "days") && <Button size="sm" variant="outline" onClick={() => void loadStandings(c)}>Försök igen</Button>}</div> : list.length === 0 ? (
              <p className="text-xs text-muted-foreground">Laddar ställning…</p>
            ) : (
              list.map((s, i) => {
                const pct = leader && leader.value > 0 ? (s.value / leader.value) * 100 : 0;
                return (
                  <div key={s.userId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 truncate">
                        {i < 3 && <Medal className={`w-3.5 h-3.5 ${MEDALS[i].className}`} aria-label={MEDALS[i].label} role="img" />}
                        <span className={s.userId === userId ? "font-bold" : ""}>{i + 1}. {s.nickname}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{fmt(s.value, c.metric === "pass" || c.metric === "days" ? 0 : 1)} {unitFor(c.metric)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })
            )}
            {!done && c.created_by !== userId && <Button variant="ghost" size="sm" onClick={() => respondInvite(c, false)}>Lämna utmaningen</Button>}
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
        <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5" /> Ny</Button>
      </div>

      {loadError ? <div role="alert" className="space-y-2"><p className="text-xs text-muted-foreground">Utmaningarna kunde inte hämtas.</p><Button variant="outline" size="sm" onClick={() => void loadChallenges()}>Försök igen</Button></div> : loading ? (
        <p className="text-xs text-muted-foreground">Laddar…</p>
      ) : (active.length + finished.length + invites.length) === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-4 text-center space-y-1">
          <p className="text-xs font-semibold">Inga utmaningar än</p>
          <p className="text-[11px] text-muted-foreground">Inga pågående eller avslutade utmaningar.</p>
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
                    {inviterNames[c.created_by] || "En vän"} · {METRICS.find((m) => m.key === c.metric)?.label || "Tidigare utmaning"} · {c.start_date} – {c.end_date}
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
              <Input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Flest pass i mars" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Vad tävlar ni i?</label>
              <div className="grid grid-cols-2 gap-1.5">
                {METRICS.filter(m => m.key === "pass" || m.key === "days").map((m) => (
                  <Button
                    variant="outline"
                    aria-pressed={metric === m.key}
                    key={m.key}
                    onClick={() => setMetric(m.key)}
                    className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors ${
                      metric === m.key ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    {m.label}
                  </Button>
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

            <p className="text-xs text-muted-foreground">Bara vänner som tackar ja deltar. Ställningen delas inom utmaningen, aldrig automatiskt i flödet. Träningsdagar räknar högst en dag även om du gör flera pass.</p>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Bjud in vänner</label>
              {friends.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Du har inga vänner att bjuda in än.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {friends.map((f) => {
                    const on = invited.includes(f.user_id);
                    return (
                      <Button
                        variant="outline"
                        aria-pressed={on}
                        key={f.user_id}
                        onClick={() => setInvited((prev) => on ? prev.filter((id) => id !== f.user_id) : [...prev, f.user_id])}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                          on ? "border-primary bg-primary/10" : "border-border text-muted-foreground"
                        }`}
                      >
                        {f.nickname}
                      </Button>
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
