import { useState, useEffect, useRef } from "react";
import { COMPOSER_BOTTOM } from "@/hooks/useChatComposerBottom";
import ChatComposerPortal from "@/components/ChatComposerPortal";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Dumbbell, X, Check, CheckCheck, ChevronLeft, ChevronRight, Crown, Search, Reply, ChevronUp, ChevronDown } from "lucide-react";
import { avatarGradient } from "@/lib/avatarGradient";
import { useTypingListener, useTypingSender } from "@/hooks/useTypingIndicator";
import TypingDots from "@/components/TypingDots";
import RouteBubble from "@/components/RouteBubble";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { confirmMessageWrite, mergeMessages } from "@/lib/socialConversation";
import ConversationHistoryStatus from "./ConversationHistoryStatus";

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
  reply_to_id?: string | null;
}

interface ChatConversationProps {
  userId: string;
  friend: Friend;
  onBack: () => void;
  onOpenProfile?: () => void;
}

interface PlanSlot {
  id: string;
  week: number;
  day: string;
  session_name: string;
  details: string;
}

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

const ChatConversation = ({ userId, friend, onBack, onOpenProfile }: ChatConversationProps) => {
  const history = useConversationMessages<ChatMessage>(userId, friend.user_id);
  const { messages, setMessages } = history;
  const [newMessage, setNewMessage] = useSessionDraft(`grim:chat-draft:${userId}:${friend.user_id}`, "");
  const [sendError, setSendError] = useState(false);
  const sendLock = useRef(false);
  const olderScroll = useRef<{ height: number; top: number } | null>(null);
  const { isTyping } = useTypingListener(userId);
  const { notifyTyping, stopTyping } = useTypingSender(userId, friend.user_id);
  const friendIsTyping = isTyping(friend.user_id);
  const [sending, setSending] = useState(false);
  const [importingWorkout, setImportingWorkout] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Reply
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  // Plan picker state for import
  const [planSlots, setPlanSlots] = useState<PlanSlot[]>([]);
  const [planWeeks, setPlanWeeks] = useState<number[]>([]);
  const [selectedImportWeek, setSelectedImportWeek] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<{ week: number; day: string; hasExisting: boolean } | null>(null);

  // Last message I sent that the friend has read → carries the "Sedd" label
  const lastReadMineId = [...messages].reverse().find(m => m.sender_id === userId && m.read)?.id;

  useEffect(() => { void markAsRead(); }, [friend.user_id, messages.length]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (olderScroll.current) {
      el.scrollTop = olderScroll.current.top + el.scrollHeight - olderScroll.current.height;
      olderScroll.current = null;
    } else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);
  const loadOlder = async () => {
    const el = scrollRef.current;
    if (el) olderScroll.current = { height: el.scrollHeight, top: el.scrollTop };
    await history.loadOlder();
  };

  const markAsRead = async () => {
    const { error } = await supabase
      .from("chat_messages")
      .update({ read: true })
      .eq("sender_id", friend.user_id)
      .eq("receiver_id", userId)
      .eq("read", false);
    if (error) return;
    setMessages(prev => prev.map(m => (m.sender_id === friend.user_id && !m.read ? { ...m, read: true } : m)));
  };

  // Re-mark as read when the user returns to the conversation
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") markAsRead(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.user_id]);


  const messagePreview = (m: ChatMessage) => {
    if (m.message_type === "workout") return "Delat pass";
    if (m.message_type === "route") return "Delad runda";
    return m.message || "";
  };

  const jumpToMessage = (id: string) => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
  };

  const searchMatches = searchQuery.trim()
    ? messages.filter((m) => messagePreview(m).toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : [];

  const stepSearch = (dir: number) => {
    if (searchMatches.length === 0) return;
    const next = (searchIndex + dir + searchMatches.length) % searchMatches.length;
    setSearchIndex(next);
    jumpToMessage(searchMatches[next].id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sendLock.current) return;
    const msgText = newMessage.trim();
    sendLock.current = true;
    setSending(true); setSendError(false);
    try {
      const saved = await confirmMessageWrite(() => supabase.from("chat_messages").insert({
        sender_id: userId, receiver_id: friend.user_id, message: msgText,
        message_type: "text", reply_to_id: replyTo?.id ?? null,
      }).select("*").single());
      setMessages(previous => mergeMessages(previous, [saved as ChatMessage]));
      setNewMessage(""); setReplyTo(null); stopTyping();
      void supabase.functions.invoke("notify-chat", { body: { receiverId: friend.user_id, messagePreview: msgText } }).catch(() => {});
      inputRef.current?.focus();
    } catch { setSendError(true); }
    finally { setSending(false); sendLock.current = false; }
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
    const d = new Date(msg.created_at).toLocaleDateString("sv-SE", { timeZone: "UTC" });
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 pb-3">
        <Button variant="ghost" size="icon" aria-label="Tillbaka till meddelanden" onClick={onBack} className="h-11 w-11 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="relative w-9 h-9 shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
            style={avatarGradient(friend.nickname).style}
          >
            {friend.avatar_url ? (
              <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold" style={avatarGradient(friend.nickname).textStyle}>
                {avatarGradient(friend.nickname).initial}
              </span>
            )}
          </div>
          {(friend as any).is_honorary && (
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card flex items-center justify-center">
              <Crown className="w-2.5 h-2.5 text-warning" />
            </span>
          )}
        </div>
        <Button variant="ghost" onClick={onOpenProfile} aria-label={`Visa ${friend.nickname}s profil`} className="min-w-0 flex-1 h-auto min-h-11 flex-col items-start px-1">
          <span className="block max-w-full font-semibold text-sm truncate">{friend.nickname}</span>
          {friendIsTyping && <TypingDots className="text-[11px]" />}
        </Button>
        <Button variant="ghost"
          onClick={() => {
            setSearchOpen(v => !v);
            setSearchQuery("");
            setSearchIndex(0);
          }}
          className="h-11 w-11 shrink-0 p-1.5 hover:bg-muted rounded-full transition-colors"
          aria-label="Sök i chatten"
        >
          {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {searchOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/50 py-2">
          <input
            autoFocus
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchIndex(0); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); stepSearch(1); } }}
            aria-label="Sök bland hämtade meddelanden" placeholder="Sök bland hämtade meddelanden..."
            className="min-w-0 flex-1 text-sm bg-muted rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-[11px] text-muted-foreground tabular-nums min-w-[42px] text-center">
            {searchQuery.trim() ? `${searchMatches.length ? searchIndex + 1 : 0}/${searchMatches.length}` : ""}
          </span>
          <Button variant="ghost" aria-label="Föregående sökträff" onClick={() => stepSearch(-1)} disabled={searchMatches.length === 0} className="h-11 w-11 shrink-0 p-1.5 rounded-full hover:bg-muted disabled:opacity-30">
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button variant="ghost" aria-label="Nästa sökträff" onClick={() => stepSearch(1)} disabled={searchMatches.length === 0} className="h-11 w-11 shrink-0 p-1.5 rounded-full hover:bg-muted disabled:opacity-30">
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      )}


      {/* Messages */}
      <div
        ref={scrollRef}
        data-scroll-lock-scroll="y"
        className="min-h-0 flex-1 overflow-y-auto py-3 space-y-1 overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y", paddingBottom: `calc(${COMPOSER_BOTTOM} + 72px)` }}
      >
        <ConversationHistoryStatus {...history} empty={messages.length === 0} loadOlder={() => void loadOlder()} />
        {groupedMessages.map(group => (
          <div key={group.date}>
            <div className="text-center my-3">
              <span className="text-[10px] font-medium text-muted-foreground/80 bg-muted/60 px-2.5 py-1 rounded-full">
                {group.date}
              </span>
            </div>
            {group.msgs.map(msg => {
              const isMine = msg.sender_id === userId;
              const showSeen = isMine && msg.read && msg.id === lastReadMineId;
              const parent = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
              return (
                <div
                  key={msg.id}
                  ref={el => { msgRefs.current[msg.id] = el; }}
                  className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1.5`}
                >
                  <div className={`flex items-center gap-1 ${isMine ? 'flex-row' : 'flex-row-reverse'} max-w-[88%]`}>
                    <Button variant="ghost"
                      onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                      className="p-1.5 rounded-full text-muted-foreground hover:bg-muted opacity-60 hover:opacity-100 shrink-0"
                      aria-label="Svara på meddelandet"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </Button>
                  <div className={`px-3.5 py-2 ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                      : 'bg-card text-foreground rounded-2xl rounded-bl-sm shadow-soft'
                  } ${highlightId === msg.id ? 'ring-2 ring-primary' : ''}`}>
                    {parent && (
                      <Button variant="ghost"
                        onClick={() => jumpToMessage(parent.id)}
                        className={`block w-full text-left mb-1.5 border-l-2 pl-2 py-0.5 rounded-r ${
                          isMine ? 'border-primary-foreground/50 bg-primary-foreground/10' : 'border-primary bg-muted/60'
                        }`}
                      >
                        <span className={`block text-[10px] font-semibold ${isMine ? 'text-primary-foreground/80' : 'text-primary'}`}>
                          {parent.sender_id === userId ? "Du" : friend.nickname}
                        </span>
                        <span className={`block text-[11px] line-clamp-2 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {messagePreview(parent)}
                        </span>
                      </Button>
                    )}
                    {msg.message_type === 'route' && msg.shared_workout ? (
                      <RouteBubble payload={msg.shared_workout} isMine={isMine} />
                    ) : msg.message_type === 'workout' && msg.shared_workout ? (
                      <WorkoutBubble
                        workout={msg.shared_workout}
                        isMine={isMine}
                        onImport={() => startImport(msg.shared_workout)}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    )}
                    <p className={`flex items-center gap-1 text-[10px] mt-0.5 ${isMine ? 'justify-end text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.created_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                      {isMine && (msg.read
                        ? <CheckCheck className="w-3 h-3" aria-label="Sedd" />
                        : <Check className="w-3 h-3" aria-label="Skickad" />)}
                    </p>
                  </div>
                  </div>
                  {showSeen && (
                    <span className="mt-0.5 mr-1 text-[10px] text-muted-foreground animate-fade-in">Sedd</span>
                  )}
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
              <Button variant="ghost" onClick={() => setImportingWorkout(null)} className="h-11 w-11 shrink-0 p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </Button>
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
                  <Button variant="ghost"
                    onClick={() => {
                      const idx = planWeeks.indexOf(selectedImportWeek);
                      if (idx > 0) setSelectedImportWeek(planWeeks[idx - 1]);
                    }}
                    disabled={planWeeks.indexOf(selectedImportWeek) === 0}
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-bold">Vecka {selectedImportWeek}</span>
                  <Button variant="ghost"
                    onClick={() => {
                      const idx = planWeeks.indexOf(selectedImportWeek);
                      if (idx < planWeeks.length - 1) setSelectedImportWeek(planWeeks[idx + 1]);
                    }}
                    disabled={planWeeks.indexOf(selectedImportWeek) === planWeeks.length - 1}
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Days grid */}
                <div data-scroll-lock-scroll="y" className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                  {daysInWeek.map(({ dayLabel, plans }) => {
                    const hasContent = plans.some(p => p.details && p.details.trim() !== "");
                    const sessionName = plans.length > 0 ? plans[0].session_name : "";
                    const exercises = plans.length > 0 && plans[0].details
                      ? plans[0].details.split(/[;\n]/).map(s => s.trim()).filter(Boolean)
                      : [];

                    return (
                      <Button variant="ghost"
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
                      </Button>
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
              <Button variant="ghost" onClick={() => setConfirmTarget(null)} className="h-11 w-11 shrink-0 p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </Button>
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
              <Button variant="ghost"
                onClick={() => setConfirmTarget(null)}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Avbryt
              </Button>
              <Button variant="ghost"
                onClick={doImport}
                disabled={importing}
                className="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {importing ? "Sparar..." : confirmTarget.hasExisting ? "Ersätt & lägg till" : "Lägg till"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Input - sticky above timer */}
      <ChatComposerPortal className="px-3 pt-2 pb-2 flex flex-col gap-2">
        {sendError && <div role="alert" className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Kunde inte skickas. Texten finns kvar.</p><Button variant="outline" disabled={sending} onClick={() => void sendMessage()}>Försök igen</Button></div>}
        {sending && <p role="status" className="text-xs text-muted-foreground">Skickar…</p>}
        {replyTo && (
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
              <p className="text-[10px] font-semibold text-primary">
                Svarar {replyTo.sender_id === userId ? "dig själv" : friend.nickname}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{messagePreview(replyTo)}</p>
            </div>
            <Button variant="ghost" onClick={() => setReplyTo(null)} className="h-11 w-11 shrink-0 p-1 text-muted-foreground hover:text-foreground" aria-label="Avbryt svar">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        <div className="flex gap-2 items-end">
        <input
          ref={inputRef}
          value={newMessage}
          onChange={e => { setNewMessage(e.target.value); if (e.target.value.trim()) notifyTyping(); else stopTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Skriv ett meddelande..."
          className="min-w-0 flex-1 text-sm bg-muted text-foreground rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
          disabled={sending}
        />
        <Button aria-label="Skicka meddelande" size="icon"
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          className="p-2.5 bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-colors hover:bg-primary/90 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
        </div>
      </ChatComposerPortal>
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
        <Button variant="ghost"
          onClick={(e) => { e.stopPropagation(); onImport(); }}
          className="text-xs font-semibold underline mt-1"
        >
          📥 Lägg till i min plan
        </Button>
      )}
    </div>
  );
};

export default ChatConversation;
