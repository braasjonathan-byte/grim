import { useState } from "react";
import { Bell, Footprints, Trophy, MessageCircle, Dumbbell, Apple, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NotifType = "interaction" | "reminder" | "achievement" | "nutrition" | "plan";

interface Notif {
  id: string;
  type: NotifType;
  text: string;
  time: string;
  read: boolean;
}

const initialNotifs: Notif[] = [
  { id: "1", type: "interaction", text: "Måns har kommenterat ditt senaste löppass!", time: "10 min sedan", read: false },
  { id: "2", type: "achievement", text: "Nytt PB! Du slog ditt rekord i knäböj igår 🎉", time: "2 tim sedan", read: false },
  { id: "3", type: "reminder", text: "Dags för ditt planerade benpass?", time: "5 tim sedan", read: false },
  { id: "4", type: "nutrition", text: "Du har 480 kcal kvar att logga idag.", time: "Igår", read: true },
  { id: "5", type: "plan", text: "Din veckoplan har uppdaterats med ett nytt löppass.", time: "2 dagar sedan", read: true },
];

const iconFor = (type: NotifType) => {
  switch (type) {
    case "interaction": return MessageCircle;
    case "reminder": return Dumbbell;
    case "achievement": return Trophy;
    case "nutrition": return Apple;
    case "plan": return Calendar;
    default: return Footprints;
  }
};

interface NotificationsBellProps {
  onViewAll?: () => void;
}

export default function NotificationsBell({ onViewAll }: NotificationsBellProps) {
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs);
  const [open, setOpen] = useState(false);
  const unread = notifs.filter(n => !n.read).length;

  const markAllRead = () => setNotifs(notifs.map(n => ({ ...n, read: true })));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-primary/10 transition-colors"
          aria-label="Aviseringar"
          title="Aviseringar"
        >
          <Bell className="w-4 h-4 text-primary" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 border-primary">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Aviseringar</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Markera alla som lästa
            </button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {notifs.slice(0, 5).map(n => {
            const Icon = iconFor(n.type);
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-3 py-2 border-b border-border/50 ${!n.read ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-center w-8 h-8 bg-primary/10 text-primary shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{n.text}</p>
                  <span className="text-[11px] text-muted-foreground">{n.time}</span>
                </div>
                {!n.read && <span className="w-2 h-2 bg-destructive shrink-0 mt-2" aria-hidden="true" />}
              </li>
            );
          })}
          {notifs.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Inga aviseringar</li>
          )}
        </ul>
        <div className="px-3 py-2 border-t border-border text-center">
          <button
            onClick={() => { setOpen(false); onViewAll?.(); }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Visa alla aviseringar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
