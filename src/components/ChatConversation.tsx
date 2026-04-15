import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Dumbbell, X, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

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

interface PlanSlot {
  id: string;
  week: number;
  day: string;
  session_name: string;
  details: string;
}

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

const ChatConversation = ({ userId, friend, onBack }: ChatConversationProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [importingWorkout, setImportingWorkout] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Plan picker state for import
  const [planSlots, setPlanSlots] = useState<PlanSlot[]>([]);
  const [planWeeks, setPlanWeeks] = useState<number[]>([]);
  const [selectedImportWeek, setSelectedImportWeek] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<{ week: number; day: string; hasExisting: boolean } | null>(null);

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
    const msgText = newMessage.trim();
    setSending(true);
    await supabase.from("chat_messages").insert({
      sender_id: userId,
      receiver_id: friend.user_id,
      message: msgText,
      message_type: "text",
    });
    setNewMessage("");
    setSending(false);
    inputRef.current?.focus();

    // Send push notification (fire and forget)
    supabase.functions.invoke("notify-chat", {
      body: { receiverId: friend.user_id, messagePreview: msgText },
    }).then(({ error }) => {
      if (error) console.error("notify-chat error:", error);
    }).catch((err) => console.error("notify-chat invoke failed:", err));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Fetch user's plan when import dialog opens
  const startImport = async (workout: any) => {
    setImportingWorkout(workout);
    setConfirmTarget(null);

    const { data } = await supabase
      .from("workout_plans")
      .select("id, week, day, session_name, details")
      .eq("user_id", userId)
      .gt("week", 0)
      .order("week")
      .order("day");

    if (data) {
      setPlanSlots(data);
      const wks = [...new Set(data.map(p => p.week))].sort((a, b) => a - b);
      setPlanWeeks(wks);
      if (wks.length > 0) setSelectedImportWeek(wks[0]);
    }
  };

  const handleDayClick = (week: number, day: string) => {
    const existing = planSlots.filter(p => p.week === week && p.day === day);
    const hasExisting = existing.some(p => p.details && p.details.trim() !== "");
    setConfirmTarget({ week, day, hasExisting });
  };

  const doImport = async () => {
    if (!confirmTarget || !importingWorkout) return;
    setImporting(true);

    const { week, day, hasExisting } = confirmTarget;

    // If overwriting, delete existing plan for this day
    if (hasExisting) {
      const existing = planSlots.filter(p => p.week === week && p.day === day);
      for (const plan of existing) {
        await supabase.from("workout_plans").delete().eq("id", plan.id);
      }
      await supabase.from("workout_completions").delete()
        .eq("user_id", userId).eq("week", week).eq("day", day);
    }

    // Check if there's already a row for this day (could be empty)
    const existingEmpty = planSlots.find(p => p.week === week && p.day === day && (!p.details || p.details.trim() === ""));

    if (existingEmpty) {
      // Update existing empty slot
      await supabase.from("workout_plans").update({
        session_name: importingWorkout.session_name || "Importerat pass",
        details: importingWorkout.details || "",
        tempo: importingWorkout.tempo || null,
      }).eq("id", existingEmpty.id);
    } else {
      // Insert new
      await supabase.from("workout_plans").insert({
        user_id: userId,
        week,
        day,
        session_name: importingWorkout.session_name || "Importerat pass",
        details: importingWorkout.details || "",
        tempo: importingWorkout.tempo || null,
      });
    }

    toast.success("Passet har lagts till i din plan!");
    setImporting(false);
    setImportingWorkout(null);
    setConfirmTarget(null);
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

  // Get days for current week in import view
  const weekDays = planSlots.filter(p => p.week === selectedImportWeek);
  const daysInWeek = DAYS.map((dayLabel, i) => {
    const dayKey = DAYS[i];
    // Find matching plans - day field stores the Swedish abbreviation in plan mode
    const dayPlans = weekDays.filter(p => p.day === dayLabel || p.day === dayKey);
    return { dayLabel, plans: dayPlans };
  });

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
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

      {/* Import workout dialog - plan-based picker */}
      {importingWorkout && !confirmTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setImportingWorkout(null)} />
          <div className="fixed inset-x-3 top-[10%] bottom-[10%] z-[70] max-w-md mx-auto bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                Välj dag i din plan
              </h3>
              <button onClick={() => setImportingWorkout(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Workout preview */}
            <div className="px-4 pt-3">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-semibold">{importingWorkout.session_name || "Pass"}</p>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                  {importingWorkout.details}
                </p>
              </div>
            </div>

            {/* Week navigation */}
            {planWeeks.length > 0 ? (
              <>
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => {
                      const idx = planWeeks.indexOf(selectedImportWeek);
                      if (idx > 0) setSelectedImportWeek(planWeeks[idx - 1]);
                    }}
                    disabled={planWeeks.indexOf(selectedImportWeek) === 0}
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold">Vecka {selectedImportWeek}</span>
                  <button
                    onClick={() => {
                      const idx = planWeeks.indexOf(selectedImportWeek);
                      if (idx < planWeeks.length - 1) setSelectedImportWeek(planWeeks[idx + 1]);
                    }}
                    disabled={planWeeks.indexOf(selectedImportWeek) === planWeeks.length - 1}
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Days grid */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                  {daysInWeek.map(({ dayLabel, plans }) => {
                    const hasContent = plans.some(p => p.details && p.details.trim() !== "");
                    const sessionName = plans.length > 0 ? plans[0].session_name : "";
                    const exercises = plans.length > 0 && plans[0].details
                      ? plans[0].details.split(/[;\n]/).map(s => s.trim()).filter(Boolean)
                      : [];

                    return (
                      <button
                        key={dayLabel}
                        onClick={() => handleDayClick(selectedImportWeek, dayLabel)}
                        className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground w-8">{dayLabel}</span>
                            <span className="text-sm font-semibold truncate">
                              {sessionName || "—"}
                            </span>
                          </div>
                          {hasContent && (
                            <span className="text-[10px] text-muted-foreground">
                              {exercises.length} övningar
                            </span>
                          )}
                        </div>
                        {hasContent && exercises.length > 0 && (
                          <div className="mt-1 ml-10">
                            {exercises.slice(0, 2).map((ex, i) => (
                              <p key={i} className="text-[11px] text-muted-foreground truncate">{ex}</p>
                            ))}
                            {exercises.length > 2 && (
                              <p className="text-[11px] text-muted-foreground/60">+{exercises.length - 2} fler</p>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-sm text-muted-foreground text-center">
                  Du har ingen aktiv plan. Skapa en plan först för att kunna importera pass.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirm overwrite dialog */}
      {confirmTarget && importingWorkout && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setConfirmTarget(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] max-w-sm mx-auto bg-card border border-border rounded-xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                Bekräfta import
              </h3>
              <button onClick={() => setConfirmTarget(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-muted rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold">{importingWorkout.session_name || "Pass"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                → Vecka {confirmTarget.week}, {confirmTarget.day}
              </p>
            </div>

            {confirmTarget.hasExisting && (
              <p className="text-sm text-destructive font-medium mb-3">
                ⚠️ Det finns redan övningar denna dag. De kommer att ersättas.
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={doImport}
                disabled={importing}
                className="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {importing ? "Sparar..." : confirmTarget.hasExisting ? "Ersätt & lägg till" : "Lägg till"}
              </button>
            </div>
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
