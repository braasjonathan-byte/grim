import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, UserPlus, Check, X, ChevronDown, ChevronUp, Users } from "lucide-react";

interface FriendsViewProps {
  userId: string;
}

interface FriendProfile {
  user_id: string;
  nickname: string;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
}

interface FriendCompletion {
  week: number;
  day: string;
  done: boolean;
}

interface FriendPlan {
  week: number;
  day: string;
  session_name: string;
}

const FriendsView = ({ userId }: FriendsViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [friends, setFriends] = useState<(Friendship & { profile: FriendProfile })[]>([]);
  const [pendingRequests, setPendingRequests] = useState<(Friendship & { profile: FriendProfile })[]>([]);
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);
  const [friendProgress, setFriendProgress] = useState<Record<string, { plans: FriendPlan[]; completions: FriendCompletion[] }>>({});
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, [userId]);

  const fetchFriends = async () => {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (!friendships) return;

    // Get all related user IDs
    const otherIds = friendships.map((f) =>
      f.user_id === userId ? f.friend_id : f.user_id
    );

    if (otherIds.length === 0) {
      setFriends([]);
      setPendingRequests([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", otherIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    const accepted: typeof friends = [];
    const pending: typeof pendingRequests = [];

    for (const f of friendships) {
      const otherId = f.user_id === userId ? f.friend_id : f.user_id;
      const profile = profileMap.get(otherId);
      if (!profile) continue;

      const entry = { ...f, profile };
      if (f.status === "accepted") {
        accepted.push(entry);
      } else if (f.status === "pending" && f.friend_id === userId) {
        // Incoming request
        pending.push(entry);
      }
    }

    setFriends(accepted);
    setPendingRequests(pending);
  };

  const searchUsers = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);

    const { data } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .ilike("nickname", `%${searchQuery.trim()}%`)
      .neq("user_id", userId)
      .limit(10);

    setSearchResults(data || []);
    setSearching(false);
  };

  const sendRequest = async (friendId: string) => {
    await supabase.from("friendships").insert({
      user_id: userId,
      friend_id: friendId,
      status: "pending",
    });
    setSearchResults([]);
    setSearchQuery("");
    fetchFriends();
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    fetchFriends();
  };

  const rejectRequest = async (friendshipId: string) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    fetchFriends();
  };

  const loadFriendProgress = async (friendUserId: string) => {
    if (friendProgress[friendUserId]) {
      setExpandedFriend(expandedFriend === friendUserId ? null : friendUserId);
      return;
    }

    const [{ data: plans }, { data: completions }] = await Promise.all([
      supabase.from("workout_plans").select("week, day, session_name").eq("user_id", friendUserId).order("week"),
      supabase.from("workout_completions").select("week, day, done").eq("user_id", friendUserId),
    ]);

    setFriendProgress((prev) => ({
      ...prev,
      [friendUserId]: {
        plans: plans || [],
        completions: completions || [],
      },
    }));
    setExpandedFriend(friendUserId);
  };

  const isAlreadyFriend = (uid: string) =>
    friends.some((f) => f.profile.user_id === uid) ||
    pendingRequests.some((f) => f.profile.user_id === uid);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black">Vänner</h2>

      {/* Search */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              placeholder="Sök efter användarnamn..."
              className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={searchUsers}
            disabled={searching}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md"
          >
            Sök
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="bg-card border border-border rounded-lg divide-y divide-border animate-fade-in">
            {searchResults.map((profile) => (
              <div key={profile.user_id} className="flex items-center justify-between p-3">
                <span className="font-semibold text-sm">{profile.nickname}</span>
                {isAlreadyFriend(profile.user_id) ? (
                  <span className="text-xs text-muted-foreground">Redan tillagd</span>
                ) : (
                  <button
                    onClick={() => sendRequest(profile.user_id)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md"
                  >
                    <UserPlus className="w-3 h-3" /> Lägg till
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Vänförfrågningar</h3>
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-3 bg-card border border-primary/30 rounded-lg">
              <span className="font-semibold text-sm">{req.profile.nickname}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => acceptRequest(req.id)}
                  className="p-1.5 bg-success text-success-foreground rounded-md"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => rejectRequest(req.id)}
                  className="p-1.5 bg-destructive text-destructive-foreground rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Dina vänner ({friends.length})
        </h3>
        {friends.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Users className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Inga vänner ännu. Sök efter användarnamn ovan!</p>
          </div>
        ) : (
          friends.map((friend) => {
            const fid = friend.profile.user_id;
            const isExpanded = expandedFriend === fid;
            const progress = friendProgress[fid];

            return (
              <div key={friend.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => loadFriendProgress(fid)}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
                >
                  <span className="font-semibold text-sm">{friend.profile.nickname}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isExpanded && progress && (
                  <div className="px-4 pb-4 border-t border-border pt-3 animate-fade-in">
                    {progress.plans.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Inget schema ännu</p>
                    ) : (
                      (() => {
                        const weeks = [...new Set(progress.plans.map((p) => p.week))].sort((a, b) => a - b);
                        const compMap = new Map(progress.completions.map((c) => [`${c.week}-${c.day}`, c.done]));

                        return (
                          <div className="space-y-3">
                            {weeks.map((w) => {
                              const weekPlans = progress.plans.filter((p) => p.week === w);
                              const done = weekPlans.filter((p) => compMap.get(`${p.week}-${p.day}`)).length;
                              const pct = Math.round((done / weekPlans.length) * 100);

                              return (
                                <div key={w} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold">V{w}</span>
                                    <span className="text-muted-foreground">{done}/{weekPlans.length} ({pct}%)</span>
                                  </div>
                                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FriendsView;
