import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Dumbbell, Calendar as CalendarIcon, X, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Friend {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  message_type: string;
  shared_workout: any;
  read: boolean;
  created_at: string;
}

interface ChatConversationProps {
  userId: string;
  friend: Friend;
  onBack: () => void;
}

const ChatConversation = ({ userId, friend, onBack }: ChatConversationProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [importingWorkout, setImportingWorkout] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [conflictCheck, setConflictCheck] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [importing, setImporting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages();
    markAsRead();

    const channel = supabase
      .channel(`chat-${friend.user_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (
          (msg.sender_id === friend.user_id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === friend.user_id)
        ) {
          setMessages(prev => [...prev, msg]);
          if (msg.receiver_id === userId) markAsRead();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [friend.user_id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friend.user_id}),and(sender_id.eq.${friend.user_id},receiver_id.eq.${userId})`
      )
      .order("created_at", { ascending: true })
      .limit(200);

    if (data) setMessages(data as ChatMessage[]);
  };

  const markAsRead = async () => {
    await supabase
      .from("chat_messages")
      .update({ read: true })
      .eq("sender_id", friend.user_id)
      .eq("receiver_id", userId)
      .eq("read", false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    await supabase.from("chat_messages").insert({
      sender_id: userId,
      receiver_id: friend.user_id,
      message: newMessage.trim(),
      message_type: "text",
    });
    setNewMessage("");
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Import shared workout
  const startImport = (workout: any) => {
    setImportingWorkout(workout);
    setSelectedDate(undefined);
    setHasConflict(false);
    setConflictCheck(false);
  };

  const checkConflictAndImport = async () => {
    if (!selectedDate || !importingWorkout) return;
    const dateKey = format(selectedDate, "yyyy-MM-dd");

    // Check if there are existing plans for this date
    const { data: existing } = await supabase
      .from("workout_plans")
      .select("id, details")
      .eq("user_id", userId)
      .eq("day", dateKey);

    const hasExisting = existing && existing.some(p => p.details && p.details.trim() !== "");

    if (hasExisting && !conflictCheck) {
      setHasConflict(true);
      return;
    }

    await doImport(dateKey, hasExisting ? existing : null);
  };

  const doImport = async (dateKey: string, existingPlans: any[] | null) => {
    setImporting(true);

    // Delete existing plans for this date if overwriting
    if (existingPlans && existingPlans.length > 0) {
      await supabase
        .from("workout_plans")
        .delete()
        .eq("user_id", userId)
        .eq("day", dateKey);

      // Also clear completions
      await supabase
        .from("workout_completions")
        .delete()
        .eq("user_id", userId)
        .eq("day", dateKey);
    }

    // Insert the shared workout
    const workout = importingWorkout;
    await supabase.from("workout_plans").insert({
      user_id: userId,
      week: workout.week || 1,
      day: dateKey,
      session_name: workout.session_name || "Delat pass",
      details: workout.details || "",
      tempo: workout.tempo || null,
    });

    setImporting(false);
    setImportingWorkout(null);
    setHasConflict(false);
    setConflictCheck(false);
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = new Date(msg.created_at).toLocaleDateString("sv-SE");
    if (d !== lastDate) {
      groupedMessages.push({ date: d, msgs: [msg] });
      lastDate = d;
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <button onClick={onBack} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
          {friend.avatar_url ? (
            <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-primary">{friend.nickname.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <span className="font-semibold text-sm">{friend.nickname}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-1">
        {groupedMessages.map(group => (
          <div key={group.date}>
            <div className="text-center my-3">
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {group.date}
              </span>
            </div>
            {group.msgs.map(msg => {
              const isMine = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}>
                    {msg.message_type === 'workout' && msg.shared_workout ? (
                      <WorkoutBubble
                        workout={msg.shared_workout}
                        isMine={isMine}
                        onImport={() => startImport(msg.shared_workout)}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    )}
                    <p className={`text-[10px] mt-0.5 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.created_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">
            Skriv ett meddelande för att starta konversationen!
          </p>
        )}
      </div>

      {/* Import workout dialog */}
      {importingWorkout && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setImportingWorkout(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] max-w-sm mx-auto bg-card border border-border rounded-xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                Lägg till pass
              </h3>
              <button onClick={() => { setImportingWorkout(null); setHasConflict(false); }} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-muted rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold">{importingWorkout.session_name || "Pass"}</p>
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                {importingWorkout.details}
              </p>
            </div>

            {!hasConflict ? (
              <>
                <label className="text-xs font-medium mb-1 block">Välj datum:</label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-lg text-left",
                      selectedDate ? "text-foreground" : "text-muted-foreground"
                    )}>
                      <CalendarIcon className="w-4 h-4" />
                      {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: sv }) : "Välj datum"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => { setSelectedDate(d); setDatePickerOpen(false); }}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <button
                  disabled={!selectedDate || importing}
                  onClick={checkConflictAndImport}
                  className="w-full mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {importing ? "Sparar..." : "Lägg till i min plan"}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Du har redan övningar inlagda denna dag. Vill du skriva över dem?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setHasConflict(false); setConflictCheck(false); }}
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={() => {
                      setConflictCheck(true);
                      setHasConflict(false);
                      if (selectedDate) {
                        doImport(format(selectedDate, "yyyy-MM-dd"), [{ id: "overwrite" }]);
                      }
                    }}
                    disabled={importing}
                    className="flex-1 px-3 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg font-semibold disabled:opacity-50"
                  >
                    {importing ? "Sparar..." : "Skriv över"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Input */}
      <div className="border-t border-border pt-2 flex gap-2 items-end">
        <input
          ref={inputRef}
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Skriv ett meddelande..."
          className="flex-1 text-sm bg-muted rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          className="p-2.5 bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-colors hover:bg-primary/90 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Workout bubble inside chat
const WorkoutBubble = ({ workout, isMine, onImport }: { workout: any; isMine: boolean; onImport: () => void }) => {
  const exercises = (workout.details || "").split(/[;\n]/).map((s: string) => s.trim()).filter(Boolean);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Dumbbell className="w-3.5 h-3.5" />
        <span className="text-xs font-bold">{workout.session_name || "Pass"}</span>
      </div>
      <div className={`rounded-lg p-2 ${isMine ? 'bg-primary-foreground/10' : 'bg-background/50'}`}>
        {exercises.slice(0, 5).map((ex: string, i: number) => (
          <p key={i} className="text-xs">{ex}</p>
        ))}
        {exercises.length > 5 && (
          <p className="text-xs opacity-70">+{exercises.length - 5} fler...</p>
        )}
      </div>
      {!isMine && (
        <button
          onClick={(e) => { e.stopPropagation(); onImport(); }}
          className="text-xs font-semibold underline mt-1"
        >
          📥 Lägg till i min plan
        </button>
      )}
    </div>
  );
};

export default ChatConversation;
