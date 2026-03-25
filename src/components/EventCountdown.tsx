import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Target, Trash2, ChevronDown, ChevronUp, Lightbulb, Search, Plus } from "lucide-react";
import { format, differenceInDays, eachDayOfInterval } from "date-fns";
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
  const baseType = eventType.startsWith("annat:") ? "annat" : eventType;
  const isRunning = ["halvmaraton", "maraton", "5k", "10k"].includes(baseType);
  const isStrength = ["styrkelyft"].includes(baseType);
  const isCycling = baseType === "cykling";
  const isSwimming = baseType === "simning";
  const isTriathlon = baseType === "triathlon";
  const isCrossfit = baseType === "crossfit";
  const isObstacle = baseType === "hinderbana";

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
    if (isRunning || isTriathlon) tips.push({ title: "Carb loading", text: "Öka kolhydratintaget de sista 2-3 dagarna för att fylla glykogenlagren." });
    if (isCycling) tips.push({ title: "Kolla cykeln", text: "Kontrollera däcktryck, kedja och bromsar. Packa reservslang." });
    return tips;
  }
  if (daysLeft <= 7) {
    tips.push({ title: "Sista veckan 📅", text: "Minska volymen med 40-60%. Korta, lätta pass med några intensiva inslag." });
    if (isRunning) {
      tips.push({ title: "Tapering", text: "Kör max 2-3 korta löppass. Behåll tempot men minska distansen rejält." });
      tips.push({ title: "Testa utrustningen", text: "Kör i exakt de skor och kläder du ska tävla i. Inga nya grejer på tävlingsdagen!" });
    }
    if (isStrength) tips.push({ title: "Openers", text: "Kör lätta openers 2-3 dagar före. Teknikfokus, inga tunga lyft." });
    if (isSwimming) tips.push({ title: "Känn av vattnet", text: "Simma korta pass med tävlingstempo för att hålla känslan." });
    if (isTriathlon) tips.push({ title: "Brick-pass", text: "Kör ett kort brick-pass (cykel + löpning) tidigt i veckan, sedan vila." });
    if (isCrossfit) tips.push({ title: "Mobilitet", text: "Fokusera på mobilitet och aktivering. Inga tunga WODs." });
    if (isObstacle) tips.push({ title: "Grepp & klättring", text: "Öva lätt på grepp och hinder. Fetta inte in händerna." });
    return tips;
  }
  if (daysLeft <= 14) {
    tips.push({ title: "2 veckor kvar", text: "Börja minska träningsvolymen (tapering). Behåll intensiteten men kör färre set/km." });
    if (isRunning) tips.push({ title: "Sista långpasset", text: "Kör ditt sista riktigt långa pass nu. Inte för nära tävlingen." });
    if (isStrength) tips.push({ title: "Sista tunga veckan", text: "Den här veckan kan du fortfarande lyfta tungt. Nästa vecka börjar du trappa ner." });
    if (isCycling) tips.push({ title: "Ruttplanering", text: "Studera banan och planera din strategi för stigningar och energiintag." });
    if (isTriathlon) tips.push({ title: "Övergångar", text: "Öva på T1 och T2. Snabba övergångar kan spara minuter." });
    return tips;
  }
  if (daysLeft <= 30) {
    tips.push({ title: `${weeksLeft} veckor kvar`, text: "Fortsätt träna som vanligt men börja finslipa detaljer som sömnrutiner och kost." });
    if (isRunning) tips.push({ title: "Tempopass", text: "Lägg in specifika tempopass som simulerar tävlingsfart." });
    if (isStrength) tips.push({ title: "Accessory-arbete", text: "Fokusera på svaga punkter i dina lyft med specifikt accessory-arbete." });
    if (isCycling) tips.push({ title: "Långpass", text: "Kör ett längre pass i veckan i tävlingstempo." });
    if (isSwimming) tips.push({ title: "Teknikfokus", text: "Jobba på effektivitet i vattnet – minimera motstånd och förbättra vändningar." });
    return tips;
  }
  if (daysLeft <= 60) {
    tips.push({ title: `${weeksLeft} veckor kvar`, text: "Bra tid att bygga specifik uthållighet. Fokusera på tävlingsspecifik träning." });
    if (isRunning) tips.push({ title: "Bygg distans", text: "Öka gradvis din längsta distans. Max 10% mer per vecka." });
    if (isCrossfit) tips.push({ title: "Svagheter", text: "Identifiera och jobba på dina svagaste rörelser nu när du har tid." });
    return tips;
  }
  tips.push({ title: `${weeksLeft} veckor kvar`, text: "Du har gott om tid! Bygg en stabil bas och öka gradvis." });
  if (isRunning) tips.push({ title: "Basträning", text: "Bygg en stark aerob bas med lugna distanspass. Skynda inte!" });
  if (isStrength) tips.push({ title: "Volymfas", text: "Perfekt tid för hypertrofi och volymträning innan du går in i styrkeblock." });
  return tips;
}

interface EventCountdownProps {
  userId: string;
}

interface EventData {
  id: string;
  event_name: string;
  event_date: string;
  end_date: string | null;
  event_type: string;
}

interface PopularEvent {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  event_type: string;
  city: string | null;
}

const EventCountdown = ({ userId }: EventCountdownProps) => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [type, setType] = useState("halvmaraton");
  const [customType, setCustomType] = useState("");

  // Autocomplete
  const [suggestions, setSuggestions] = useState<PopularEvent[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadEvents(); }, [userId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadEvents = async () => {
    const { data } = await supabase
      .from("event_countdowns")
      .select("*")
      .eq("user_id", userId)
      .order("event_date", { ascending: true });
    if (data) setEvents(data as EventData[]);
    setLoading(false);
  };

  const resetForm = () => {
    setName(""); setDate(undefined); setEndDate(undefined);
    setType("halvmaraton"); setCustomType(""); setEditingId(null); setShowForm(false);
  };

  const startEdit = (ev: EventData) => {
    setName(ev.event_name);
    setDate(new Date(ev.event_date));
    setEndDate(ev.end_date ? new Date(ev.end_date) : undefined);
    if (ev.event_type.startsWith("annat:")) {
      setType("annat"); setCustomType(ev.event_type.slice(6));
    } else {
      setType(ev.event_type); setCustomType("");
    }
    setEditingId(ev.id);
    setShowForm(true);
  };

  const searchPopularEvents = (query: string) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    if (query.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("popular_events").select("*").ilike("name", `%${query}%`).limit(8);
      if (data && data.length > 0) { setSuggestions(data as PopularEvent[]); setShowSuggestions(true); }
      else { setSuggestions([]); setShowSuggestions(false); }
    }, 200);
    setSearchTimeout(t);
  };

  const selectPopularEvent = (pe: PopularEvent) => {
    setName(pe.name); setDate(new Date(pe.start_date));
    setEndDate(pe.end_date ? new Date(pe.end_date) : undefined);
    setType(pe.event_type); setCustomType("");
    setShowSuggestions(false); setSuggestions([]);
  };

  const saveEvent = async () => {
    if (!name.trim() || !date) { toast.error("Fyll i namn och datum"); return; }
    const resolvedType = type === "annat" && customType.trim() ? `annat:${customType.trim()}` : type;
    const payload = {
      user_id: userId,
      event_name: name.trim(),
      event_date: format(date, "yyyy-MM-dd"),
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      event_type: resolvedType,
    };
    if (editingId) {
      await supabase.from("event_countdowns").update(payload).eq("id", editingId);
    } else {
      await supabase.from("event_countdowns").insert(payload);
    }

    // Save custom events to popular_events so others can discover them
    const eventNameTrimmed = name.trim();
    try {
      const { data: existingPopular } = await supabase
        .from("popular_events")
        .select("id")
        .ilike("name", eventNameTrimmed)
        .maybeSingle();

      if (!existingPopular) {
        await supabase.from("popular_events").insert({
          name: eventNameTrimmed,
          start_date: format(date, "yyyy-MM-dd"),
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          event_type: resolvedType.startsWith("annat:") ? "annat" : resolvedType,
          city: null,
          country: "Sverige",
        }).then(() => {});
      }
    } catch {}

    // Auto-create/join event group for this event
    try {
      const { data: existingGroup } = await supabase
        .from("event_groups")
        .select("id")
        .ilike("event_name", eventNameTrimmed)
        .maybeSingle();

      let groupId: string;
      if (existingGroup) {
        groupId = existingGroup.id;
      } else {
        const { data: newGroup } = await supabase
          .from("event_groups")
          .insert({
            event_name: eventNameTrimmed,
            event_date: format(date, "yyyy-MM-dd"),
            event_end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
            event_type: resolvedType,
            created_by: userId,
            is_auto: true,
          })
          .select("id")
          .single();
        groupId = newGroup!.id;
      }

      // Join the group
      await supabase
        .from("event_group_members")
        .upsert({ group_id: groupId, user_id: userId }, { onConflict: "group_id,user_id" });
    } catch {}

    toast.success("Event sparat!");
    resetForm();
    loadEvents();
  };

  const deleteEvent = async (id: string) => {
    await supabase.from("event_countdowns").delete().eq("id", id);
    toast.success("Event borttaget");
    loadEvents();
  };

  const getEventTypeInfo = (eventType: string) =>
    EVENT_TYPES.find(e => e.value === (eventType.startsWith("annat") ? "annat" : eventType));

  // Closest upcoming event for header display
  const upcomingEvents = events.filter(e => differenceInDays(new Date(e.event_date), new Date()) >= 0);
  const nextEvent = upcomingEvents[0];
  const nextDaysLeft = nextEvent ? differenceInDays(new Date(nextEvent.event_date), new Date()) : null;

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-bold text-sm">Nedräkning till event</h3>
          {events.length > 0 && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-semibold">{events.length}</span>
          )}
        </div>
        {nextEvent && nextDaysLeft !== null && nextDaysLeft >= 0 && (
          <span className="text-xs font-semibold text-muted-foreground">
            {getEventTypeInfo(nextEvent.event_type)?.emoji} {nextDaysLeft}d
          </span>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-3 pt-2">
          {/* List existing events */}
          {events.map(ev => {
            const daysLeft = differenceInDays(new Date(ev.event_date), new Date());
            const info = getEventTypeInfo(ev.event_type);
            const tips = getTips(ev.event_type, daysLeft);
            const eventDays: Date[] = [];
            const startD = new Date(ev.event_date);
            if (ev.end_date) {
              try { eventDays.push(...eachDayOfInterval({ start: startD, end: new Date(ev.end_date) })); } catch {}
            }

            return (
              <div key={ev.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{info?.emoji}</span>
                      <span className="text-sm font-bold truncate">{ev.event_name}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {format(startD, "d MMM yyyy", { locale: sv })}
                      {ev.end_date && ` – ${format(new Date(ev.end_date), "d MMM yyyy", { locale: sv })}`}
                      {ev.end_date && <span className="ml-1 text-green-500">({eventDays.length} dagar)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {daysLeft >= 0 && (
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full",
                        daysLeft <= 7 ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"
                      )}>
                        {daysLeft === 0 ? "Idag!" : `${daysLeft}d`}
                      </span>
                    )}
                    <button onClick={() => startEdit(ev)} className="text-muted-foreground hover:text-foreground p-1">
                      <CalendarIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteEvent(ev.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tips for this event */}
                {tips.length > 0 && daysLeft >= 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    {tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Lightbulb className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-muted-foreground"><strong>{tip.title}:</strong> {tip.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {events.length === 0 && !showForm && (
            <p className="text-xs text-muted-foreground text-center py-2">Inga event tillagda ännu.</p>
          )}

          {/* Add new event button */}
          {!showForm && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} variant="outline" size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-1.5" /> Lägg till event
            </Button>
          )}

          {/* Add/Edit form */}
          {showForm && (
            <div className="space-y-3 border border-border rounded-lg p-3 bg-background">
              <h4 className="text-xs font-bold">{editingId ? "Redigera event" : "Nytt event"}</h4>

              {/* Event name with autocomplete */}
              <div className="relative" ref={suggestionsRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={name}
                    onChange={e => { setName(e.target.value); searchPopularEvents(e.target.value); }}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    placeholder="Sök eller skriv in event..."
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                  />
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {suggestions.map(pe => (
                      <button key={pe.id} onClick={() => selectPopularEvent(pe)}
                        className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0">
                        <div className="text-sm font-medium">{pe.name}</div>
                        <div className="text-[10px] text-muted-foreground flex gap-2">
                          <span>{format(new Date(pe.start_date), "d MMM yyyy", { locale: sv })}</span>
                          {pe.city && <span>• {pe.city}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Event type */}
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                {EVENT_TYPES.map(et => (
                  <option key={et.value} value={et.value}>{et.emoji} {et.label}</option>
                ))}
              </select>
              {type === "annat" && (
                <input value={customType} onChange={e => setCustomType(e.target.value)}
                  placeholder="Beskriv ditt event" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none" />
              )}

              {/* Date picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date
                      ? endDate
                        ? `${format(date, "d MMM", { locale: sv })} – ${format(endDate, "d MMM yyyy", { locale: sv })}`
                        : format(date, "d MMMM yyyy", { locale: sv })
                      : "Välj datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus
                    className="p-3 pointer-events-auto" disabled={d => d < new Date()}
                    modifiers={endDate && date ? { eventDay: eachDayOfInterval({ start: date, end: endDate }) } : {}}
                    modifiersStyles={{ eventDay: { backgroundColor: "hsl(142 71% 45%)", color: "white", borderRadius: "4px" } }}
                  />
                </PopoverContent>
              </Popover>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button onClick={saveEvent} size="sm" className="flex-1">
                  {editingId ? "Uppdatera" : "Spara"}
                </Button>
                <Button onClick={resetForm} size="sm" variant="ghost">Avbryt</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventCountdown;
