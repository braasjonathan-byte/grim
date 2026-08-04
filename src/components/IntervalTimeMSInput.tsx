import { useEffect, useState } from "react";

interface Props {
  /** Stored time in decimal minutes, e.g. "0.2" = 12 sec, "5" = 5 min, "5.5" = 5 min 30 sec */
  valueMinDecimal: string;
  onSave: (decimalMinutes: string) => void;
  className?: string;
}

const decimalToMS = (v: string): { m: string; s: string } => {
  const n = parseFloat((v || "").replace(",", "."));
  if (!isFinite(n) || n <= 0) return { m: "", s: "" };
  const totalSec = Math.round(n * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return { m: m > 0 ? String(m) : "", s: s > 0 ? String(s) : "" };
};

export default function IntervalTimeMSInput({ valueMinDecimal, onSave, className }: Props) {
  const init = decimalToMS(valueMinDecimal);
  const [mm, setMm] = useState(init.m);
  const [ss, setSs] = useState(init.s);

  // Resync if upstream value changes (e.g. auto-calc from tempo/distance change)
  useEffect(() => {
    const next = decimalToMS(valueMinDecimal);
    setMm(next.m);
    setSs(next.s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMinDecimal]);

  const commit = (mVal: string, sVal: string) => {
    const m = parseInt(mVal) || 0;
    const s = parseInt(sVal) || 0;
    if (m === 0 && s === 0) {
      if (valueMinDecimal !== "") onSave("");
      return;
    }
    const decimal = m + s / 60;
    const str = String(Math.round(decimal * 1000) / 1000);
    if (str !== valueMinDecimal) onSave(str);
  };

  const cls =
    className ||
    "w-full min-w-0 bg-primary/10 text-foreground text-xs px-1 py-1.5 rounded-md border border-primary/20 text-center font-mono tabular-nums focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground placeholder:font-normal";

  return (
    <div className="grid grid-cols-2 gap-1 min-w-0">
      <div className="min-w-0 flex flex-col items-center">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={mm}
          placeholder="0"
          onChange={(e) => setMm(e.target.value)}
          onBlur={() => commit(mm, ss)}
          className={cls}
        />
        <span className="text-[9px] leading-tight text-muted-foreground mt-0.5">min</span>
      </div>
      <div className="min-w-0 flex flex-col items-center">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={ss}
          placeholder="0"
          onChange={(e) => setSs(e.target.value)}
          onBlur={() => commit(mm, ss)}
          className={cls}
        />
        <span className="text-[9px] leading-tight text-muted-foreground mt-0.5">sek</span>
      </div>
    </div>
  );
}
