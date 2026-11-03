/** Visar sparade km-splits för ett GPS-pass (snabbaste markerad). */
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export default function SavedSplits({ splits }: { splits: unknown }) {
  if (!Array.isArray(splits)) return null;
  const sp = splits.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (sp.length === 0) return null;
  const best = Math.min(...sp);
  return (
    <div className="mt-1">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Splits per km</p>
      <div className="grid grid-cols-3 gap-1">
        {sp.map((sec, i) => (
          <div key={i} className={`text-[11px] font-mono rounded px-1.5 py-0.5 ${sec === best && sp.length > 1 ? "bg-primary/15 text-primary font-bold" : "bg-secondary"}`}>
            km {i + 1}: {fmt(sec)}/km
          </div>
        ))}
      </div>
    </div>
  );
}
