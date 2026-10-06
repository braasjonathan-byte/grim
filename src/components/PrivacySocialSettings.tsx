import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_PRIVACY,
  loadPrivacySettings,
  savePrivacySetting,
  unblockUser,
  unmuteUser,
  type PrivacySettings,
} from "@/lib/socialPrivacy";

interface Props { userId: string }

type Person = { id: string; nickname: string };

const Segmented = <T extends string>({ value, options, onChange, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string;
}) => (
  <div className="flex gap-1 rounded-xl bg-secondary p-1" role="radiogroup" aria-label={label}>
    {options.map(([v, text]) => (
      <button
        key={v}
        type="button"
        role="radio"
        aria-checked={value === v}
        onClick={() => onChange(v)}
        className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${value === v ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
      >
        {text}
      </button>
    ))}
  </div>
);

const PrivacySocialSettings = ({ userId }: Props) => {
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [blocked, setBlocked] = useState<Person[]>([]);
  const [muted, setMuted] = useState<Person[]>([]);

  const loadPeople = async () => {
    const [{ data: blockRows }, { data: muteRows }] = await Promise.all([
      supabase.from("friendships").select("user_id, friend_id").eq("status", "blocked").eq("blocked_by", userId),
      supabase.from("muted_users").select("muted_user_id").eq("user_id", userId),
    ]);
    const blockedIds = (blockRows || []).map((r: any) => (r.user_id === userId ? r.friend_id : r.user_id));
    const mutedIds = (muteRows || []).map((r: any) => r.muted_user_id);
    const all = [...new Set([...blockedIds, ...mutedIds])];
    const names: Record<string, string> = {};
    if (all.length) {
      const { data } = await supabase.rpc("get_suggestion_nicknames", { user_ids: all });
      (data || []).forEach((r: any) => { names[r.user_id] = r.nickname; });
    }
    setBlocked(blockedIds.map((id) => ({ id, nickname: names[id] || "Okänd användare" })));
    setMuted(mutedIds.map((id) => ({ id, nickname: names[id] || "Okänd användare" })));
  };

  useEffect(() => {
    loadPrivacySettings(userId).then(setSettings);
    loadPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const update = async (patch: Partial<PrivacySettings>) => {
    const prev = settings;
    setSettings({ ...settings, ...patch });
    if (!(await savePrivacySetting(userId, patch))) {
      setSettings(prev);
      toast.error("Inställningen kunde inte sparas.");
    }
  };

  return (
    <div className="border-t border-border pt-3 space-y-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Shield className="w-4 h-4 text-primary" /> Integritet &amp; socialt
      </p>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Dela pass automatiskt</p>
        <Segmented
          label="Dela pass automatiskt"
          value={settings.auto_share_workouts}
          options={[["off", "Av"], ["ask", "Fråga varje gång"], ["always", "Alltid"]]}
          onChange={(v) => update({ auto_share_workouts: v })}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Standardsynlighet för inlägg</p>
        <Segmented
          label="Standardsynlighet för inlägg"
          value={settings.default_post_visibility}
          options={[["friends", "👫 Bara vänner"], ["public", "🌍 Alla"]]}
          onChange={(v) => update({ default_post_visibility: v })}
        />
      </div>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Visa mig på topplistan</span>
        <Switch checked={settings.show_on_leaderboard} onCheckedChange={(v) => update({ show_on_leaderboard: v })} />
      </label>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Visa min träningsplan för vänner</span>
        <Switch checked={settings.share_plan_with_friends} onCheckedChange={(v) => update({ share_plan_with_friends: v })} />
      </label>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Blockerade användare</p>
        {blocked.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga blockerade användare.</p>
        ) : blocked.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span>{p.nickname}</span>
            <button
              className="text-xs font-semibold text-primary"
              onClick={async () => {
                if (await unblockUser(userId, p.id)) { toast.success(`Blockeringen av ${p.nickname} är hävd`); loadPeople(); }
                else toast.error("Kunde inte häva blockeringen.");
              }}
            >Häv blockering</button>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Tystade användare</p>
        {muted.length === 0 ? (
          <p className="text-xs text-muted-foreground">Inga tystade användare.</p>
        ) : muted.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span>{p.nickname}</span>
            <button
              className="text-xs font-semibold text-primary"
              onClick={async () => {
                if (await unmuteUser(userId, p.id)) { toast.success(`${p.nickname} visas igen`); loadPeople(); }
                else toast.error("Kunde inte häva tystningen.");
              }}
            >Häv tystning</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrivacySocialSettings;
