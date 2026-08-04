import { useState, useMemo } from "react";
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

  const pick = (name: string) => {
    closePicker();
    setSelectedName(name);
  };

  if (selectedName) {
    const isInterval = /intervall/i.test(selectedName);
    if (isInterval) {
      return (
        <div className="col-span-2 w-full space-y-1.5 mt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <MapPin className="w-3 h-3" /> {selectedName}
          </div>
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
        </div>
      );
    }
    return (
      <div className="col-span-2 w-full space-y-1.5 mt-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <MapPin className="w-3 h-3" /> {selectedName}
        </div>
        <GpsTrackerControl
          autoStart
          onStop={async (km, sec, route) => {
            const name = selectedName;
            setSelectedName(null);
            await onSave(name, km, sec, route);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
        className="min-h-9 gap-1.5 px-[24px] py-1 text-xs text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted flex items-center justify-center"
        title="Starta GPS-inspelning"
      >
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="whitespace-nowrap">Spela in GPS</span>
      </button>
      {pickerOpen && createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={closePicker}
        >
          <div
            className="w-full max-w-md bg-background border border-border rounded-md p-4 space-y-3"
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
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto space-y-1">
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
