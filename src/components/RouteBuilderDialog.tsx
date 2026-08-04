import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bike,
  Bookmark,
  Footprints,
  Loader2,
  MapPin,
  Mountain,
  MoveDown,
  MoveUp,
  Navigation,
  PersonStanding,
  Route as RouteIcon,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RouteMap from "@/components/RouteMap";
import RouteNavigation from "@/components/RouteNavigation";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  deleteSavedRoute,
  getPositionRobust,
  listSavedRoutes,
  saveRoute,
  shareRouteToChat,
  type RouteData,
  type SavedRoute,
} from "@/lib/savedRoutes";

type Activity = "cycling" | "running" | "walking" | "hiking";

const ACTIVITIES: { key: Activity; label: string; icon: typeof Bike }[] = [
  { key: "running", label: "Löpning", icon: Footprints },
  { key: "cycling", label: "Cykling", icon: Bike },
  { key: "walking", label: "Promenad", icon: PersonStanding },
  { key: "hiking", label: "Vandring", icon: Mountain },
];

const SURFACE_LABELS: Record<string, string> = {
  asphalt: "asfalt",
  paved: "belagd",
  concrete: "betong",
  paving_stones: "plattor",
  gravel: "grus",
  fine_gravel: "finkross",
  compacted: "packat grus",
  dirt: "jord",
  ground: "naturmark",
  grass: "gräs",
  sand: "sand",
  wood: "trä",
  sett: "gatsten",
};

const RouteBuilderDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [tab, setTab] = useState<"new" | "saved">("new");
  const [activity, setActivity] = useState<Activity>("running");
  const [asphaltOnly, setAsphaltOnly] = useState(false);
  const [distanceKm, setDistanceKm] = useState(5);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteData[] | null>(null);
  const [selected, setSelected] = useState(0);

  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [saving, setSaving] = useState(false);

  const [shareTarget, setShareTarget] = useState<{ name: string; activity: string; route: RouteData } | null>(null);
  const [friends, setFriends] = useState<{ user_id: string; nickname: string }[]>([]);
  const [sharing, setSharing] = useState(false);

  const [navRoute, setNavRoute] = useState<{ route: RouteData; activity: string; name?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      setSaved(await listSavedRoutes());
    } catch {
      // tyst – visas som tom lista
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refreshSaved();
  }, [open, refreshSaved]);

  const generate = async () => {
    setLoading(true);
    setRoutes(null);
    try {
      const pos = await getPositionRobust();
      const { data, error } = await supabase.functions.invoke("generate-route", {
        body: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          distanceKm,
          activity,
          asphaltOnly,
        },
      });
      if (error) throw error;
      const result: RouteData[] = data?.routes ?? [];
      if (!result.length) {
        toast.error(data?.message ?? "Hittade inga rundor här. Prova en annan distans.");
        setRoutes([]);
        return;
      }
      setRoutes(result);
      setSelected(0);
      setSavingName(`${ACTIVITIES.find((a) => a.key === activity)?.label ?? "Runda"} ${result[0].distanceKm.toFixed(1)} km`);
    } catch (e: any) {
      const msg =
        e?.code === 1
          ? "Platstillstånd nekades – tillåt plats och försök igen."
          : e?.code === 3
            ? "GPS-position tog för lång tid. Gå ut i öppet läge och försök igen."
            : e?.message || "Kunde inte skapa rundor";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const active = routes && routes.length > 0 ? routes[Math.min(selected, routes.length - 1)] : null;

  const handleSave = async (route: RouteData, name: string) => {
    if (!userId) {
      toast.error("Du måste vara inloggad för att spara rundor");
      return;
    }
    setSaving(true);
    try {
      await saveRoute(userId, name.trim() || `Runda ${route.distanceKm.toFixed(1)} km`, activity, route);
      toast.success("Rundan sparades");
      refreshSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte spara rundan");
    } finally {
      setSaving(false);
    }
  };

  const openShare = async (name: string, act: string, route: RouteData) => {
    if (!userId) return;
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    const ids = (friendships ?? []).map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
    if (!ids.length) {
      toast.error("Du har inga vänner att dela med ännu");
      return;
    }
    const { data: profiles } = await supabase.from("profiles").select("user_id, nickname").in("user_id", ids);
    setFriends(profiles ?? []);
    setShareTarget({ name, activity: act, route });
  };

  const RouteStats = ({ route }: { route: RouteData }) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-[11px]">
      <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        {route.distanceKm.toFixed(2)} km
      </span>
      {route.elevationGainM != null && (
        <span className="flex items-center gap-1 font-semibold text-foreground">
          <MoveUp className="h-3.5 w-3.5 text-primary" />
          {Math.round(route.elevationGainM)} m
        </span>
      )}
      {route.elevationLossM != null && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <MoveDown className="h-3.5 w-3.5" />
          {Math.round(route.elevationLossM)} m
        </span>
      )}
      {route.pavedRatio != null && (
        <span className="text-muted-foreground">
          {Math.round(route.pavedRatio * 100)} % belagd
          {route.surfaces?.length ? ` · ${route.surfaces.map((s) => SURFACE_LABELS[s] ?? s).join(", ")}` : ""}
        </span>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open && !navRoute}>
        <DialogContent
          className="z-[10050] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <RouteIcon className="h-4 w-4 text-primary" /> Rundor
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Stäng"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
            {(["new", "saved"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                  tab === t ? "bg-background text-foreground shadow-soft" : "text-muted-foreground"
                }`}
              >
                {t === "new" ? "Skapa" : `Sparade${saved.length ? ` (${saved.length})` : ""}`}
              </button>
            ))}
          </div>

          {tab === "new" ? (
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Aktivitet</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ACTIVITIES.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActivity(key)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-[11px] font-semibold transition-all ${
                        activity === key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/50 bg-card text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Endast asfalt</p>
                  <p className="text-xs text-muted-foreground">Undvik grus- och skogsvägar</p>
                </div>
                <Switch checked={asphaltOnly} onCheckedChange={setAsphaltOnly} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">Längd på banan</Label>
                  <span className="text-sm font-bold tabular-nums text-foreground">{distanceKm} km</span>
                </div>
                <Slider
                  value={[distanceKm]}
                  min={1}
                  max={activity === "cycling" ? 100 : 30}
                  step={1}
                  onValueChange={(v) => setDistanceKm(v[0])}
                />
                <p className="text-[11px] text-muted-foreground">
                  Förslagen hamnar inom ±20 % ({(distanceKm * 0.8).toFixed(1)}–{(distanceKm * 1.2).toFixed(1)} km).
                </p>
              </div>

              <Button onClick={generate} disabled={loading} className="w-full rounded-xl font-bold">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker rundor…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Föreslå rundor
                  </>
                )}
              </Button>

              {routes && routes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {routes.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelected(i)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                          i === selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        Runda {i + 1} · {r.distanceKm.toFixed(1)} km
                      </button>
                    ))}
                  </div>

                  {active && (
                    <>
                      <RouteMap route={active.points} height={260} />
                      <RouteStats route={active} />

                      <Button
                        className="w-full rounded-xl font-bold"
                        onClick={() => {
                          setNavRoute({ route: active, activity, name: savingName });
                        }}
                      >
                        <Navigation className="mr-2 h-4 w-4" /> Starta runda
                      </Button>

                      <div className="flex gap-2">
                        <Input
                          value={savingName}
                          onChange={(e) => setSavingName(e.target.value)}
                          placeholder="Namn på rundan"
                          className="h-9 rounded-xl text-sm"
                        />
                        <Button
                          variant="secondary"
                          className="h-9 shrink-0 rounded-xl"
                          disabled={saving}
                          onClick={() => handleSave(active, savingName)}
                        >
                          <Bookmark className="mr-1.5 h-4 w-4" /> Spara
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={() => openShare(savingName || `Runda ${active.distanceKm.toFixed(1)} km`, activity, active)}
                      >
                        <Send className="mr-2 h-4 w-4" /> Dela via chatt
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {savedLoading && <p className="py-6 text-center text-xs text-muted-foreground">Hämtar sparade rundor…</p>}
              {!savedLoading && saved.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Inga sparade rundor ännu. Skapa en runda och tryck Spara.
                </p>
              )}
              {saved.map((r) => (
                <div key={r.id} className="space-y-2 rounded-2xl border border-border/50 bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ACTIVITIES.find((a) => a.key === r.activity)?.label ?? r.activity} ·{" "}
                        {new Date(r.createdAt).toLocaleDateString("sv-SE")}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteSavedRoute(r.id);
                        setSaved((s) => s.filter((x) => x.id !== r.id));
                      }}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                      aria-label="Ta bort"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <RouteMap route={r.points} height={160} />
                  <RouteStats route={r} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="rounded-xl font-bold" onClick={() => setNavRoute({ route: r, activity: r.activity, name: r.name })}>
                      <Navigation className="mr-1.5 h-4 w-4" /> Starta
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openShare(r.name, r.activity, r)}>
                      <Send className="mr-1.5 h-4 w-4" /> Dela
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dela via chatt */}
      <Dialog open={!!shareTarget} onOpenChange={(v) => !v && setShareTarget(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Send className="h-4 w-4 text-primary" /> Dela runda
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {friends.map((f) => (
              <button
                key={f.user_id}
                disabled={sharing}
                onClick={async () => {
                  if (!shareTarget || !userId) return;
                  setSharing(true);
                  try {
                    await shareRouteToChat(userId, f.user_id, shareTarget.name, shareTarget.activity, shareTarget.route);
                    toast.success(`Rundan skickades till ${f.nickname}`);
                    setShareTarget(null);
                  } catch (e: any) {
                    toast.error(e?.message ?? "Kunde inte dela rundan");
                  } finally {
                    setSharing(false);
                  }
                }}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                {f.nickname}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {navRoute && (
        <RouteNavigation
          route={navRoute.route}
          activity={navRoute.activity}
          name={navRoute.name}
          onClose={() => {
            setNavRoute(null);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
};

export default RouteBuilderDialog;
