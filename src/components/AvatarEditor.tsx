import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, Palette, Ruler, User, Smile } from "lucide-react";
import Avatar3D, { type AvatarConfig, type EquippedItems } from "./Avatar3D";

interface AvatarEditorProps {
  userId: string;
}

export interface AvatarEditorRef {
  reloadEquipped: () => void;
}

const SKIN_COLORS = ["#FDDBB4", "#F5CBA7", "#E8B98D", "#C68642", "#8D5524", "#5C3317", "#3B1F0B"];
const HAIR_COLORS = ["#090806", "#3B2F2F", "#6B4423", "#B7410E", "#D4A76A", "#E8E8E8", "#C41E3A", "#1E90FF", "#32CD32", "#FF69B4", "#9B59B6"];
const HAIR_STYLES = [
  { value: "none", label: "Inget" },
  { value: "buzz", label: "Buzz cut" },
  { value: "short", label: "Kort" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Långt" },
  { value: "curly", label: "Lockigt" },
  { value: "wavy", label: "Vågigt" },
  { value: "mohawk", label: "Mohawk" },
  { value: "ponytail", label: "Hästsvans" },
  { value: "bun", label: "Knut" },
  { value: "braids", label: "Flätor" },
  { value: "slickback", label: "Slickback" },
  { value: "afro", label: "Afro" },
];
const MOUTH_EXPRESSIONS = [
  { value: "smile", label: "😊 Leende" },
  { value: "big_smile", label: "😁 Stort leende" },
  { value: "neutral", label: "😐 Neutral" },
  { value: "surprised", label: "😮 Förvånad" },
  { value: "sad", label: "😢 Ledsen" },
  { value: "smirk", label: "😏 Flin" },
  { value: "tongue_out", label: "😛 Tunga" },
];
const BODY_OPTIONS = [
  { value: "short", label: "Kort" },
  { value: "medium", label: "Medium" },
  { value: "tall", label: "Lång" },
];
const FAT_OPTIONS = [
  { value: "low", label: "Låg" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "Hög" },
];
const MUSCLE_OPTIONS = [
  { value: "low", label: "Låg" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "Hög" },
];

const DEFAULT_CONFIG: AvatarConfig = {
  body_height: "medium",
  body_fat: "medium",
  muscle_mass: "medium",
  skin_color: "#C68642",
  hair_style: "short",
  hair_color: "#3B2F2F",
  mouth_expression: "smile",
};

const AvatarEditor = forwardRef<AvatarEditorRef, AvatarEditorProps>(({ userId }, ref) => {
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_CONFIG);
  const [equipped, setEquipped] = useState<EquippedItems>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proteinBars, setProteinBars] = useState(0);
  const [gender, setGender] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const [{ data: cfg }, { data: profile }, { data: eqItems }] = await Promise.all([
        supabase.from("avatar_config").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("protein_bars, gender").eq("user_id", userId).single(),
        supabase.from("avatar_equipped_items").select("slot, item_id, avatar_shop_items(*)").eq("user_id", userId),
      ]);

      if (cfg) {
        setConfig({
          body_height: cfg.body_height,
          body_fat: cfg.body_fat,
          muscle_mass: cfg.muscle_mass,
          skin_color: cfg.skin_color,
          hair_style: cfg.hair_style,
          hair_color: cfg.hair_color,
          mouth_expression: (cfg as any).mouth_expression || "smile",
        });
      }
      if (profile) {
        setProteinBars((profile as any).protein_bars || 0);
        setGender((profile as any).gender || "");
      }
      if (eqItems) {
        const eq: EquippedItems = {};
        (eqItems as any[]).forEach((e) => {
          const item = e.avatar_shop_items;
          if (item) (eq as any)[e.slot] = { style_data: item.style_data };
        });
        setEquipped(eq);
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  const reloadEquipped = async () => {
    const { data: eqItems } = await supabase
      .from("avatar_equipped_items")
      .select("slot, item_id, avatar_shop_items(*)")
      .eq("user_id", userId);
    if (eqItems) {
      const eq: EquippedItems = {};
      (eqItems as any[]).forEach((e) => {
        const item = e.avatar_shop_items;
        if (item) (eq as any)[e.slot] = { style_data: item.style_data };
      });
      setEquipped(eq);
    }
  };

  useImperativeHandle(ref, () => ({ reloadEquipped }));

  const handleSave = async () => {
    setSaving(true);
    const { data: existing } = await supabase.from("avatar_config").select("id").eq("user_id", userId).maybeSingle();
    const saveData = {
      body_height: config.body_height,
      body_fat: config.body_fat,
      muscle_mass: config.muscle_mass,
      skin_color: config.skin_color,
      hair_style: config.hair_style,
      hair_color: config.hair_color,
      mouth_expression: config.mouth_expression || "smile",
    };
    if (existing) {
      await supabase.from("avatar_config").update(saveData).eq("user_id", userId);
    } else {
      await supabase.from("avatar_config").insert({ user_id: userId, ...saveData });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const update = (key: keyof AvatarConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const avatarConfig = { ...config, gender };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Din Avatar</span>
        </div>
        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          🍫 {proteinBars} proteinbars
        </span>
      </div>

      {/* Preview */}
      <div className="flex justify-center bg-secondary/50 rounded-xl p-2">
        <Avatar3D config={avatarConfig} equipped={equipped} size={220} />
      </div>

      {/* Body settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Ruler className="w-3.5 h-3.5" /> Kroppsbyggnad
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Längd</label>
          <div className="flex gap-2">
            {BODY_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => update("body_height", o.value)}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${config.body_height === o.value ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Fettmassa</label>
          <div className="flex gap-2">
            {FAT_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => update("body_fat", o.value)}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${config.body_fat === o.value ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Muskelmassa</label>
          <div className="flex gap-2">
            {MUSCLE_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => update("muscle_mass", o.value)}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${config.muscle_mass === o.value ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Palette className="w-3.5 h-3.5" /> Utseende
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Hudfärg</label>
          <div className="flex gap-2 flex-wrap">
            {SKIN_COLORS.map((c) => (
              <button key={c} onClick={() => update("skin_color", c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${config.skin_color === c ? "border-primary scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Hårfärg</label>
          <div className="flex gap-2 flex-wrap">
            {HAIR_COLORS.map((c) => (
              <button key={c} onClick={() => update("hair_color", c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${config.hair_color === c ? "border-primary scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Hårstil</label>
          <div className="flex gap-2 flex-wrap">
            {HAIR_STYLES.map((s) => (
              <button key={s.value} onClick={() => update("hair_style", s.value)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${config.hair_style === s.value ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mouth expression */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Smile className="w-3.5 h-3.5" /> Ansiktsuttryck
        </div>
        <div className="flex gap-2 flex-wrap">
          {MOUTH_EXPRESSIONS.map((e) => (
            <button key={e.value} onClick={() => update("mouth_expression", e.value)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${config.mouth_expression === e.value ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" /> Sparat!</> : "Spara avatar"}
      </button>
    </div>
  );
});

export default AvatarEditor;
