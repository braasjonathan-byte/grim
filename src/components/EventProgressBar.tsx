import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

type Tip = { title: string; text: string };

function getTipsForBar(eventType: string, daysLeft: number): Tip[] {
  const weeksLeft = Math.ceil(daysLeft / 7);
  const tips: Tip[] = [];
  const baseType = eventType.startsWith("annat:") ? "annat" : eventType;
  const isRunning = ["halvmaraton", "maraton", "5k", "10k"].includes(baseType);
  const isStrength = ["styrkelyft"].includes(baseType);
  const isCycling = baseType === "cykling";
  const isSwimming = baseType === "simning";
  const isTriathlon = baseType === "triathlon";
  const isCrossfit = baseType === "crossfit";
  const isObstacle = baseType === "hinderbana";

  if (daysLeft <= 0) {
    tips.push({ title: "Idag är dagen! 🔥", text: "Ge allt! Du har tränat för det här." });
    return tips;
  }
  if (daysLeft === 1) {
    tips.push({ title: "Imorgon är det dags!", text: "Vila idag. Förbered kläder, mat och utrustning." });
    return tips;
  }
  if (daysLeft <= 3) {
    tips.push({ title: "Sista dagarna", text: "Håll träningen kort och lätt. Fokusera på sömn." });
    if (isRunning || isTriathlon) tips.push({ title: "Carb loading", text: "Öka kolhydratintaget för att fylla glykogenlagren." });
    return tips;
  }
  if (daysLeft <= 7) {
    tips.push({ title: "Sista veckan 📅", text: "Minska volymen med 40-60%. Korta, lätta pass." });
    if (isRunning) tips.push({ title: "Tapering", text: "Max 2-3 korta löppass. Behåll tempot, minska distansen." });
    if (isStrength) tips.push({ title: "Openers", text: "Lätta openers 2-3 dagar före. Teknikfokus." });
    if (isSwimming) tips.push({ title: "Känn av vattnet", text: "Korta pass med tävlingstempo." });
    if (isTriathlon) tips.push({ title: "Brick-pass", text: "Kort cykel+löpning tidigt i veckan, sedan vila." });
    if (isCrossfit) tips.push({ title: "Mobilitet", text: "Fokusera på mobilitet och aktivering." });
    if (isObstacle) tips.push({ title: "Grepp", text: "Öva lätt på grepp och hinder." });
    return tips;
  }
  if (daysLeft <= 14) {
    tips.push({ title: "2 veckor kvar", text: "Börja trappa ner volymen. Behåll intensiteten." });
    if (isRunning) tips.push({ title: "Sista långpasset", text: "Kör ditt sista långa pass nu." });
    if (isStrength) tips.push({ title: "Sista tunga veckan", text: "Fortfarande ok att lyfta tungt denna vecka." });
    if (isCycling) tips.push({ title: "Ruttplanering", text: "Studera banan och planera strategi." });
    return tips;
  }
  if (daysLeft <= 30) {
    tips.push({ title: `${weeksLeft} veckor kvar`, text: "Finslipa detaljer som sömnrutiner och kost." });
    if (isRunning) tips.push({ title: "Tempopass", text: "Specifika tempopass i tävlingsfart." });
    if (isCycling) tips.push({ title: "Långpass", text: "Kör ett längre pass i veckan i tävlingstempo." });
    return tips;
  }
  if (daysLeft <= 60) {
    tips.push({ title: `${weeksLeft} veckor kvar`, text: "Bygg specifik uthållighet med tävlingsspecifik träning." });
    return tips;
  }
  tips.push({ title: `${weeksLeft} veckor kvar`, text: "Du har gott om tid! Bygg en stabil bas." });
  return tips;
}

interface EventProgressBarProps {
  userId: string;
}

const EventProgressBar = ({ userId }: EventProgressBarProps) => {
  const [event, setEvent] = useState<{ event_name: string; event_date: string; event_type: string; created_at: string } | null>(null);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    supabase
      .from("event_countdowns")
      .select("event_name, event_date, event_type, created_at")
      .eq("user_id", userId)
      .gte("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setEvent(data);
      });
  }, [userId]);

  if (!event) return null;

  const now = new Date();
  const eventDate = new Date(event.event_date);
  const createdDate = new Date(event.created_at);
  const totalDays = differenceInDays(eventDate, createdDate);
  const daysLeft = differenceInDays(eventDate, now);

  if (daysLeft < 0 || totalDays <= 0) return null;

  const progress = Math.min(100, Math.max(0, ((totalDays - daysLeft) / totalDays) * 100));
  const tips = getTipsForBar(event.event_type, daysLeft);

  return (
    <div className="mb-3">
      <button
        onClick={() => setShowTips(!showTips)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate max-w-[60%]">
            {event.event_name}
          </span>
          <div className="flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-yellow-500" />
            <span className="text-[10px] font-bold text-muted-foreground">
              {daysLeft} {daysLeft === 1 ? "dag" : "dagar"} kvar
            </span>
            {showTips ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, hsl(var(--muted-foreground) / 0.4), hsl(var(--muted-foreground) / 0.6), hsl(var(--muted-foreground) / 0.2))",
            }}
          />
        </div>
      </button>

      {showTips && tips.length > 0 && (
        <div className="mt-2 space-y-1.5 bg-muted/30 rounded-lg p-2.5">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <Lightbulb className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground"><strong className="text-foreground">{tip.title}:</strong> {tip.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventProgressBar;
