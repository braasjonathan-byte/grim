import { Sparkles, Dumbbell, Apple, BarChart3, Users, Calculator } from "lucide-react";
import { startTour, type TourVariant } from "@/lib/tour";

/** "Rundtur" – guidad genomgång av appen. */
const GuidedTourCard = () => (
  <div className="rounded-2xl bg-card shadow-soft border border-border/40 p-4 space-y-2">
    <div className="flex items-center gap-2">
      <Sparkles className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rundtur</span>
    </div>
    <p className="text-xs text-muted-foreground">Få en guidad tur med pilar på viktiga knappar.</p>
    <div className="flex gap-2">
      <button
        onClick={() => startTour("short")}
        className="flex-1 rounded-full bg-primary text-primary-foreground text-xs font-bold px-3 py-2 shadow-soft active:scale-95 transition-transform"
      >
        Kort rundtur
      </button>
      <button
        onClick={() => startTour("long")}
        className="flex-1 rounded-full bg-secondary text-foreground text-xs font-bold px-3 py-2 shadow-soft active:scale-95 transition-transform"
      >
        Lång rundtur
      </button>
    </div>
    <p className="text-[10px] text-muted-foreground pt-1">Eller starta tur för ett specifikt område:</p>
    <div className="grid grid-cols-2 gap-2">
      {([
        { v: "workout", label: "Träning", Icon: Dumbbell },
        { v: "nutrition", label: "Kost", Icon: Apple },
        { v: "stats", label: "Statistik", Icon: BarChart3 },
        { v: "social", label: "Social", Icon: Users },
        { v: "tools", label: "Verktyg", Icon: Calculator },
      ] as { v: TourVariant; label: string; Icon: React.ElementType }[]).map(({ v, label, Icon }) => (
        <button
          key={v}
          onClick={() => startTour(v)}
          className="flex items-center justify-center gap-1.5 rounded-full bg-muted/50 text-foreground text-xs font-bold px-3 py-2 active:scale-95 transition-transform"
        >
          <Icon className="w-3.5 h-3.5" /> {label}
        </button>
      ))}
    </div>
  </div>
);

export default GuidedTourCard;
