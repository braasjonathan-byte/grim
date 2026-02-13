import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Users, Edit3, LogOut, Calculator, Heart, Bell, KeyRound, BarChart3, ShoppingCart, Megaphone, Download, X, Smartphone } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import AuthScreen from "@/components/AuthScreen";
import WorkoutView from "@/components/WorkoutView";
import PlanEditor from "@/components/PlanEditor";
import FriendsView from "@/components/FriendsView";
import OneRMCalculator from "@/components/OneRMCalculator";
import PulseZoneCalculator from "@/components/PulseZoneCalculator";
import ChangePassword from "@/components/ChangePassword";
import WorkoutStats from "@/components/WorkoutStats";
import WhatsNewDialog from "@/components/WhatsNewDialog";
import SettingsPanel from "@/components/SettingsPanel";
import SuggestionBox from "@/components/SuggestionBox";
import AnnouncementInbox from "@/components/AnnouncementInbox";
import AdminUserList from "@/components/AdminUserList";
import NotificationSettings from "@/components/NotificationSettings";
import { usePushNotifications } from "@/hooks/usePushNotifications";

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
  const [forceChangePassword, setForceChangePassword] = useState(false);
  const [userRole, setUserRole] = useState<string>("member");
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [showInboxDropdown, setShowInboxDropdown] = useState(false);
  const [headerAnnouncements, setHeaderAnnouncements] = useState<{id: string;title: string;message: string;created_at: string;}[]>([]);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  usePushNotifications(user?.id ?? null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(async () => {
            const { data } = await supabase.
            from("profiles").
            select("nickname, must_change_password").
            eq("user_id", session.user.id).
            single();
            if (data) {
              setNickname(data.nickname);
              if (data.must_change_password) {
                setForceChangePassword(true);
                setShowChangePassword(true);
              }
            }
            const { data: roleData } = await supabase.
            from("user_roles").
            select("role").
            eq("user_id", session.user.id).
            maybeSingle();
            if (roleData) setUserRole(roleData.role);
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
        select("nickname, must_change_password").
        eq("user_id", session.user.id).
        single().
        then(({ data }) => {
          if (data) {
            setNickname(data.nickname);
            if (data.must_change_password) {
              setForceChangePassword(true);
              setShowChangePassword(true);
            }
          }
        });
        supabase.
        from("user_roles").
        select("role").
        eq("user_id", session.user.id).
        maybeSingle().
        then(({ data: roleData }) => {
          if (roleData) setUserRole(roleData.role);
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
  // Check for unread announcements + suggestions (for admins)
  useEffect(() => {
    if (!user) return;
    const checkUnread = async () => {
      const lastRead = localStorage.getItem("gymberget_last_read_announcements") || "1970-01-01T00:00:00Z";
      const { count: announcementCount } = await supabase.
      from("announcements").
      select("*", { count: "exact", head: true }).
      gt("created_at", lastRead);

      let suggestionCount = 0;
      if (userRole === "admin") {
        const lastReadSuggestions = localStorage.getItem("grim_last_read_suggestions") || "1970-01-01T00:00:00Z";
        const { count } = await supabase.
        from("suggestions").
        select("*", { count: "exact", head: true }).
        gt("created_at", lastReadSuggestions);
        suggestionCount = count || 0;
      }

      setUnreadAnnouncements((announcementCount || 0) + suggestionCount);

      const { data } = await supabase.
      from("announcements").
      select("id, title, message, created_at").
      order("created_at", { ascending: false }).
      limit(5);
      if (data) setHeaderAnnouncements(data);
    };
    checkUnread();
  }, [user, userRole]);

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
  { key: "calc", icon: Calculator, label: "Verktyg", badge: unreadAnnouncements > 0 ? unreadAnnouncements : undefined }];

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
            <h1 className="text-base font-black tracking-tight">Grim
              <span className="text-primary"></span>
            </h1>
          </div>
          <div className="flex items-center gap-2 mx-[2px] px-[15px]">
            {!window.matchMedia('(display-mode: standalone)').matches && (
              <button
                onClick={() => setShowInstallGuide(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Installera
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => {
                  setShowInboxDropdown((prev) => !prev);
                  if (unreadAnnouncements > 0) {
                    localStorage.setItem("gymberget_last_read_announcements", new Date().toISOString());
                    if (userRole === "admin") {
                      localStorage.setItem("grim_last_read_suggestions", new Date().toISOString());
                    }
                    setUnreadAnnouncements(0);
                  }
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors relative"
                title="Inkorg">

                <Megaphone className="h-[20px] w-[20px]" />
                {unreadAnnouncements > 0 &&
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadAnnouncements > 9 ? "9+" : unreadAnnouncements}
                  </span>
                }
              </button>
              {showInboxDropdown &&
              <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowInboxDropdown(false)} />
                  <div className="fixed left-1/2 -translate-x-1/2 top-14 w-[calc(100vw-1rem)] max-w-sm bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <h4 className="text-sm font-bold">📢 Inkorg</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {headerAnnouncements.length === 0 ?
                    <p className="text-xs text-muted-foreground text-center py-4">Inga meddelanden.</p> :

                    headerAnnouncements.map((a) =>
                    <div key={a.id} className="p-3 border-b border-border last:border-b-0 space-y-1">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-bold text-foreground">{a.title}</h5>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(a.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                          </div>
                    )
                    }
                    </div>
                  </div>
                </>
              }
            </div>
            <span className="text-sm font-semibold text-primary text-center font-sans">{nickname}</span>
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
            {/* Role badge */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${userRole === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {userRole === "admin" ? "👑 Admin" : "👤 Medlem"}
              </span>
            </div>
            <AnnouncementInbox userId={user.id} isAdmin={userRole === "admin"} />
            {userRole === "admin" && <AdminUserList userId={user.id} />}
            <SettingsPanel userId={user.id} />
            <NotificationSettings userId={user.id} />
            <OneRMCalculator />
            <PulseZoneCalculator />
            <SuggestionBox userId={user.id} isAdmin={userRole === "admin"} />
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

      {/* What's new dialog - hide when forced password change is active to avoid focus trap conflict */}
      {!forceChangePassword && <WhatsNewDialog />}

      {/* Install guide modal */}
      {showInstallGuide && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[70]" onClick={() => setShowInstallGuide(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[80] max-w-sm mx-auto bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold">Installera Grim</h3>
              </div>
              <button onClick={() => setShowInstallGuide(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* iPhone */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-1.5">🍎 iPhone / iPad</h4>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Öppna <strong className="text-foreground">grim.lovable.app</strong> i <strong className="text-foreground">Safari</strong></li>
                  <li>Tryck på <strong className="text-foreground">dela-ikonen</strong> (rutan med pil uppåt) längst ner</li>
                  <li>Scrolla ner och tryck <strong className="text-foreground">"Lägg till på hemskärmen"</strong></li>
                  <li>Tryck <strong className="text-foreground">"Lägg till"</strong> uppe till höger</li>
                  <li>Öppna appen från hemskärmen – den körs nu i helskärm!</li>
                </ol>
                <p className="text-[10px] text-muted-foreground italic">
                  💡 Push-notiser kräver iOS 16.4+ och att appen öppnas via hemskärmen.
                </p>
              </div>

              {/* Android */}
              <div className="space-y-2 border-t border-border pt-4">
                <h4 className="text-sm font-bold flex items-center gap-1.5">🤖 Android</h4>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Öppna <strong className="text-foreground">grim.lovable.app</strong> i <strong className="text-foreground">Chrome</strong></li>
                  <li>Tryck på <strong className="text-foreground">⋮ menyn</strong> (tre prickar uppe till höger)</li>
                  <li>Tryck <strong className="text-foreground">"Installera app"</strong> eller <strong className="text-foreground">"Lägg till på startskärmen"</strong></li>
                  <li>Bekräfta genom att trycka <strong className="text-foreground">"Installera"</strong></li>
                  <li>Appen syns nu som en vanlig app på din startskärm!</li>
                </ol>
                <p className="text-[10px] text-muted-foreground italic">
                  💡 Chrome visar ofta en installationsbanner automatiskt – tryck på den om den dyker upp.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Change password modal */}
      {showChangePassword &&
      <ChangePassword
        forced={forceChangePassword}
        onClose={() => {
          if (!forceChangePassword) {
            setShowChangePassword(false);
          }
        }}
        onChanged={() => {
          setForceChangePassword(false);
          setShowChangePassword(false);
        }} />

      }

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border z-50">
        <div className="max-w-lg mx-auto flex">
          {tabs.map(({ key, icon: Icon, label, badge }) =>
          <button
            key={key}
            onClick={() => {
              setTab(key);
              if (key === "calc" && unreadAnnouncements > 0) {
                localStorage.setItem("gymberget_last_read_announcements", new Date().toISOString());
                if (userRole === "admin") {
                  localStorage.setItem("grim_last_read_suggestions", new Date().toISOString());
                }
                setUnreadAnnouncements(0);
              }
            }}
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
          <a
            href="https://www.gymberget.se"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors text-muted-foreground hover:text-foreground">
            <ShoppingCart className="w-5 h-5" />
            <span className="font-medium">Shop</span>
          </a>
        </div>
      </nav>
    </div>);

};

export default Index;