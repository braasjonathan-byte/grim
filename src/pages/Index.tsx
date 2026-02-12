import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Users, Edit3, LogOut, Calculator, Heart, Bell, KeyRound, BarChart3, ShoppingCart } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import AuthScreen from "@/components/AuthScreen";
import WorkoutView from "@/components/WorkoutView";
import PlanEditor from "@/components/PlanEditor";
import FriendsView from "@/components/FriendsView";
import OneRMCalculator from "@/components/OneRMCalculator";
import PulseZoneCalculator from "@/components/PulseZoneCalculator";
import ChangePassword from "@/components/ChangePassword";
import WorkoutStats from "@/components/WorkoutStats";

type Tab = "workout" | "plan" | "friends" | "calc" | "stats";

interface FriendActivity {
  nickname: string;
  day: string;
  week: number;
  timestamp: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("workout");
  const [nickname, setNickname] = useState("");
  const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([]);
  const [notification, setNotification] = useState<FriendActivity | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(async () => {
            const { data } = await supabase.
            from("profiles").
            select("nickname").
            eq("user_id", session.user.id).
            single();
            if (data) setNickname(data.nickname);
          }, 0);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase.
        from("profiles").
        select("nickname").
        eq("user_id", session.user.id).
        single().
        then(({ data }) => {
          if (data) setNickname(data.nickname);
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Subscribe to friend workout completions in real-time
  useEffect(() => {
    if (!user) return;

    const fetchFriendIds = async () => {
      const { data: friendships } = await supabase.
      from("friendships").
      select("user_id, friend_id").
      eq("status", "accepted").
      or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (!friendships || friendships.length === 0) return;

      const friendIds = friendships.map((f) =>
      f.user_id === user.id ? f.friend_id : f.user_id
      );

      // Fetch recent completions (last 24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentCompletions } = await supabase.
      from("workout_completions").
      select("user_id, week, day, done, updated_at").
      in("user_id", friendIds).
      eq("done", true).
      gte("updated_at", since).
      order("updated_at", { ascending: false }).
      limit(20);

      if (recentCompletions && recentCompletions.length > 0) {
        const userIds = [...new Set(recentCompletions.map((c) => c.user_id))];
        const { data: profiles } = await supabase.
        from("profiles").
        select("user_id, nickname").
        in("user_id", userIds);

        const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.nickname]));

        const activities: FriendActivity[] = recentCompletions.map((c) => ({
          nickname: nameMap.get(c.user_id) || "Okänd",
          day: c.day,
          week: c.week,
          timestamp: c.updated_at
        }));

        // Filter out activities already seen (stored in localStorage)
        const seenRaw = localStorage.getItem("seenFriendActivities");
        const seenMap: Record<string, string> = seenRaw ? JSON.parse(seenRaw) : {};
        const unseen = activities.filter((a) => {
          const lastSeen = seenMap[a.nickname];
          return !lastSeen || new Date(a.timestamp) > new Date(lastSeen);
        });
        setFriendActivities(unseen);
      }

      // Real-time subscription for new completions
      const channel = supabase.
      channel("friend-completions").
      on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workout_completions"
        },
        async (payload) => {
          const newComp = payload.new as any;
          if (!friendIds.includes(newComp.user_id) || !newComp.done) return;

          const { data: profile } = await supabase.
          from("profiles").
          select("nickname").
          eq("user_id", newComp.user_id).
          maybeSingle();

          const activity: FriendActivity = {
            nickname: profile?.nickname || "Okänd",
            day: newComp.day,
            week: newComp.week,
            timestamp: newComp.updated_at || new Date().toISOString()
          };

          setFriendActivities((prev) => [activity, ...prev.slice(0, 19)]);
          setNotification(activity);
          setTimeout(() => setNotification(null), 4000);
        }
      ).
      subscribe();

      return () => {supabase.removeChannel(channel);};
    };

    fetchFriendIds();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setNickname("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Dumbbell className="w-8 h-8 text-primary animate-pulse" />
      </div>);

  }

  if (!user) {
    return <AuthScreen onAuth={() => {}} />;
  }

  const friendActivityCount = friendActivities.length;

  const tabs: {key: Tab;icon: typeof Dumbbell;label: string;badge?: number;}[] = [
  { key: "workout", icon: Dumbbell, label: "Träning" },
  { key: "plan", icon: Edit3, label: "Schema" },
  { key: "stats", icon: BarChart3, label: "Statistik" },
  { key: "friends", icon: Users, label: "Vänner", badge: friendActivityCount > 0 ? friendActivityCount : undefined },
  { key: "calc", icon: Calculator, label: "Verktyg" }];

  const handleShopClick = () => {
    window.open("https://www.gymberget.se", "_blank");
  };


  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            <h1 className="text-base font-black tracking-tight">
              GYMBERGET<span className="text-primary">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">{nickname}</span>
            <button
              onClick={() => setShowChangePassword(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Byt lösenord">

              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 transition-colors text-destructive"
              title="Logga ut">

              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {tab === "workout" && <WorkoutView userId={user.id} />}
        {tab === "plan" && <PlanEditor userId={user.id} />}
        {tab === "friends" &&
        <FriendsView
          userId={user.id}
          friendActivities={friendActivities}
          onClearActivitiesForFriend={(nickname) => {
            setFriendActivities((prev) => {
              const remaining = prev.filter((a) => a.nickname !== nickname);
              // Persist seen timestamp in localStorage
              const seenRaw = localStorage.getItem("seenFriendActivities");
              const seenMap: Record<string, string> = seenRaw ? JSON.parse(seenRaw) : {};
              seenMap[nickname] = new Date().toISOString();
              localStorage.setItem("seenFriendActivities", JSON.stringify(seenMap));
              return remaining;
            });
          }} />

        }
        {tab === "stats" && <WorkoutStats userId={user.id} />}
        {tab === "calc" &&
        <div className="py-2 space-y-4">
            <OneRMCalculator />
            <PulseZoneCalculator />
          </div>
        }
      </main>

      {/* Notification toast at bottom */}
      {notification &&
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
          <div className="bg-card border border-primary/40 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 max-w-sm">
            <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold">{notification.nickname}</p>
              <p className="text-xs text-muted-foreground">
                Klarade {notification.day}, vecka {notification.week} 💪
              </p>
            </div>
          </div>
        </div>
      }

      {/* Change password modal */}
      {showChangePassword && <ChangePassword onClose={() => setShowChangePassword(false)} />}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border z-50">
        <div className="max-w-lg mx-auto flex">
          {tabs.map(({ key, icon: Icon, label, badge }) =>
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors relative ${
            tab === key ?
            "text-primary" :
            "text-muted-foreground hover:text-foreground"}`
            }>

              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge &&
              <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
              }
              </div>
              <span className="font-medium">{label}</span>
            </button>
          )}
          <button
            onClick={handleShopClick}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors text-muted-foreground hover:text-foreground"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="font-medium">Shop</span>
          </button>
        </div>
      </nav>
    </div>);

};

export default Index;