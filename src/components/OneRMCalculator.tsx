import { useState } from "react";
import { Calculator } from "lucide-react";

const PERCENTAGES = [
  [1, 100], [2, 97], [3, 94], [4, 92], [5, 89],
  [6, 86], [7, 83], [8, 81], [9, 78], [10, 75],
  [12, 71], [15, 67], [20, 60],
];

const OneRMCalculator = () => {
  const [weight, setWeight] = useState(100);
  const [reps, setReps] = useState(5);
  const [open, setOpen] = useState(false);

  // Epley formula
  const oneRM = reps === 1 ? weight : Math.round(weight * (1 + reps / 30));

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
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full bg-secondary text-foreground text-lg font-mono p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reps</label>
              <input
                type="number"
                value={reps}
                onChange={(e) => setReps(Number(e.target.value))}
                min={1}
                max={30}
                className="w-full bg-secondary text-foreground text-lg font-mono p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="text-center p-3 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground">Beräknad 1RM (Epley)</p>
            <p className="text-3xl font-black text-primary">{oneRM} kg</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            {PERCENTAGES.map(([r, pct]) => (
              <div
                key={r}
                className={`flex justify-between p-2 rounded-md ${
                  r === reps ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                }`}
              >
                <span>{r} rep</span>
                <span className="font-mono font-semibold">
                  {Math.round((oneRM * pct) / 100)} kg
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
