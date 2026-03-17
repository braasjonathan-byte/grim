import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, ArrowLeft } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";
import ChatConversation from "./ChatConversation";
import EmptyState from "@/components/EmptyState";

interface ChatViewProps {
  userId: string;
  initialFriendId?: string | null;
}

interface Friend {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_honorary?: boolean;
}

interface LastMessage {
  friend_id: string;
  message: string | null;
  message_type: string;
  created_at: string;
  unread_count: number;
}

const ChatView = ({ userId, initialFriendId }: ChatViewProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [lastMessages, setLastMessages] = useState<Map<string, LastMessage>>(new Map());
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFriendsAndMessages();
    // Subscribe to new messages for unread counts
    const channel = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === userId || msg.receiver_id === userId) {
          fetchFriendsAndMessages();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (initialFriendId && friends.length > 0) {
      const f = friends.find(f => f.user_id === initialFriendId);
      if (f) setSelectedFriend(f);
    }
  }, [initialFriendId, friends]);

  const fetchFriendsAndMessages = async () => {
    // Get accepted friends
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

    // Fetch last message per friend + unread count
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
    return (
      <ChatConversation
        userId={userId}
        friend={selectedFriend}
        onBack={() => {
          setSelectedFriend(null);
          fetchFriendsAndMessages();
        }}
      />
    );
  }

  // Sort friends: those with messages first (by date), then alphabetically
  const sortedFriends = [...friends].sort((a, b) => {
    const msgA = lastMessages.get(a.user_id);
    const msgB = lastMessages.get(b.user_id);
    if (msgA && msgB) return new Date(msgB.created_at).getTime() - new Date(msgA.created_at).getTime();
    if (msgA) return -1;
    if (msgB) return 1;
    return a.nickname.localeCompare(b.nickname);
  });

  const totalUnread = Array.from(lastMessages.values()).reduce((sum, m) => sum + m.unread_count, 0);

  return (
    <div className="py-2">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-primary" />
        Chatt
        {totalUnread > 0 && (
          <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
            {totalUnread}
          </span>
        )}
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Laddar...</p>
      ) : friends.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Inga chattar ännu"
          description="Lägg till vänner under Vänner-fliken för att börja chatta!"
          emoji="💬"
        />
      ) : (
        <div className="space-y-1">
          {sortedFriends.map(friend => {
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
                    {friend.is_honorary && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 text-warning px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap flex-shrink-0">
                        <Crown className="w-2.5 h-2.5" />
                        Hedersmedlem
                      </span>
                    )}
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
          })}
        </div>
      )}
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
