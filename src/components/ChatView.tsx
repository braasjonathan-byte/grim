import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Crown, Sparkles, Megaphone, Trash2, Loader2, Check } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";
import ChatConversation from "./ChatConversation";
import EmptyState from "@/components/EmptyState";
import grimIcon from "@/assets/grim-icon.webp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const GRIM_INFO_KEY = "gymberget_grim_info_seen";

const GRIM_SUPPORT_ID = "grim-support";
const GRIM_ANNOUNCEMENT_ID = "grim-announcement";
const ANNOUNCEMENTS_LAST_READ_KEY = "gymberget_last_read_announcements";

interface ChatViewProps {
  userId: string;
  isAdmin?: boolean;
  isPremium?: boolean;
  initialFriendId?: string | null;
}

interface Friend {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_honorary?: boolean;
  isGrimSupport?: boolean;
  isGrimAnnouncement?: boolean;
}

interface LastMessage {
  friend_id: string;
  message: string | null;
  message_type: string;
  created_at: string;
  unread_count: number;
}

interface SupportConversation {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  last_message: string;
  last_date: string;
  unread_count: number;
}

const ChatView = ({ userId, isAdmin = false, isPremium = false, initialFriendId }: ChatViewProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [lastMessages, setLastMessages] = useState<Map<string, LastMessage>>(new Map());
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportConversations, setSupportConversations] = useState<SupportConversation[]>([]);
  const [grimLastMessage, setGrimLastMessage] = useState<LastMessage | null>(null);
  const [announcementPreview, setAnnouncementPreview] = useState<{ title: string; created_at: string } | null>(null);
  const [announcementUnread, setAnnouncementUnread] = useState(0);

  const fetchAnnouncementPreview = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("title, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data && data.length > 0) {
      setAnnouncementPreview({ title: data[0].title, created_at: data[0].created_at });
      const lastRead = localStorage.getItem(ANNOUNCEMENTS_LAST_READ_KEY) || "1970-01-01T00:00:00Z";
      setAnnouncementUnread(data.filter(a => a.created_at > lastRead).length);
    } else {
      setAnnouncementPreview(null);
      setAnnouncementUnread(0);
    }
  };

  useEffect(() => {
    fetchFriendsAndMessages();
    fetchAnnouncementPreview();
    if (isPremium && !isAdmin) fetchGrimMessages();
    if (isAdmin) fetchSupportConversations();

    const channel = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === userId || msg.receiver_id === userId) {
          const friendId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
          setLastMessages(prev => {
            const updated = new Map(prev);
            const existing = updated.get(friendId);
            updated.set(friendId, {
              friend_id: friendId,
              message: msg.message_type === 'workout' ? '🏋️ Delade ett pass' : msg.message,
              message_type: msg.message_type,
              created_at: msg.created_at,
              unread_count: msg.receiver_id === userId ? (existing?.unread_count || 0) + 1 : (existing?.unread_count || 0),
            });
            return updated;
          });
        }
      })
      .subscribe();

    // Realtime for support messages
    const supportChannel = supabase
      .channel("support-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => {
        if (isPremium && !isAdmin) fetchGrimMessages();
        if (isAdmin) fetchSupportConversations();
      })
      .subscribe();

    // Realtime for announcements (Grim)
    const announceChannel = supabase
      .channel("announcements-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        fetchAnnouncementPreview();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(supportChannel);
      supabase.removeChannel(announceChannel);
    };
  }, [userId, isPremium, isAdmin]);

  useEffect(() => {
    if (initialFriendId && friends.length > 0) {
      const f = friends.find(f => f.user_id === initialFriendId);
      if (f) setSelectedFriend(f);
    }
  }, [initialFriendId, friends]);

  const fetchGrimMessages = async () => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const latest = data[0];
      const { count } = await supabase
        .from("support_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_from_admin", true)
        .eq("read", false);

      setGrimLastMessage({
        friend_id: GRIM_SUPPORT_ID,
        message: latest.message,
        message_type: "text",
        created_at: latest.created_at,
        unread_count: count || 0,
      });
    }
  };

  const fetchSupportConversations = async () => {
    const { data: messages } = await supabase
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!messages || messages.length === 0) {
      setSupportConversations([]);
      return;
    }

    // Group by user_id
    const userMap = new Map<string, typeof messages>();
    for (const msg of messages) {
      if (!userMap.has(msg.user_id)) userMap.set(msg.user_id, []);
      userMap.get(msg.user_id)!.push(msg);
    }

    const userIds = [...userMap.keys()];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const convs: SupportConversation[] = [];
    for (const [uid, msgs] of userMap) {
      const profile = profileMap.get(uid);
      const latest = msgs[0];
      const unread = msgs.filter(m => !m.is_from_admin && !m.read).length;
      convs.push({
        user_id: uid,
        nickname: profile?.nickname || "Okänd",
        avatar_url: profile?.avatar_url || null,
        last_message: latest.message,
        last_date: latest.created_at,
        unread_count: unread,
      });
    }

    convs.sort((a, b) => new Date(b.last_date).getTime() - new Date(a.last_date).getTime());
    setSupportConversations(convs);
  };

  const fetchFriendsAndMessages = async () => {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (!friendships || friendships.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const friendIds = friendships.map(f => f.user_id === userId ? f.friend_id : f.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url, is_honorary")
      .in("user_id", friendIds);

    const friendList = (profiles || []).sort((a, b) => a.nickname.localeCompare(b.nickname));
    setFriends(friendList);

    const msgMap = new Map<string, LastMessage>();

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (messages) {
      for (const friendId of friendIds) {
        const friendMsgs = messages.filter(
          m => (m.sender_id === friendId && m.receiver_id === userId) ||
               (m.sender_id === userId && m.receiver_id === friendId)
        );
        if (friendMsgs.length > 0) {
          const latest = friendMsgs[0];
          const unread = friendMsgs.filter(m => m.receiver_id === userId && !m.read).length;
          msgMap.set(friendId, {
            friend_id: friendId,
            message: latest.message_type === 'workout' ? '🏋️ Delade ett pass' : latest.message,
            message_type: latest.message_type,
            created_at: latest.created_at,
            unread_count: unread,
          });
        }
      }
    }

    setLastMessages(msgMap);
    setLoading(false);
  };

  if (selectedFriend) {
    if (selectedFriend.isGrimAnnouncement) {
      return (
        <div className="h-full min-h-0 overflow-hidden">
          <GrimAnnouncementConversation
            currentUserId={userId}
            isAdmin={isAdmin}
            onBack={() => {
              setSelectedFriend(null);
              fetchAnnouncementPreview();
              setAnnouncementUnread(0);
            }}
          />
        </div>
      );
    }
    if (selectedFriend.isGrimSupport) {
      return (
        <div className="h-full min-h-0 overflow-hidden">
          <GrimSupportConversation
            userId={selectedFriend.user_id === GRIM_SUPPORT_ID ? userId : selectedFriend.user_id}
            isAdmin={isAdmin}
            targetNickname={selectedFriend.nickname}
            targetAvatar={selectedFriend.avatar_url}
            onBack={() => {
              setSelectedFriend(null);
              if (isPremium && !isAdmin) fetchGrimMessages();
              if (isAdmin) fetchSupportConversations();
            }}
          />
        </div>
      );
    }
    return (
      <div className="h-full min-h-0 overflow-hidden">
        <ChatConversation
          userId={userId}
          friend={selectedFriend}
          onBack={() => {
            setSelectedFriend(null);
            fetchFriendsAndMessages();
          }}
        />
      </div>
    );
  }

  const sortedFriends = [...friends].sort((a, b) => {
    const msgA = lastMessages.get(a.user_id);
    const msgB = lastMessages.get(b.user_id);
    if (msgA && msgB) return new Date(msgB.created_at).getTime() - new Date(msgA.created_at).getTime();
    if (msgA) return -1;
    if (msgB) return 1;
    return a.nickname.localeCompare(b.nickname);
  });

  const totalUnread = Array.from(lastMessages.values()).reduce((sum, m) => sum + m.unread_count, 0)
    + (grimLastMessage?.unread_count || 0)
    + announcementUnread
    + (isAdmin ? supportConversations.reduce((s, c) => s + c.unread_count, 0) : 0);

  return (
    <div className="flex h-full min-h-0 flex-col py-2">
      <h2 className="mb-3 flex shrink-0 items-center gap-2 text-lg font-bold">
        <MessageCircle className="w-5 h-5 text-primary" />
        Chatt
        {totalUnread > 0 && (
          <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
            {totalUnread}
          </span>
        )}
      </h2>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-sm text-muted-foreground text-center">Laddar...</p>
        </div>
      ) : (
        <div
          data-scroll-lock-scroll="y"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          {/* Grim support for supporter users */}
          {isPremium && !isAdmin && (
            <button
              onClick={() => setSelectedFriend({ user_id: GRIM_SUPPORT_ID, nickname: "Grim", avatar_url: grimIcon, isGrimSupport: true })}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left border border-primary/20 bg-primary/5 mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img src={grimIcon} alt="Grim" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">Grim</span>
                    <Crown className="w-3 h-3 text-primary" />
                  </div>
                  {grimLastMessage && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatTime(grimLastMessage.created_at)}
                    </span>
                  )}
                </div>
                {grimLastMessage ? (
                  <p className={`text-xs truncate ${grimLastMessage.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {grimLastMessage.message}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Supporter-support – skriv till oss!</p>
                )}
              </div>
              {grimLastMessage && grimLastMessage.unread_count > 0 && (
                <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                  {grimLastMessage.unread_count > 9 ? '9+' : grimLastMessage.unread_count}
                </span>
              )}
            </button>
          )}

          {/* Admin: Grim support inbox */}
          {isAdmin && supportConversations.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-bold text-primary mb-1.5 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" />
                Grim Support
              </p>
              {supportConversations.map(conv => (
                <button
                  key={conv.user_id}
                  onClick={() => setSelectedFriend({
                    user_id: conv.user_id,
                    nickname: conv.nickname,
                    avatar_url: conv.avatar_url,
                    isGrimSupport: true,
                  })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {conv.avatar_url ? (
                      <img src={conv.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {conv.nickname.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{conv.nickname}</span>
                        <span className="text-[10px] text-primary font-medium">via Grim</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatTime(conv.last_date)}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {conv.last_message}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </button>
              ))}
              <div className="border-b border-border my-2" />
            </div>
          )}

          {/* Regular friends */}
          {friends.length === 0 && !isPremium && !isAdmin ? (
            <EmptyState
              icon={MessageCircle}
              title="Inga chattar ännu"
              description="Lägg till vänner under Vänner-fliken för att börja chatta!"
              emoji="💬"
            />
          ) : (
            sortedFriends.map(friend => {
              const lastMsg = lastMessages.get(friend.user_id);
              return (
                <button
                  key={friend.user_id}
                  onClick={() => setSelectedFriend(friend)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {friend.nickname.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold truncate">{friend.nickname}</span>
                      {friend.is_honorary && <HonoraryBadge size="xs" />}
                      {lastMsg && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatTime(lastMsg.created_at)}
                        </span>
                      )}
                    </div>
                    {lastMsg ? (
                      <p className={`text-xs truncate ${lastMsg.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {lastMsg.message || '🏋️ Delade ett pass'}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Starta en konversation</p>
                    )}
                  </div>
                  {lastMsg && lastMsg.unread_count > 0 && (
                    <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {lastMsg.unread_count > 9 ? '9+' : lastMsg.unread_count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// Grim Support Conversation component
import { ArrowLeft, Send, Crown as CrownIcon, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const QUICK_REPLIES: { question: string; answer: string }[] = [
  {
    question: "Hur ändrar jag min träningsplan?",
    answer: "Du kan redigera din plan genom att gå till Plan-fliken och trycka på pennikonen ✏️ vid den vecka/dag du vill ändra. Där kan du byta övningar, ändra sets/reps och lägga till nya pass.",
  },
  {
    question: "Hur lägger jag till en övning?",
    answer: "Öppna ett pass i din plan och skriv in övningen i textfältet. Du kan söka bland fördefinierade övningar eller skriva in en egen. Separera övningar med semikolon (;) eller ny rad.",
  },
  {
    question: "Hur funkar leaderboarden?",
    answer: "Leaderboarden rangordnar användare baserat på antal genomförda pass. Du kan filtrera per månad eller se hela årets statistik. Bara avklarade pass räknas – inte skippade!",
  },
  {
    question: "Hur bjuder jag in en vän?",
    answer: "Gå till Social-fliken och tryck på Vänner. Där kan du söka efter användarnamn och skicka en vänförfrågan. Du kan också dela din referral-länk via Verktyg → Bjud in en vän.",
  },
  {
    question: "Hur ändrar jag mitt lösenord?",
    answer: "Gå till din Profil (kugghjulet ⚙️) och scrolla ner till 'Byt lösenord'. Ange ditt nya lösenord och bekräfta. Lösenordet måste vara minst 6 tecken.",
  },
  {
    question: "Vad är Protein Bars?",
    answer: "Protein Bars är en valuta du tjänar genom att bjuda in vänner via din referral-länk. Du kan använda dem i Avatar-shopen för att köpa kläder och tillbehör till din avatar! 💪",
  },
];

interface GrimSupportConversationProps {
  userId: string; // The supporter user's ID
  isAdmin: boolean;
  targetNickname: string;
  targetAvatar: string | null;
  onBack: () => void;
}

interface SupportMessage {
  id: string;
  user_id: string;
  message: string;
  is_from_admin: boolean;
  admin_id: string | null;
  read: boolean;
  created_at: string;
}

const GrimSupportConversation = ({ userId, isAdmin, targetNickname, targetAvatar, onBack }: GrimSupportConversationProps) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  useEffect(() => {
    fetchMessages();
    markAsRead();

    const channel = supabase
      .channel(`support-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${userId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as SupportMessage]);
        markAsRead();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (data) setMessages(data as SupportMessage[]);
  };

  const markAsRead = async () => {
    if (isAdmin) {
      // Admin marks user messages as read
      await supabase
        .from("support_messages")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("is_from_admin", false)
        .eq("read", false);
    } else {
      // User marks admin (Grim) messages as read
      await supabase
        .from("support_messages")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("is_from_admin", true)
        .eq("read", false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) return;
    const msgText = newMessage.trim();
    setSending(true);

    if (isAdmin) {
      // Admin replies as Grim
      await supabase.from("support_messages").insert({
        user_id: userId,
        message: msgText,
        is_from_admin: true,
        admin_id: currentUserId,
      });
    } else {
      // Supporter user sends to Grim
      await supabase.from("support_messages").insert({
        user_id: userId,
        message: msgText,
        is_from_admin: false,
      });
      // Notify all admins (fire and forget)
      supabase.functions.invoke("notify-support", {
        body: { messagePreview: msgText },
      }).catch(() => {});
    }

    setNewMessage("");
    setSending(false);
    inputRef.current?.focus();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    if (!file.type.startsWith("image/")) { toast.error("Endast bilder tillåtna"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5 MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `support/${userId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("social-images").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("social-images").getPublicUrl(path);
      const imageUrl = urlData.publicUrl;
      const msgText = `[bild]${imageUrl}`;

      if (isAdmin) {
        await supabase.from("support_messages").insert({ user_id: userId, message: msgText, is_from_admin: true, admin_id: currentUserId });
      } else {
        await supabase.from("support_messages").insert({ user_id: userId, message: msgText, is_from_admin: false });
        supabase.functions.invoke("notify-support", { body: { messagePreview: "📸 Skickade en bild" } }).catch(() => {});
      }
    } catch {
      toast.error("Kunde inte ladda upp bilden");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleQuickReply = async (text: string) => {
    if (!currentUserId) return;
    setSending(true);

    // Send user's question
    await supabase.from("support_messages").insert({
      user_id: userId,
      message: text,
      is_from_admin: false,
    });

    // Find auto-reply
    const match = QUICK_REPLIES.find(q => q.question === text);
    if (match) {
      // Small delay for natural feel
      await new Promise(r => setTimeout(r, 600));
      await supabase.from("support_messages").insert({
        user_id: userId,
        message: match.answer,
        is_from_admin: true,
        admin_id: null,
      });
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: SupportMessage[] }[] = [];
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

  const headerTitle = isAdmin ? `${targetNickname} (via Grim)` : "Grim";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border pb-3">
        <button onClick={onBack} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
          {isAdmin && targetAvatar ? (
            <img src={targetAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <img src={grimIcon} alt="Grim" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm">{headerTitle}</span>
          <CrownIcon className="w-3 h-3 text-primary" />
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        data-scroll-lock-scroll="y"
        className="min-h-0 flex-1 overflow-y-auto py-3 pb-24 space-y-1 overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {groupedMessages.map(group => (
          <div key={group.date}>
            <div className="text-center my-3">
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {group.date}
              </span>
            </div>
            {group.msgs.map(msg => {
              // For the user: their messages are on the right, Grim (admin) messages on the left
              // For the admin: user messages are on the left, admin replies are on the right
              const isMine = isAdmin ? msg.is_from_admin : !msg.is_from_admin;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    isMine
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}>
                    {!isMine && isAdmin && (
                      <p className="text-[10px] font-semibold text-primary mb-0.5">
                        {targetNickname}
                      </p>
                    )}
                    {!isMine && !isAdmin && (
                      <p className="text-[10px] font-semibold text-primary mb-0.5">
                        Grim
                      </p>
                    )}
                    {msg.message.startsWith("[bild]") ? (
                      <img src={msg.message.replace("[bild]", "")} alt="Bild" className="max-w-full rounded-lg max-h-60 cursor-pointer" onClick={() => window.open(msg.message.replace("[bild]", ""), "_blank")} />
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

        {messages.length === 0 && !isAdmin && (
          <div className="text-center py-8 space-y-3">
            <img src={grimIcon} alt="Grim" className="w-16 h-16 rounded-full mx-auto opacity-60" />
            <p className="text-sm text-muted-foreground">Hej! 👋 Skriv till oss så hjälper vi dig.</p>
            <div className="flex flex-wrap justify-center gap-1.5 px-2">
              {QUICK_REPLIES.map(q => (
                <button key={q.question} onClick={() => handleQuickReply(q.question)} className="text-xs bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-full transition-colors border border-border">
                  {q.question}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.length === 0 && isAdmin && (
          <div className="text-center py-12 space-y-2">
            <img src={grimIcon} alt="Grim" className="w-16 h-16 rounded-full mx-auto opacity-60" />
            <p className="text-sm text-muted-foreground">Inga meddelanden från denna användare ännu.</p>
          </div>
        )}

        {/* Quick replies shown when there are messages too (for non-admin) */}
        {messages.length > 0 && !isAdmin && (
          <div className="flex flex-wrap gap-1.5 px-1 pt-2">
            {QUICK_REPLIES.map(q => (
              <button key={q.question} onClick={() => handleQuickReply(q.question)} className="text-[11px] bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full transition-colors border border-border/50">
                {q.question}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="fixed left-0 right-0 z-40 bg-background border-t border-border px-3 pt-2 pb-2 flex gap-2 items-end max-w-lg mx-auto"
        style={{ bottom: `calc(60px + env(safe-area-inset-bottom, 0px) + 36px)`, touchAction: "none" }}
        onTouchMove={(event) => event.preventDefault()}
      >
        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
        {!isAdmin && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            className="p-2.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
        )}
        <input
          ref={inputRef}
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAdmin ? "Svara som Grim..." : "Skriv till Grim..."}
          className="flex-1 text-sm bg-muted rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
          disabled={sending || uploading}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending || uploading}
          className="p-2.5 bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-colors hover:bg-primary/90 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "nu";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export default ChatView;
