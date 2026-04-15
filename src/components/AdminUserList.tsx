import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Check, Loader2, ChevronDown, Crown, Eye } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";

interface AdminUserListProps {
  userId: string;
  onViewUserPlan?: (targetUserId: string) => void;
}

interface UserEntry {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_honorary: boolean;
}

interface FriendshipStatus {
  [userId: string]: "accepted" | "pending_sent" | "pending_received" | null;
}

const AdminUserList = ({ userId, onViewUserPlan }: AdminUserListProps) => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [friendshipStatuses, setFriendshipStatuses] = useState<FriendshipStatus>({});
  const [loading, setLoading] = useState(false);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);
  const [togglingHonorary, setTogglingHonorary] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open]);

  const fetchData = async () => {
    setLoading(true);

    const [{ data: profiles }, { data: friendships }] = await Promise.all([
      supabase.from("profiles").select("user_id, nickname, avatar_url, is_honorary").order("nickname"),
      supabase.from("friendships").select("user_id, friend_id, status").or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    ]);

    if (profiles) {
      setUsers(profiles.filter((p) => p.user_id !== userId));
    }

    if (friendships) {
      const statuses: FriendshipStatus = {};
      for (const f of friendships) {
        const otherId = f.user_id === userId ? f.friend_id : f.user_id;
        if (f.status === "accepted") {
          statuses[otherId] = "accepted";
        } else if (f.status === "pending") {
          statuses[otherId] = f.user_id === userId ? "pending_sent" : "pending_received";
        }
      }
      setFriendshipStatuses(statuses);
    }

    setLoading(false);
  };

  const addFriend = async (friendId: string) => {
    setAddingFriend(friendId);

    // Check if friendship exists in either direction
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status, user_id, friend_id")
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .limit(1);

    if (existing && existing.length > 0) {
      const row = existing[0];
      if (row.status === "pending" && row.friend_id === userId) {
        await supabase.from("friendships").update({ status: "accepted" }).eq("id", row.id);
      }
    } else {
      await supabase.from("friendships").insert({
        user_id: userId,
        friend_id: friendId,
        status: "pending",
      });
    }

    await fetchData();
    setAddingFriend(null);
  };

  const toggleHonorary = async (targetUserId: string, currentStatus: boolean) => {
    setTogglingHonorary(targetUserId);
    await supabase.from("profiles").update({ is_honorary: !currentStatus }).eq("user_id", targetUserId);
    setUsers((prev) => prev.map((u) => u.user_id === targetUserId ? { ...u, is_honorary: !currentStatus } : u));
    setTogglingHonorary(null);
  };

  const getStatusLabel = (status: FriendshipStatus[string]) => {
    switch (status) {
      case "accepted": return "Vän ✓";
      case "pending_sent": return "Skickad";
      case "pending_received": return "Mottagen";
      default: return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">👑 Alla användare</h3>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2 animate-fade-in">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Inga användare hittades.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{users.length} användare</p>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {users.map((u) => {
                  const status = friendshipStatuses[u.user_id];
                  const isFriend = status === "accepted";
                  const isPending = status === "pending_sent" || status === "pending_received";

                  return (
                    <div
                      key={u.user_id}
                      className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.nickname} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-primary">{u.nickname[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{u.nickname}</span>
                        {u.is_honorary && <HonoraryBadge size="xs" />}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => onViewUserPlan?.(u.user_id)}
                          title="Visa träningsplan"
                          className="p-1.5 rounded-md bg-secondary text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleHonorary(u.user_id, u.is_honorary)}
                          disabled={togglingHonorary === u.user_id}
                          title={u.is_honorary ? "Ta bort hedersmedlemskap" : "Gör till hedersmedlem"}
                          className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all disabled:opacity-50 ${
                            u.is_honorary
                              ? "bg-warning/20 text-warning hover:bg-warning/30"
                              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {togglingHonorary === u.user_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>{u.is_honorary ? "👑 Hedersmedlem" : "Medlem"}</>
                          )}
                        </button>
                        {isFriend ? (
                          <span className="text-xs text-primary font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Vän
                          </span>
                        ) : isPending ? (
                          <span className="text-xs text-muted-foreground">{getStatusLabel(status)}</span>
                        ) : (
                          <button
                            onClick={() => addFriend(u.user_id)}
                            disabled={addingFriend === u.user_id}
                            className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {addingFriend === u.user_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminUserList;
