import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { saveAppSetting, useAppSettings } from "@/lib/appSettings";
import { FEATURES, resolvedFlags, type Audience, type FeatureId } from "@/lib/featureFlags";
import { APP_VERSION } from "@/lib/version";
import UndoContentButton from "@/components/admin/UndoContentButton";

const AUDIENCE: { id: Audience; label: string }[] = [
  { id: "all", label: "Alla" },
  { id: "honorary", label: "Hedersmedlem" },
  { id: "off", label: "Av" },
];

export default function AdminRuntime({ userId }: { userId: string }) {
  const settings = useAppSettings();
  const [maintenanceText, setMaintenanceText] = useState(settings.maintenance_message);
  const [updateText, setUpdateText] = useState(settings.force_update_message);
  useEffect(() => setMaintenanceText(settings.maintenance_message), [settings.maintenance_message]);
  useEffect(() => setUpdateText(settings.force_update_message), [settings.force_update_message]);
  const flags = resolvedFlags(settings);

  const save = async (fn: () => Promise<void>) => {
    try {
      await fn();
      toast.success("Sparat för alla");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara");
    }
  };

  const setAudience = (id: FeatureId, audience: Audience) => {
    const next = { ...flags, [id]: audience };
    return save(async () => {
      await saveAppSetting("feature_flags", next, userId);
      if (id === "ai_food") await saveAppSetting("ai_food_for_all", audience === "all", userId, { history: false });
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex justify-end">
        <UndoContentButton contentKey="feature_flags" userId={userId} />
      </div>

      <div className="space-y-2 rounded-xl border border-border p-3">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">Underhållsläge</span>
            <span className="text-[11px] text-muted-foreground">Medlemmar ser bara ett meddelande. Du kommer fortfarande in.</span>
          </span>
          <Switch checked={settings.maintenance_mode} onCheckedChange={(v) => save(() => saveAppSetting("maintenance_mode", v, userId))} />
        </label>
        <Textarea value={maintenanceText} maxLength={300} placeholder="Vi är tillbaka inom kort" onChange={(e) => setMaintenanceText(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => save(() => saveAppSetting("maintenance_message", maintenanceText.trim(), userId))}>Spara texten</Button>
      </div>

      <div className="space-y-2 rounded-xl border border-border p-3">
        <p className="font-medium">Tvinga omladdning</p>
        <p className="text-[11px] text-muted-foreground">
          Äldre byggen än det du har öppet måste laddas om. Samma version släpps in, så ladda själv om efter en publicering innan du trycker.
          {settings.force_update_after ? ` Aktiv gräns: ${settings.force_update_after.slice(0, 16).replace("T", " ")}.` : " Inte aktiv."}
        </p>
        <Textarea value={updateText} maxLength={300} placeholder="Ladda om för att få senaste versionen" onChange={(e) => setUpdateText(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => {
            if (!Number.isFinite(Date.parse(APP_VERSION))) {
              toast.error("Det här bygget har ingen versionstid. Publicera appen och ladda om först.");
              return;
            }
            void save(() => saveAppSetting("force_update_after", APP_VERSION, userId));
          }}>Kräv omladdning av äldre byggen</Button>
          <Button size="sm" variant="outline" onClick={() => save(() => saveAppSetting("force_update_message", updateText.trim(), userId))}>Spara texten</Button>
          {settings.force_update_after && (
            <Button size="sm" variant="outline" onClick={() => save(() => saveAppSetting("force_update_after", "", userId))}>Släpp</Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Vem som får använda vad</p>
        <p className="text-[11px] text-muted-foreground">Av gäller alla, även hedersmedlemmar. Strava är av tills du sätter på den.</p>
        {FEATURES.map((feature) => (
          <label key={feature.id} className="flex items-center justify-between gap-3 py-1">
            <span>
              <span className="block font-medium">{feature.label}</span>
              <span className="text-[11px] text-muted-foreground">{feature.hint}</span>
            </span>
            <select
              aria-label={feature.label}
              value={flags[feature.id]}
              onChange={(e) => void setAudience(feature.id, e.target.value as Audience)}
              className="rounded-xl border border-input bg-background px-2 py-1.5 text-xs"
            >
              {AUDIENCE.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
