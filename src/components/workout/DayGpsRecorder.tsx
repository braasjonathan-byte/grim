import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { MapPin, X } from "lucide-react";
import { sv } from "date-fns/locale";
import { fuzzyFilterSort } from "@/lib/fuzzySearch";
import IntervalRunner from "@/components/IntervalRunner";
import GpsTrackerControl from "@/components/workout/GpsTrackerControl";

// Day-level GPS recorder: first lets user pick which kondition exercise to record,
// then starts GPS tracking. On stop, saves directly to the chosen exercise.
export const DayGpsRecorder = ({ konditionExercises, onSave }: {
  konditionExercises: { name: string }[];
  onSave: (name: string, km: number, sec: number, route: [number, number][]) => Promise<void> | void;
}) => {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const names = Array.from(new Set(konditionExercises.map(e => e.name))).sort((a, b) => a.localeCompare(b, "sv"));
    return fuzzyFilterSort(names, query, (n) => [n]);
  }, [query, konditionExercises]);

  const closePicker = () => { setPickerOpen(false); setQuery(""); };

  // Håll dialogen ovanför tangentbordet (visualViewport)
  const [vv, setVv] = useState<{ h: number; top: number }>({ h: 0, top: 0 });
  useEffect(() => {
    if (!pickerOpen) return;
    const update = () => {
      const v = window.visualViewport;
      setVv({ h: v?.height || window.innerHeight, top: v?.offsetTop || 0 });
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [pickerOpen]);

  const pick = (name: string) => {
    closePicker();
    setSelectedName(name);
  };

  const isInterval = selectedName ? /intervall/i.test(selectedName) : false;

  return (
    <>
      {/* Knappen ligger alltid kvar på sin plats i rutnätet så att övriga
          knappar aldrig kastas om när GPS-vyn öppnas/stängs. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
        disabled={!!selectedName}
        className="min-h-9 gap-1.5 px-[24px] py-1 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-50"
        title="Starta GPS-inspelning"
      >
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="whitespace-nowrap">Spela in GPS</span>
      </button>

      {selectedName && (
        <div className="col-span-full order-last w-full space-y-1.5 mt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <MapPin className="w-3 h-3" /> {selectedName}
          </div>
          {isInterval ? (
            <IntervalRunner
              open
              onClose={() => setSelectedName(null)}
              exerciseName={selectedName}
              onComplete={async (res) => {
                const km = res.gpsDistanceKm && res.gpsDistanceKm > 0 ? res.gpsDistanceKm : res.totalDistKm;
                const sec = Math.round(res.totalTimeMin * 60);
                const route = res.route || [];
                const name = selectedName;
                setSelectedName(null);
                await onSave(name, km, sec, route);
              }}
            />
          ) : (
            <GpsTrackerControl
              autoStart
              onCancel={() => setSelectedName(null)}
              onStop={async (km, sec, route) => {
                const name = selectedName;
                setSelectedName(null);
                await onSave(name, km, sec, route);
              }}
            />
          )}
        </div>
      )}

      {pickerOpen && createPortal(
        <div
          className="fixed left-0 right-0 z-[10000] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ top: vv.top, height: vv.h || undefined }}
          onClick={closePicker}
        >
          <div
            className="w-full max-w-md bg-background border border-border rounded-md p-4 space-y-3 overflow-hidden flex flex-col"
            style={{ maxHeight: vv.h ? vv.h - 32 : undefined }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Välj övning att registrera</h3>
              <button
                type="button"
                onClick={closePicker}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Stäng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök övning…"
              className="w-full bg-muted/50 text-foreground text-sm px-3 py-2.5 rounded-xl border border-transparent outline-none focus:bg-background focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-colors"
            />
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1">

              {filtered.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick(name)}
                  className="w-full text-left px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary"
                >
                  {name}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Inga övningar hittades</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};






export default DayGpsRecorder;
