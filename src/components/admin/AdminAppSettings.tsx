import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppSettings, saveAppSetting } from "@/lib/appSettings";

export default function AdminAppSettings({ userId }: { userId: string }) {
  const s = useAppSettings();
  const [banner, setBanner] = useState(s.banner_message);
  useEffect(() => setBanner(s.banner_message), [s.banner_message]);

  const save = async (fn: () => Promise<void>) => {
    try { await fn(); toast.success("Sparat för alla användare"); } catch (e: any) { toast.error(e?.message || "Kunde inte spara"); }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <p className="font-medium">Meddelande överst i appen</p>
        <Textarea value={banner} maxLength={300} onChange={(e) => setBanner(e.target.value)} placeholder="T.ex. Underhåll i kväll 22–23" />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save(() => saveAppSetting("banner_message", banner.trim(), userId))}>Visa för alla</Button>
          <Button size="sm" variant="outline" onClick={() => { setBanner(""); save(() => saveAppSetting("banner_message", "", userId)); }}>Ta bort</Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Vem som får använda AI-kost, GPS, socialt och resten styrs under Funktioner och drift.</p>
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="font-medium block">Visa Supporter-rutan</span>
          <span className="text-[11px] text-muted-foreground">Informationsrutan om Grim Supporter för nya användare</span>
        </span>
        <Switch checked={s.supporter_promo} onCheckedChange={(v) => save(() => saveAppSetting("supporter_promo", v, userId))} />
      </label>
    </div>
  );
}
