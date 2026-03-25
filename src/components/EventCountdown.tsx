import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Target, Trash2, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { format, differenceInDays, differenceInWeeks } from "date-fns";
import { sv } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EVENT_TYPES = [
  { value: "halvmaraton", label: "Halvmaraton", emoji: "🏃" },
  { value: "maraton", label: "Maraton", emoji: "🏃‍♂️" },
  { value: "5k", label: "5 km", emoji: "🏃" },
  { value: "10k", label: "10 km", emoji: "🏃" },
  { value: "styrkelyft", label: "Styrkelyftstävling", emoji: "🏋️" },
  { value: "crossfit", label: "CrossFit-tävling", emoji: "💪" },
  { value: "hinderbana", label: "Hinderbana", emoji: "🧗" },
  { value: "simning", label: "Simtävling", emoji: "🏊" },
  { value: "cykling", label: "Cykellopp", emoji: "🚴" },
  { value: "triathlon", label: "Triathlon", emoji: "🏊🚴🏃" },
  { value: "annat", label: "Annat", emoji: "🎯" },
];

type Tip = { title: string; text: string };

function getTips(eventType: string, daysLeft: number): Tip[] {
  const weeksLeft = Math.ceil(daysLeft / 7);
  const tips: Tip[] = [];

  const isRunning = ["halvmaraton", "maraton", "5k", "10k"].includes(eventType);
  const isStrength = ["styrkelyft"].includes(eventType);

  if (daysLeft <= 0) {
    tips.push({ title: "Idag är dagen! 🔥", text: "Ge allt! Du har tränat för det här. Lita på din kropp." });
    return tips;
  }

  if (daysLeft === 1) {
    tips.push({ title: "Imorgon är det dags!", text: "Vila idag. Förbered kläder, mat och utrustning. Lägg dig tidigt." });
    return tips;
  }

  if (daysLeft <= 3) {
    tips.push({ title: "Sista dagarna", text: "Håll träningen kort och lätt. Fokusera på sömn och näringsintag." });
    if (isRunning) tips.push({ title: "Carb loading", text: "Öka kolhydratintaget de sista 2-3 dagarna för att fylla glykogenlagren." });
    return tips;
  }

  if (daysLeft <= 7) {
    tips.push({ title: "Sista veckan 📅", text: "Minska volymen med 40-60%. Korta, lätta pass med några intensiva inslag." });
    if (isRunning) {
      tips.push({ title: "Tapering", text: "Kör max 2-3 korta löppass. Behåll tempot men minska distansen rejält." });
      tips.push({ title: "Testa utrustningen", text: "Kör i exakt de skor och kläder du ska tävla i. Inga nya grejer på tävlingsdagen!" });
    }
    if (isStrength) tips.push({ title: "Openers", text: "Kör lätta openers 2-3 dagar före. Teknikfokus, inga tunga lyft." });
    return tips;
  }

  if (daysLeft <= 14) {
    tips.push({ title: "2 veckor kvar", text: "Börja minska träningsvolymen (tapering). Behåll intensiteten men kör färre set/km." });
    if (isRunning) tips.push({ title: "Sista långpasset", text: "Kör ditt sista riktigt långa pass nu. Inte för nära tävlingen." });
    if (isStrength) tips.push({ title: "Sista tunga veckan", text: "Den här veckan kan du fortfarande lyfta tungt. Nästa vecka börjar du trappa ner." });
    return tips;
  }

  if (daysLeft <= 30) {
    tips.push({ title: `${weeksLeft} veckor kvar`, text: "Fortsätt träna som vanligt men börja finslipa detaljer som sömnrutiner och kost." });
    if (isRunning) tips.push({ title: "Tempopass", text: "Lägg in specifika tempopass som simulerar tävlingsfart." });
    return tips;
  }

  if (daysLeft <= 60) {
    tips.push({ title: `${weeksLeft} veckor kvar`, text: "Bra tid att bygga specifik uthållighet. Fokusera på tävlingsspecifik träning." });
    return tips;
  }

  tips.push({ title: `${weeksLeft} veckor kvar`, text: "Du har gott om tid! Bygg en stabil bas och öka gradvis." });
  return tips;
}

interface EventCountdownProps {
  userId: string;
}

interface EventData {
  id: string;
  event_name: string;
  event_date: string;
  event_type: string;
}

const EventCountdown = ({ userId }: EventCountdownProps) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [type, setType] = useState("halvmaraton");
  const [customType, setCustomType] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvent();
  }, [userId]);

  const loadEvent = async () => {
    const { data } = await supabase
      .from("event_countdowns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setEvent(data as EventData);
      setName(data.event_name);
      setDate(new Date(data.event_date));
      if (data.event_type.startsWith("annat:")) {
        setType("annat");
        setCustomType(data.event_type.slice(6));
      } else {
        setType(data.event_type);
        setCustomType("");
      }
    }
    setLoading(false);
  };

  const saveEvent = async () => {
    if (!name.trim() || !date) {
      toast.error("Fyll i namn och datum");
      return;
    }

    const payload = {
      user_id: userId,
      event_name: name.trim(),
      event_date: format(date, "yyyy-MM-dd"),
      event_type: type,
    };

    if (event) {
      await supabase.from("event_countdowns").update(payload).eq("id", event.id);
    } else {
      await supabase.from("event_countdowns").insert(payload);
    }
    toast.success("Event sparat!");
    loadEvent();
  };

  const deleteEvent = async () => {
    if (!event) return;
    await supabase.from("event_countdowns").delete().eq("id", event.id);
    setEvent(null);
    setName("");
    setDate(undefined);
    setType("halvmaraton");
    toast.success("Event borttaget");
  };

  const daysLeft = event && date ? differenceInDays(new Date(event.event_date), new Date()) : null;
  const tips = event && daysLeft !== null ? getTips(event.event_type, daysLeft) : [];
  const eventTypeInfo = EVENT_TYPES.find(e => e.value === (event?.event_type || type));

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-bold text-sm">Nedräkning till event</h3>
        </div>
        {event && daysLeft !== null && daysLeft > 0 && (
          <span className="text-xs font-semibold text-muted-foreground">
            {eventTypeInfo?.emoji} {daysLeft} dagar kvar
          </span>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-3 pt-2">
          {/* Event name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Eventnamn</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="t.ex. Göteborgs Halvmaraton"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          {/* Event type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Typ av event</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
            >
              {EVENT_TYPES.map(et => (
                <option key={et.value} value={et.value}>{et.emoji} {et.label}</option>
              ))}
            </select>
            {type === "annat" && (
              <input
                value={customType}
                onChange={e => setCustomType(e.target.value)}
                placeholder="Beskriv ditt event, t.ex. Tough Viking"
                className="w-full mt-2 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
              />
            )}
          </div>

          {/* Event date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Datum</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "d MMMM yyyy", { locale: sv }) : "Välj datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  disabled={d => d < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={saveEvent} size="sm" className="flex-1">
              {event ? "Uppdatera" : "Spara"}
            </Button>
            {event && (
              <Button onClick={deleteEvent} size="sm" variant="destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Tips */}
          {tips.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-warning" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tips</span>
              </div>
              {tips.map((tip, i) => (
                <div key={i} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-semibold">{tip.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tip.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventCountdown;
