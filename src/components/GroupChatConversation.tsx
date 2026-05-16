import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Users, MoreVertical, LogOut, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface GroupChatConversationProps {
  userId: string;
  groupId: string;
  groupName: string;
  onBack: () => void;
  onLeft?: () => void;
}

interface Msg {
  id: string;
  sender_id: string;
  message: string | null;
  message_type: string;
  created_at: string;
  group_id: string | null;
}

interface MemberProfile {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
}

const GroupChatConversation = ({ userId, groupId, groupName, onBack, onLeft }: GroupChatConversationProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [members, setMembers] = useState<Record<string, MemberProfile>>({});
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Members + profiles
      const { data: memberRows } = await supabase
        .from("chat_group_members")
        .select("user_id")
        .eq("group_id", groupId);
      const ids = (memberRows || []).map((m: any) => m.user_id);
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nickname, avatar_url")
          .in("user_id", ids);
        const map: Record<string, MemberProfile> = {};
        (profiles || []).forEach((p: any) => {
          map[p.user_id] = p;
        });
        if (!cancelled) setMembers(map);
      }
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, sender_id, message, message_type, created_at, group_id")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (!cancelled) {
        setMessages((msgs || []) as Msg[]);
        setLoading(false);
      }
      // Update last_read
      await supabase
        .from("chat_group_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("group_id", groupId)
        .eq("user_id", userId);
    })();

    const channel = supabase
      .channel(`gc-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Msg]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!newMessage.trim()) return;
    const text = newMessage.trim();
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      sender_id: userId,
      group_id: groupId,
      message: text,
      message_type: "text",
    });
    setSending(false);
    if (error) {
      toast.error("Kunde inte skicka");
      return;
    }
    setNewMessage("");
    inputRef.current?.focus();
  };

  const leaveGroup = async () => {
    if (!confirm("Lämna gruppen?")) return;
    await supabase.from("chat_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    toast.success("Du har lämnat gruppen");
    onLeft?.();
    onBack();
  };

  const groupedByDate: { date: string; msgs: Msg[] }[] = [];
  let last = "";
  for (const m of messages) {
    const d = new Date(m.created_at).toLocaleDateString("sv-SE");
    if (d !== last) {
      groupedByDate.push({ date: d, msgs: [m] });
      last = d;
    } else {
      groupedByDate[groupedByDate.length - 1].msgs.push(m);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border pb-3 relative">
        <button onClick={onBack} className="p-1.5 hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 bg-primary/10 flex items-center justify-center">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm truncate block">{groupName}</span>
          <span className="text-[10px] text-muted-foreground">
            {Object.keys(members).length} medlemmar
          </span>
        </div>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="p-1.5 hover:bg-muted transition-colors"
          aria-label="Mer"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {showMenu && (
          <div className="absolute right-2 top-12 z-30 bg-card border border-border min-w-[160px]">
            <button
              onClick={() => {
                setShowMenu(false);
                setShowMembers(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted"
            >
              <Users className="w-3.5 h-3.5" />
              Visa medlemmar
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                leaveGroup();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-muted"
            >
              <LogOut className="w-3.5 h-3.5" />
              Lämna grupp
            </button>
          </div>
        )}
      </div>

      {showMembers && (
        <div
          className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-3 pb-3"
          onClick={() => setShowMembers(false)}
        >
          <div
            className="w-full max-w-md bg-card border border-border max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Medlemmar ({Object.keys(members).length})
              </h3>
              <button
                onClick={() => setShowMembers(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              className="flex-1 min-h-0 overflow-y-auto p-2"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              {Object.values(members)
                .sort((a, b) => a.nickname.localeCompare(b.nickname))
                .map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3 p-2">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">
                          {m.nickname.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium flex-1 truncate">
                      {m.nickname}
                      {m.user_id === userId && (
                        <span className="text-[10px] text-muted-foreground ml-1">(du)</span>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        data-scroll-lock-scroll="y"
        className="min-h-0 flex-1 overflow-y-auto py-3 pb-24 space-y-1 overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            Skriv första meddelandet i gruppen!
          </p>
        ) : (
          groupedByDate.map((g) => (
            <div key={g.date}>
              <div className="text-center my-3">
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {g.date}
                </span>
              </div>
              {g.msgs.map((m) => {
                const isMine = m.sender_id === userId;
                const sender = members[m.sender_id];
                return (
                  <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
                    <div
                      className={`max-w-[80%] px-3 py-2 ${
                        isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      {!isMine && sender && (
                        <p className="text-[10px] font-bold text-primary mb-0.5">{sender.nickname}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                        }`}
                      >
                        {new Date(m.created_at).toLocaleTimeString("sv-SE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div
        className="fixed left-0 right-0 z-40 bg-background border-t border-border px-3 pt-2 pb-2 flex gap-2 items-end max-w-lg mx-auto"
        style={{
          bottom: `calc(60px + env(safe-area-inset-bottom, 0px) + 36px)`,
          touchAction: "none",
        }}
      >
        <input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Skriv ett meddelande..."
          className="flex-1 text-sm bg-muted rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
          disabled={sending}
        />
        <button
          onClick={send}
          disabled={!newMessage.trim() || sending}
          className="p-2.5 bg-primary text-primary-foreground rounded-full disabled:opacity-50 hover:bg-primary/90 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default GroupChatConversation;
