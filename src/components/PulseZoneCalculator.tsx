import { useState } from "react";
import { Heart } from "lucide-react";

const ZONES = [
  { name: "Zon 1 – Återhämtning", min: 0.50, max: 0.60, color: "bg-blue-500/20 text-blue-400" },
  { name: "Zon 2 – Grundläggande uthållighet", min: 0.60, max: 0.70, color: "bg-green-500/20 text-green-400" },
  { name: "Zon 3 – Aerob kapacitet", min: 0.70, max: 0.80, color: "bg-yellow-500/20 text-yellow-400" },
  { name: "Zon 4 – Tröskel / Anaerob", min: 0.80, max: 0.90, color: "bg-orange-500/20 text-orange-400" },
  { name: "Zon 5 – Max / VO2max", min: 0.90, max: 1.00, color: "bg-red-500/20 text-red-400" },
];

const PulseZoneCalculator = () => {
  const [age, setAge] = useState(25);
  const [restHR, setRestHR] = useState(60);
  const [open, setOpen] = useState(false);

  const maxHR = 220 - age;

  // Karvonen formula: target = ((maxHR - restHR) * intensity) + restHR
  const karvonen = (pct: number) => Math.round((maxHR - restHR) * pct + restHR);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-secondary transition-colors"
      >
        <Heart className="w-5 h-5 text-destructive" />
        <span className="font-semibold text-sm">Pulszonskalkylator</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? "Stäng" : "Öppna"}
        </span>
      </button>

      {open && (
        <div className="p-4 border-t border-border space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ålder</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                min={10}
                max={100}
                className="w-full bg-secondary text-foreground text-lg font-mono p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vilopuls (bpm)</label>
              <input
                type="number"
                value={restHR}
                onChange={(e) => setRestHR(Number(e.target.value))}
                min={30}
                max={120}
                className="w-full bg-secondary text-foreground text-lg font-mono p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="text-center p-3 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground">Beräknad maxpuls</p>
            <p className="text-3xl font-black text-destructive">{maxHR} bpm</p>
            <p className="text-xs text-muted-foreground mt-1">Karvonen-metoden</p>
          </div>

          <div className="space-y-2">
            {ZONES.map((zone) => (
              <div
                key={zone.name}
                className={`flex items-center justify-between p-3 rounded-md ${zone.color}`}
              >
                <span className="text-xs font-semibold">{zone.name}</span>
                <span className="font-mono text-sm font-bold">
                  {karvonen(zone.min)}–{karvonen(zone.max)} bpm
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PulseZoneCalculator;
