import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Timer, EyeOff } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";

export const FASTING_ENABLED_KEY = "grim_fasting_enabled";
export const FASTING_CHANGED_EVENT = "grim:fasting-changed";

export function isFastingEnabled() {
  return localStorage.getItem(FASTING_ENABLED_KEY) === "true";
}

export function setFastingEnabled(v: boolean) {
  localStorage.setItem(FASTING_ENABLED_KEY, v ? "true" : "false");
  window.dispatchEvent(new Event(FASTING_CHANGED_EVENT));
}

const SCHEDULES: Record<string, number> = { "16:8": 16, "18:6": 18, "20:4": 20 };

interface Session { id: string; start_time: string; end_time: string | null; schedule_type: string; target_hours: number }

function fmt(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FastingWidget({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState<boolean>(isFastingEnabled());
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [schedule, setSchedule] = useState("16:8");
  const [customH, setCustomH] = useState("14");
  const [now, setNow] = useState(Date.now());
  const { toast } = useToast();

  useEffect(() => {
    const onChange = () => setEnabled(isFastingEnabled());
    window.addEventListener(FASTING_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FASTING_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await supabase.from("fasting_sessions").select("*").eq("user_id", userId).order("start_time", { ascending: false }).limit(1).maybeSingle();
      if (s.data) { setSession(s.data as Session); setSchedule(s.data.schedule_type); if (!SCHEDULES[s.data.schedule_type]) setCustomH(String(s.data.target_hours)); }
      setLoaded(true);
    })();
  }, [userId]);

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const targetHours = SCHEDULES[schedule] ?? Math.min(23, Math.max(1, parseFloat(customH.replace(",", ".")) || 14));

  async function start() {
    hapticLight();
    const { data, error } = await supabase.from("fasting_sessions")
      .insert({ user_id: userId, schedule_type: schedule, target_hours: targetHours }).select("*").single();
    if (error) { toast({ title: "Kunde inte starta fasta", variant: "destructive" }); return; }
    setSession(data as Session);
  }

  async function stop() {
    if (!session) return;
    hapticLight();
    const end_time = new Date().toISOString();
    const { error } = await supabase.from("fasting_sessions").update({ end_time }).eq("id", session.id);
    if (error) { toast({ title: "Kunde inte avsluta", variant: "destructive" }); return; }
    setSession({ ...session, end_time });
  }

  if (hidden === null) return null;
  if (hidden) {
    return (
      <button onClick={() => setHiddenPref(false)} className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground py-1">
        <Eye className="w-3.5 h-3.5" /> Visa fastetimer
      </button>
    );
  }

  const active = session && !session.end_time;
  const startMs = session ? new Date(session.start_time).getTime() : 0;
  const fastEnd = startMs + Number(session?.target_hours ?? 0) * 3600_000;
  const eatHours = 24 - Number(session?.target_hours ?? 0);
  const eatEnd = session?.end_time ? new Date(session.end_time).getTime() + eatHours * 3600_000 : 0;
  const eatingOpen = session?.end_time && now < eatEnd;
  const fastDone = active && now >= fastEnd;
  const pct = active ? Math.min(100, ((now - startMs) / (fastEnd - startMs)) * 100) : 0;

  return (
    <div className="rounded-2xl bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-primary" /> Periodisk fasta</p>
        <button onClick={() => setHiddenPref(true)} aria-label="Dölj fastetimer" className="text-muted-foreground p-1"><EyeOff className="w-3.5 h-3.5" /></button>
      </div>

      {active ? (
        <>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground">{fastDone ? "Fastemålet nått! Fastat i" : `Fastar (${session!.schedule_type}) – kvar`}</p>
              <p className="text-xl font-bold tabular-nums">{fmt(fastDone ? now - startMs : fastEnd - now)}</p>
            </div>
            <button onClick={stop} className="pill-btn-primary px-3 py-1.5 text-xs">Avsluta fasta</button>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <>
          {eatingOpen && (
            <div>
              <p className="text-[10px] text-muted-foreground">Ätfönster öppet – nästa fasta om</p>
              <p className="text-xl font-bold tabular-nums">{fmt(eatEnd - now)}</p>
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            {[...Object.keys(SCHEDULES), "eget"].map((k) => (
              <button key={k} onClick={() => setSchedule(k)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${schedule === k ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {k === "eget" ? "Eget" : k}
              </button>
            ))}
            {schedule === "eget" && (
              <input value={customH} onChange={(e) => setCustomH(e.target.value)} inputMode="decimal" aria-label="Fastetimmar"
                className="w-14 rounded-full bg-secondary px-2 py-1 text-[11px] text-center" />
            )}
            <button onClick={start} className="ml-auto pill-btn-primary px-3 py-1.5 text-xs">Starta fasta ({targetHours} h)</button>
          </div>
        </>
      )}
    </div>
  );
}
