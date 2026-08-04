import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Loader2,
  MoveUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import RouteMap from "@/components/RouteMap";
import { Button } from "@/components/ui/button";
import type { RouteData, RoutePoint } from "@/lib/savedRoutes";

interface Step {
  instruction: string;
  maneuver: string | null;
  distanceM: number;
  end: RoutePoint;
}

const distanceM = (a: RoutePoint, b: RoutePoint) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

const maneuverIcon = (m: string | null) => {
  const v = (m ?? "").toUpperCase();
  if (v.includes("LEFT")) return CornerUpLeft;
  if (v.includes("RIGHT")) return CornerUpRight;
  if (v.includes("DESTINATION")) return Flag;
  if (v.includes("MERGE") || v.includes("FORK")) return ArrowUpRight;
  return MoveUp;
};

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const RouteNavigation = ({
  route,
  activity,
  name,
  onClose,
}: {
  route: RouteData;
  activity: string;
  name?: string;
  onClose: () => void;
}) => {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [polyline, setPolyline] = useState<RoutePoint[]>(route.points);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [position, setPosition] = useState<RoutePoint | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [voice, setVoice] = useState(true);
  const spokenRef = useRef<number>(-1);
  const watchRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("route-directions", {
        body: { points: route.points, activity },
      });
      if (fnError) throw fnError;
      const list: Step[] = (data?.steps ?? []).map((s: any) => ({
        instruction: stripHtml(String(s.instruction ?? "")),
        maneuver: s.maneuver ?? null,
        distanceM: Number(s.distanceM ?? 0),
        end: s.end as RoutePoint,
      }));
      if (!list.length) throw new Error("Ingen vägbeskrivning hittades för rundan");
      setSteps(list);
      if (Array.isArray(data?.polyline) && data.polyline.length > 1) setPolyline(data.polyline);
    } catch (e: any) {
      setError(e?.message || "Kunde inte hämta vägbeskrivning");
    } finally {
      setLoading(false);
    }
  }, [route.points, activity]);

  useEffect(() => {
    load();
  }, [load]);

  // Följ position och stega framåt i instruktionerna
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setPosition([p.coords.latitude, p.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const current = steps?.[Math.min(stepIndex, steps.length - 1)] ?? null;
  const next = steps?.[stepIndex + 1] ?? null;

  const distanceToTurn = useMemo(() => {
    if (!current || !position) return current?.distanceM ?? 0;
    return distanceM(position, current.end);
  }, [current, position]);

  // Avancera när man passerat svängen
  useEffect(() => {
    if (!steps || !position) return;
    const d = distanceM(position, steps[Math.min(stepIndex, steps.length - 1)].end);
    if (d < 25 && stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
  }, [position, steps, stepIndex]);

  // Röstguidning
  useEffect(() => {
    if (!voice || !current || typeof window === "undefined" || !window.speechSynthesis) return;
    if (spokenRef.current === stepIndex) return;
    if (distanceToTurn > 120 && spokenRef.current !== -1) return;
    spokenRef.current = stepIndex;
    const u = new SpeechSynthesisUtterance(current.instruction);
    u.lang = "sv-SE";
    window.speechSynthesis.speak(u);
  }, [stepIndex, current, voice, distanceToTurn]);

  const remainingM = useMemo(() => {
    if (!steps) return route.distanceKm * 1000;
    return steps.slice(stepIndex).reduce((s, st) => s + st.distanceM, 0);
  }, [steps, stepIndex, route.distanceKm]);

  const Icon = maneuverIcon(current?.maneuver ?? null);
  const mapRoute = position ? [...polyline] : polyline;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Instruktionsbanner */}
      <div className="shrink-0 bg-primary text-primary-foreground px-4 py-3">
        <div className="flex items-start gap-3">
          <button onClick={onClose} className="mt-0.5 rounded-full p-1.5 hover:bg-primary-foreground/15" aria-label="Stäng">
            <ArrowLeft className="h-5 w-5" />
          </button>
          {loading ? (
            <div className="flex items-center gap-2 py-1 text-sm font-semibold">
              <Loader2 className="h-4 w-4 animate-spin" /> Hämtar vägbeskrivning…
            </div>
          ) : error ? (
            <div className="flex-1">
              <p className="text-sm font-bold">Vägbeskrivning misslyckades</p>
              <p className="text-xs opacity-80">{error}</p>
              <Button size="sm" variant="secondary" className="mt-2 rounded-full" onClick={load}>
                Försök igen
              </Button>
            </div>
          ) : (
            <>
              <Icon className="h-9 w-9 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-black leading-none tabular-nums">{fmtDist(distanceToTurn)}</p>
                <p className="mt-1 text-sm font-semibold leading-snug">{current?.instruction}</p>
                {next && <p className="mt-1 truncate text-[11px] opacity-75">Sedan: {next.instruction}</p>}
              </div>
            </>
          )}
          <button
            onClick={() => {
              setVoice((v) => !v);
              window.speechSynthesis?.cancel();
            }}
            className="mt-0.5 rounded-full p-1.5 hover:bg-primary-foreground/15"
            aria-label={voice ? "Stäng av röst" : "Slå på röst"}
          >
            {voice ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Karta */}
      <div className="relative min-h-0 flex-1">
        <RouteMap route={mapRoute} height={0} className="absolute inset-0 h-full" live={!!position} />
      </div>

      {/* Botten */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-black tabular-nums text-foreground">{fmtDist(remainingM)}</p>
            <p className="text-[11px] text-muted-foreground">
              {name ? `${name} · ` : ""}kvar av rundan
              {route.elevationGainM != null ? ` · ↑ ${Math.round(route.elevationGainM)} m` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {steps && (
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setListOpen((o) => !o)}>
                <ChevronUp className={`mr-1 h-4 w-4 transition-transform ${listOpen ? "rotate-180" : ""}`} /> Steg
              </Button>
            )}
            <Button size="sm" variant="destructive" className="rounded-full" onClick={onClose}>
              <X className="mr-1 h-4 w-4" /> Avsluta
            </Button>
          </div>
        </div>

        {listOpen && steps && (
          <ol className="mt-3 max-h-56 space-y-1 overflow-y-auto">
            {steps.map((s, i) => {
              const SIcon = maneuverIcon(s.maneuver);
              return (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
                    i === stepIndex ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <SIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{s.instruction}</span>
                  <span className="tabular-nums">{fmtDist(s.distanceM)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default RouteNavigation;
