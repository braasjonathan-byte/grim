import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, Palette, Ruler, User } from "lucide-react";
import Avatar3D, { type AvatarConfig, type EquippedItems } from "./Avatar3D";

interface AvatarEditorProps {
  userId: string;
}

const SKIN_COLORS = ["#FDDBB4", "#E8B98D", "#C68642", "#8D5524", "#5C3317", "#3B1F0B"];
const HAIR_COLORS = ["#090806", "#3B2F2F", "#6B4423", "#B7410E", "#D4A76A", "#E8E8E8", "#C41E3A", "#1E90FF", "#32CD32"];
const HAIR_STYLES = [
  { value: "none", label: "Inget" },
  { value: "short", label: "Kort" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Långt" },
  { value: "mohawk", label: "Mohawk" },
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
};

const AvatarEditor = ({ userId }: AvatarEditorProps) => {
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_CONFIG);
  const [equipped, setEquipped] = useState<EquippedItems>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proteinBars, setProteinBars] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ data: cfg }, { data: profile }, { data: eqItems }] = await Promise.all([
        supabase.from("avatar_config").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("protein_bars").eq("user_id", userId).single(),
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
        });
      }
      if (profile) setProteinBars((profile as any).protein_bars || 0);
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

  const handleSave = async () => {
    setSaving(true);
    const { data: existing } = await supabase.from("avatar_config").select("id").eq("user_id", userId).maybeSingle();
    if (existing) {
      await supabase.from("avatar_config").update({ ...config }).eq("user_id", userId);
    } else {
      await supabase.from("avatar_config").insert({ user_id: userId, ...config });
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
        <Avatar3D config={config} equipped={equipped} size={220} />
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

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" /> Sparat!</> : "Spara avatar"}
      </button>
    </div>
  );
};

export default AvatarEditor;
