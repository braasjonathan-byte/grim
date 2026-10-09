import { useState } from "react";
import { Calculator } from "lucide-react";
import { epley1RM, epleyWeightForReps } from "@/lib/strengthStats";

const REP_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];

const OneRMCalculator = () => {
  const [weight, setWeight] = useState(100);
  const [reps, setReps] = useState(5);
  const [open, setOpen] = useState(false);

  // Epley formula
  const exact1RM = epley1RM(weight, reps);
  const oneRM = Math.round(exact1RM);

  return (
    <div className="border border-border rounded-lg bg-secondary overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-secondary transition-colors"
      >
        <Calculator className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm">1RM Kalkylator</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? "Stäng" : "Öppna"}
        </span>
      </button>

      {open && (
        <div className="p-4 border-t border-border space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vikt (kg)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(weight)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  setWeight(Number(cleaned) || 0);
                }}
                className="w-full bg-secondary text-foreground text-lg font-mono p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reps</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(reps)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  const n = Number(cleaned) || 0;
                  setReps(Math.max(1, Math.min(30, n || 1)));
                }}
                className="w-full bg-secondary text-foreground text-lg font-mono p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="text-center p-3 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground">Beräknad 1RM (Epley)</p>
            <p className="text-3xl font-black text-primary">{oneRM} kg</p>
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-semibold">Uppskattad vikt för X reps</p>
            <p className="text-[10px] text-muted-foreground">Räknat baklänges från din 1RM med samma formel. Din rad ({reps} rep) visar vikten du skrev in.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[...new Set([...REP_ROWS, reps])].sort((a, b) => a - b).map((r) => (
              <div
                key={r}
                className={`flex justify-between p-2 rounded-md ${
                  r === reps ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                }`}
              >
                <span>{r} rep</span>
                <span className="font-mono font-semibold">
                  {r === reps ? weight : Math.round(epleyWeightForReps(exact1RM, r))} kg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OneRMCalculator;
