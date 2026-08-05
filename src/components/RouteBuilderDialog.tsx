import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bike,
  Bookmark,
  Clock,
  Crosshair,
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
import ElevationProfile from "@/components/ElevationProfile";
import { startRouteNavigation } from "@/lib/routeNavigationBus";
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

type Activity = "running" | "cycling" | "mtb" | "walking" | "hiking";
type RouteType = "loop" | "point";

const ACTIVITIES: { key: Activity; label: string; icon: typeof Bike; speedKmh: number; maxKm: number }[] = [
  { key: "running", label: "Löpning", icon: Footprints, speedKmh: 10, maxKm: 42 },
  { key: "cycling", label: "Landsväg", icon: Bike, speedKmh: 22, maxKm: 150 },
  { key: "mtb", label: "MTB", icon: Mountain, speedKmh: 14, maxKm: 100 },
  { key: "walking", label: "Gång", icon: PersonStanding, speedKmh: 5, maxKm: 30 },
  { key: "hiking", label: "Vandring", icon: Mountain, speedKmh: 4.5, maxKm: 40 },
];

const activityMeta = (key: string) => ACTIVITIES.find((a) => a.key === key) ?? ACTIVITIES[0];

const SURFACE_LABELS: Record<string, string> = {
  asphalt: "asfalt",
  paved: "belagd",
  unpaved: "obelagd",
  concrete: "betong",
  paving_stones: "plattor",
  cobblestone: "gatsten",
  gravel: "grus",
  fine_gravel: "finkross",
  compacted: "packat grus",
  dirt: "jord",
  ground: "naturmark",
  grass: "gräs",
  sand: "sand",
  wood: "trä",
};

const formatDuration = (min: number) => {
  const total = Math.max(1, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

// Formulärstate sparas i sessionStorage så att en remount av föräldern aldrig
// nollställer användarens val.
const FORM_KEY = "grim.routeGenerator.form";

type Place = { lat: number; lng: number; name: string };

type PersistedForm = {
  tab: "new" | "saved";
  activity: Activity;
  routeType: RouteType;
  asphaltOnly: boolean;
  distanceKm: number;
  route: RouteData | null;
  savingName: string;
  startQuery: string;
  startPlace: Place | null;
  destQuery: string;
  destination: Place | null;
};

const DEFAULT_FORM: PersistedForm = {
  tab: "new",
  activity: "running",
  routeType: "loop",
  asphaltOnly: false,
  distanceKm: 5,
  route: null,
  savingName: "",
  startQuery: "",
  startPlace: null,
  destQuery: "",
  destination: null,
};

const readForm = (): PersistedForm => {
  try {
    const raw = sessionStorage.getItem(FORM_KEY);
    if (!raw) return DEFAULT_FORM;
    return { ...DEFAULT_FORM, ...(JSON.parse(raw) as Partial<PersistedForm>) };
  } catch {
    return DEFAULT_FORM;
  }
};

type Suggestion = { placeId: string; text: string; secondary: string };

/** Sökruta med platsförslag (geokodning via place-search). */
const PlaceSearch = ({
  value,
  onChange,
  place,
  onPick,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  place: Place | null;
  onPick: (p: Place | null) => void;
  placeholder: string;
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (place && q === place.name) return;
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("place-search", { body: { query: q } });
        if (!cancelled) setSuggestions(data?.suggestions ?? []);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [value, place]);

  const pick = async (s: Suggestion) => {
    setLoading(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("place-search", { body: { placeId: s.placeId } });
      if (error || !data?.lat) throw error ?? new Error("Kunde inte hämta platsen");
      const name = s.text || data.name || "Plats";
      onPick({ lat: data.lat, lng: data.lng, name });
      onChange(name);
    } catch {
      toast.error("Kunde inte hämta platsen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onPick(null);
        }}
        placeholder={placeholder}
        className="h-10 rounded-xl pr-9 text-sm"
      />
      {(loading || place) && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <button
              type="button"
              onClick={() => {
                onPick(null);
                onChange("");
              }}
              aria-label="Rensa"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </span>
      )}
      {suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border/60 bg-popover shadow-soft">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-foreground">{s.text}</span>
                {s.secondary && <span className="block truncate text-muted-foreground">{s.secondary}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const RouteBuilderDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const initial = useRef<PersistedForm>(readForm()).current;
  const [tab, setTab] = useState<"new" | "saved">(initial.tab);
  const [activity, setActivity] = useState<Activity>(initial.activity);
  const [routeType, setRouteType] = useState<RouteType>(initial.routeType);
  const [asphaltOnly, setAsphaltOnly] = useState(initial.asphaltOnly);
  const [distanceKm, setDistanceKm] = useState(initial.distanceKm);
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState<RouteData | null>(initial.route);

  const [startQuery, setStartQuery] = useState(initial.startQuery);
  const [startPlace, setStartPlace] = useState<Place | null>(initial.startPlace);
  const [destQuery, setDestQuery] = useState(initial.destQuery);
  const [destination, setDestination] = useState<Place | null>(initial.destination);
  const [gpsDenied, setGpsDenied] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savingName, setSavingName] = useState(initial.savingName);
  const [saving, setSaving] = useState(false);

  const [shareTarget, setShareTarget] = useState<{ name: string; activity: string; route: RouteData } | null>(null);
  const [friends, setFriends] = useState<{ user_id: string; nickname: string }[]>([]);
  const [sharing, setSharing] = useState(false);

  const meta = activityMeta(activity);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        FORM_KEY,
        JSON.stringify({
          tab,
          activity,
          routeType,
          asphaltOnly,
          distanceKm,
          route,
          savingName,
          startQuery,
          startPlace,
          destQuery,
          destination,
        } satisfies PersistedForm),
      );
    } catch {
      /* ignore */
    }
  }, [tab, activity, routeType, asphaltOnly, distanceKm, route, savingName, startQuery, startPlace, destQuery, destination]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      setSaved(await listSavedRoutes());
    } catch {
      /* tyst – visas som tom lista */
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refreshSaved();
  }, [open, refreshSaved]);

  const startNav = (req: { route: RouteData; activity: string; name?: string }) => {
    startRouteNavigation({
      ...req,
      onClose: (result) => {
        if (result && result.distanceKm > 0.01) {
          toast.success(`Runda avslutad – ${result.distanceKm.toFixed(2)} km registrerade`);
        }
        onOpenChange(false);
      },
    });
    onOpenChange(false);
  };

  /** Startpunkt: vald adress om sådan finns, annars GPS. */
  const resolveStart = async (): Promise<Place> => {
    if (startPlace) return startPlace;
    const pos = await getPositionRobust();
    setGpsDenied(false);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Min position" };
  };

  const generate = async (fresh: boolean) => {
    if (routeType === "point" && !destination) {
      toast.error("Välj en destination först");
      return;
    }
    setLoading(true);
    if (fresh) setRoute(null);
    try {
      const start = await resolveStart();
      const { data, error } = await supabase.functions.invoke("generate-route", {
        body: {
          lat: start.lat,
          lng: start.lng,
          distanceKm,
          activity,
          routeType,
          asphaltOnly,
          seed: Math.floor(Math.random() * 100000),
          ...(routeType === "point" && destination ? { destLat: destination.lat, destLng: destination.lng } : {}),
        },
      });

      const payload: any = data ?? {};
      if (error || !payload.route) {
        toast.error(payload.message ?? "Hittade ingen rutt här. Prova en annan distans eller aktivitet.");
        return;
      }

      const r = payload.route as RouteData;
      setRoute(r);
      if (payload.message) toast.info(payload.message);
      setSavingName(
        routeType === "point" && destination
          ? `${meta.label} till ${destination.name} · ${r.distanceKm.toFixed(1)} km`
          : `${meta.label} ${r.distanceKm.toFixed(1)} km`,
      );
    } catch (e: any) {
      if (e?.code === 1) {
        setGpsDenied(true);
        toast.error("Platsåtkomst nekad – sök på en startadress istället.");
      } else if (e?.code === 3) {
        setGpsDenied(true);
        toast.error("GPS-positionen tog för lång tid – sök på en startadress istället.");
      } else {
        toast.error(e?.message || "Kunde inte skapa rutten");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (r: RouteData, name: string) => {
    if (!userId) {
      toast.error("Du måste vara inloggad för att spara rundor");
      return;
    }
    setSaving(true);
    try {
      await saveRoute(userId, name.trim() || `Runda ${r.distanceKm.toFixed(1)} km`, activity, r);
      toast.success("Rundan sparades");
      refreshSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Kunde inte spara rundan");
    } finally {
      setSaving(false);
    }
  };

  const openShare = async (name: string, act: string, r: RouteData) => {
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
    setShareTarget({ name, activity: act, route: r });
  };

  const RouteStats = ({ data, act }: { data: RouteData; act: string }) => {
    const speed = activityMeta(act).speedKmh;
    const minutes = data.durationMin && data.durationMin > 0 ? data.durationMin : (data.distanceKm / speed) * 60;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-[11px]">
        <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {data.distanceKm.toFixed(2)} km
        </span>
        <span className="flex items-center gap-1 font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {formatDuration(minutes)}
        </span>
        {data.elevationGainM != null && (
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <MoveUp className="h-3.5 w-3.5 text-primary" />
            {Math.round(data.elevationGainM)} m
          </span>
        )}
        {data.elevationLossM != null && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MoveDown className="h-3.5 w-3.5" />
            {Math.round(data.elevationLossM)} m
          </span>
        )}
        {data.pavedRatio != null && (
          <span className="text-muted-foreground">
            {Math.round(data.pavedRatio * 100)} % belagd
            {data.surfaces?.length ? ` · ${data.surfaces.map((s) => SURFACE_LABELS[s] ?? s).join(", ")}` : ""}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open}>
        <DialogContent
          className="z-[10050] max-h-[92vh] max-w-md overflow-y-auto rounded-2xl"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <RouteIcon className="h-4 w-4 text-primary" /> Rutter
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
              {/* Aktivitet */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Aktivitet</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIVITIES.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActivity(key);
                        setDistanceKm((d) => Math.min(d, activityMeta(key).maxKm));
                      }}
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

              {/* Rutt-typ */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Rutt-typ</Label>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
                  {([
                    ["loop", "Rundslinga"],
                    ["point", "Punkt till punkt"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRouteType(key)}
                      className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                        routeType === key ? "bg-background text-foreground shadow-soft" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Startpunkt */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Startpunkt</Label>
                <PlaceSearch
                  value={startQuery}
                  onChange={setStartQuery}
                  place={startPlace}
                  onPick={setStartPlace}
                  placeholder="Sök adress – lämna tomt för min position"
                />
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Crosshair className="h-3 w-3" />
                  {startPlace
                    ? `Startar vid ${startPlace.name}.`
                    : gpsDenied
                      ? "Platsåtkomst nekad – sök på en adress ovan."
                      : "Använder din GPS-position."}
                </p>
              </div>

              {/* Destination (endast punkt till punkt) */}
              {routeType === "point" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Destination</Label>
                  <PlaceSearch
                    value={destQuery}
                    onChange={setDestQuery}
                    place={destination}
                    onPick={setDestination}
                    placeholder="Adress, plats eller ort"
                  />
                </div>
              )}

              {/* Distans */}
              {routeType === "loop" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">Distans</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={distanceKm}
                        min={1}
                        max={meta.maxKm}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v)) setDistanceKm(Math.max(1, Math.min(meta.maxKm, v)));
                        }}
                        className="h-8 w-16 rounded-lg text-center text-sm font-bold tabular-nums"
                      />
                      <span className="text-xs font-semibold text-muted-foreground">km</span>
                    </div>
                  </div>
                  <Slider
                    value={[Math.min(distanceKm, meta.maxKm)]}
                    min={1}
                    max={meta.maxKm}
                    step={1}
                    onValueChange={(v) => setDistanceKm(v[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Målsättning ±10 % ({(distanceKm * 0.9).toFixed(1)}–{(distanceKm * 1.1).toFixed(1)} km) · ca{" "}
                    {formatDuration((distanceKm / meta.speedKmh) * 60)}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Undvik grus</p>
                  <p className="text-xs text-muted-foreground">Prioritera belagda cykel- och gångvägar</p>
                </div>
                <Switch checked={asphaltOnly} onCheckedChange={setAsphaltOnly} />
              </div>

              <Button onClick={() => generate(true)} disabled={loading} className="w-full rounded-xl font-bold">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Söker rutt…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> {route ? "Generera ny rutt" : "Generera rutt"}
                  </>
                )}
              </Button>

              {route && (
                <div className="space-y-3">
                  <RouteMap route={route.points} height={260} />
                  <RouteStats data={route} act={activity} />
                  {route.elevations && route.elevations.length > 1 && (
                    <ElevationProfile elevations={route.elevations} distanceKm={route.distanceKm} />
                  )}

                  <Button className="w-full rounded-xl font-bold" onClick={() => startNav({ route, activity, name: savingName })}>
                    <Navigation className="mr-2 h-4 w-4" /> Starta rutt
                  </Button>

                  <div className="flex gap-2">
                    <Input
                      value={savingName}
                      onChange={(e) => setSavingName(e.target.value)}
                      placeholder="Namn på rutten"
                      className="h-9 rounded-xl text-sm"
                    />
                    <Button
                      variant="secondary"
                      className="h-9 shrink-0 rounded-xl"
                      disabled={saving}
                      onClick={() => handleSave(route, savingName)}
                    >
                      <Bookmark className="mr-1.5 h-4 w-4" /> Spara
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => openShare(savingName || `Rutt ${route.distanceKm.toFixed(1)} km`, activity, route)}
                  >
                    <Send className="mr-2 h-4 w-4" /> Dela via chatt
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {savedLoading && <p className="py-6 text-center text-xs text-muted-foreground">Hämtar sparade rutter…</p>}
              {!savedLoading && saved.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Inga sparade rutter ännu. Skapa en rutt och tryck Spara.
                </p>
              )}
              {saved.map((r) => (
                <div key={r.id} className="space-y-2 rounded-2xl border border-border/50 bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {activityMeta(r.activity).label} · {new Date(r.createdAt).toLocaleDateString("sv-SE")}
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
                  <RouteStats data={r} act={r.activity} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="rounded-xl font-bold" onClick={() => startNav({ route: r, activity: r.activity, name: r.name })}>
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
              <Send className="h-4 w-4 text-primary" /> Dela rutt
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
                    toast.success(`Rutten skickades till ${f.nickname}`);
                    setShareTarget(null);
                  } catch (e: any) {
                    toast.error(e?.message ?? "Kunde inte dela rutten");
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
    </>
  );
};

export default RouteBuilderDialog;
