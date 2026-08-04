import { useState } from "react";
import { toast } from "sonner";
import { Bike, Footprints, Loader2, MapPin, Mountain, PersonStanding, Route as RouteIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RouteMap from "@/components/RouteMap";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Activity = "cycling" | "running" | "walking" | "hiking";

interface GeneratedRoute {
  distanceKm: number;
  points: [number, number][];
  pavedRatio: number;
  surfaces: string[];
}

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
  const [activity, setActivity] = useState<Activity>("running");
  const [asphaltOnly, setAsphaltOnly] = useState(true);
  const [distanceKm, setDistanceKm] = useState(5);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<GeneratedRoute[] | null>(null);
  const [selected, setSelected] = useState(0);

  const generate = async () => {
    if (!navigator.geolocation) {
      toast.error("GPS stöds inte på den här enheten");
      return;
    }
    setLoading(true);
    setRoutes(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 30000,
        }),
      );
      const { data, error } = await supabase.functions.invoke("generate-route", {
        body: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          distanceKm,
          activity,
          asphaltOnly: activity === "cycling" ? asphaltOnly : false,
        },
      });
      if (error) throw error;
      const result: GeneratedRoute[] = data?.routes ?? [];
      if (!result.length) {
        toast.error(data?.message ?? "Hittade inga rundor här. Prova en annan distans.");
        setRoutes([]);
        return;
      }
      setRoutes(result);
      setSelected(0);
    } catch (e: any) {
      const msg = e?.code === 1 ? "Platstillstånd nekades – tillåt plats och försök igen." : e?.message || "Kunde inte skapa rundor";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const active = routes && routes.length > 0 ? routes[Math.min(selected, routes.length - 1)] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <RouteIcon className="h-4 w-4 text-primary" /> Skapa runda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Aktivitet */}
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

          {/* Asfalt (endast cykling) */}
          {activity === "cycling" && (
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Endast asfalt</p>
                <p className="text-xs text-muted-foreground">Undvik grus- och skogsvägar</p>
              </div>
              <Switch checked={asphaltOnly} onCheckedChange={setAsphaltOnly} />
            </div>
          )}

          {/* Distans */}
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
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {active.distanceKm.toFixed(2)} km
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round(active.pavedRatio * 100)} % belagd ·{" "}
                      {active.surfaces.map((s) => SURFACE_LABELS[s] ?? s).join(", ")}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteBuilderDialog;
