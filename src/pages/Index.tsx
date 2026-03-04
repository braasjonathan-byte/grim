import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut, Calculator, Heart, Bell, KeyRound, BarChart3, Megaphone, Download, X, Smartphone, Settings, User as UserIcon, Dumbbell, MessageCircle } from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import grimIcon from "@/assets/grim-icon.webp";
import type { User } from "@supabase/supabase-js";
import AuthScreen from "@/components/AuthScreen";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useDataSnapshots } from "@/hooks/useDataSnapshots";

// Lazy-loaded tab components for code splitting
const WorkoutView = lazy(() => import("@/components/WorkoutView"));
const AIChatButton = lazy(() => import("@/components/AIChatButton"));
const FriendsView = lazy(() => import("@/components/FriendsView"));
const OneRMCalculator = lazy(() => import("@/components/OneRMCalculator"));
const PulseZoneCalculator = lazy(() => import("@/components/PulseZoneCalculator"));
const CalorieCalculator = lazy(() => import("@/components/CalorieCalculator"));
const WorkoutTimer = lazy(() => import("@/components/WorkoutTimer"));
const ChangePassword = lazy(() => import("@/components/ChangePassword"));
const WorkoutStats = lazy(() => import("@/components/WorkoutStats"));
const WhatsNewDialog = lazy(() => import("@/components/WhatsNewDialog"));
const SettingsPanel = lazy(() => import("@/components/SettingsPanel"));
const ReferralLink = lazy(() => import("@/components/ReferralLink"));
const SuggestionBox = lazy(() => import("@/components/SuggestionBox"));
const AnnouncementInbox = lazy(() => import("@/components/AnnouncementInbox"));
const AdminUserList = lazy(() => import("@/components/AdminUserList"));
const ProfileTab = lazy(() => import("@/components/ProfileTab"));
const NotificationSettings = lazy(() => import("@/components/NotificationSettings"));
const ExerciseGifManager = lazy(() => import("@/components/ExerciseGifManager"));
const HelpSection = lazy(() => import("@/components/HelpSection"));
const ChatView = lazy(() => import("@/components/ChatView"));

type Tab = "workout" | "friends" | "chat" | "calc" | "stats" | "profile" | "settings";

interface FriendActivity {
  nickname: string;
  day: string;
  week: number;
  timestamp: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationFriendId, setNotificationFriendId] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>(() => {
    // Check URL params first (from push notification deep links)
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab");
    if (urlTab === "workout" || urlTab === "friends" || urlTab === "chat" || urlTab === "calc" || urlTab === "stats" || urlTab === "settings") {
      localStorage.setItem("grim_active_tab", urlTab);
      return urlTab;
    }
    if (urlTab === "profile") {
      localStorage.setItem("grim_active_tab", "settings");
      return "settings";
    }
    const saved = localStorage.getItem("grim_active_tab");
    if (saved === "profile") return "settings";
    return saved === "workout" || saved === "friends" || saved === "chat" || saved === "calc" || saved === "stats" || saved === "settings" ? saved : "workout";
  });

  // Handle deep link params from push notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const friendId = params.get("friendId");
    if (friendId) setNotificationFriendId(friendId);
    // Clean URL params after reading
    if (params.toString()) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Wrap setTab to push browser history for Android back button support
  const setTab = useCallback((newTab: Tab) => {
    setTabState(newTab);
    localStorage.setItem("grim_active_tab", newTab);
    window.history.pushState({ tab: newTab }, "", "");
  }, []);

  // Listen for popstate (Android back button / browser back)
  useEffect(() => {
    // Replace current state with initial tab
    window.history.replaceState({ tab }, "", "");

    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.tab) {
        setTabState(e.state.tab);
        localStorage.setItem("grim_active_tab", e.state.tab);
      } else {
        // Push state back to prevent closing the app
        window.history.pushState({ tab: "workout" }, "", "");
        setTabState("workout");
        localStorage.setItem("grim_active_tab", "workout");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nickname, setNickname] = useState("");
  const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0);
  const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([]);
  const [notification, setNotification] = useState<FriendActivity | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [forceChangePassword, setForceChangePassword] = useState(false);
  const [userRole, setUserRole] = useState<string>("member");
  const [isHonorary, setIsHonorary] = useState(false);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [showInboxDropdown, setShowInboxDropdown] = useState(false);
  const [headerAnnouncements, setHeaderAnnouncements] = useState<{id: string;title: string;message: string;created_at: string;}[]>([]);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [unreadChats, setUnreadChats] = useState(0);

  usePushNotifications(user?.id ?? null);
  useOfflineSync();
  useDataSnapshots(user?.id ?? null);

  // Capture beforeinstallprompt for native Android install
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(async () => {
            const { data } = await supabase.
            from("profiles").
            select("nickname, must_change_password, is_honorary").
            eq("user_id", session.user.id).
            single();
            if (data) {
              setNickname(data.nickname);
              setIsHonorary((data as any).is_honorary || false);
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
        select("nickname, must_change_password, is_honorary").
        eq("user_id", session.user.id).
        single().
        then(({ data }) => {
          if (data) {
            setNickname(data.nickname);
            setIsHonorary((data as any).is_honorary || false);
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

  // Fetch unread chat count
  useEffect(() => {
    if (!user) return;
    const fetchUnreadChats = async () => {
      const { count } = await supabase.
      from("chat_messages").
      select("*", { count: "exact", head: true }).
      eq("receiver_id", user.id).
      eq("read", false);
      setUnreadChats(count || 0);
    };
    fetchUnreadChats();

    const channel = supabase.
    channel("unread-chat-count").
    on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `receiver_id=eq.${user.id}` }, () => {
      fetchUnreadChats();
    }).
    on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `receiver_id=eq.${user.id}` }, () => {
      fetchUnreadChats();
    }).
    subscribe();
    return () => {supabase.removeChannel(channel);};
  }, [user]);

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

        // Immediately mark these activities as seen so they don't reappear on next login
        if (unseen.length > 0) {
          for (const a of unseen) {
            const prev = seenMap[a.nickname];
            if (!prev || new Date(a.timestamp) > new Date(prev)) {
              seenMap[a.nickname] = a.timestamp;
            }
          }
          localStorage.setItem("seenFriendActivities", JSON.stringify(seenMap));
        }
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
        <img src={grimIcon} alt="Grim" className="w-8 h-8 animate-pulse" />
      </div>);

  }

  if (!user) {
    return <AuthScreen onAuth={() => {}} />;
  }

  const friendActivityCount = friendActivities.length;

  const tabs: {key: Tab;icon: typeof Dumbbell;label: string;badge?: number;}[] = [
  { key: "workout", icon: Dumbbell, label: "Träning" },
  { key: "stats", icon: BarChart3, label: "Statistik" },
  { key: "friends", icon: Users, label: "Vänner", badge: friendActivityCount > 0 ? friendActivityCount : undefined },
  { key: "chat", icon: MessageCircle, label: "Chatt", badge: unreadChats > 0 ? unreadChats : undefined },
  { key: "calc", icon: Calculator, label: "Verktyg" },
  { key: "settings", icon: Settings, label: "Inställningar", badge: unreadAnnouncements > 0 ? unreadAnnouncements : undefined }];



  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img alt="Grim" className="w-[48px] h-[48px] shrink-0" src="/lovable-uploads/c1220791-bb57-493f-b09f-0fb458028ded.png" />
            <h1 className="text-base font-black tracking-tight">
              <span className="text-primary"></span>
            </h1>
          </div>
          <div className="flex items-center gap-2 mx-[2px] px-[15px]">
            <a
              href="https://www.tiktok.com/@jonathankarlsson98"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
              aria-label="TikTok">

              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-4 h-4 fill-primary">
                <path d="M448 209.9a210.1 210.1 0 0 1-122.8-39.3v178.8A162.6 162.6 0 1 1 185 188.3v89.9a74.6 74.6 0 1 0 52.2 71.2V0h88a121 121 0 0 0 122.8 121.3z" />
              </svg>
            </a>
            {!window.matchMedia('(display-mode: standalone)').matches &&
            <button
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  const result = await deferredPrompt.userChoice;
                  if (result.outcome === 'accepted') {
                    setDeferredPrompt(null);
                  }
                } else {
                  setShowInstallGuide(true);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors">

                <Download className="w-3.5 h-3.5" />
                Installera
              </button>
            }
            <div className="relative">
              <button
              onClick={async () => {
                  setShowInboxDropdown((prev) => !prev);
                  if (unreadAnnouncements > 0) {
                    // Use the latest announcement's server timestamp to avoid clock skew issues
                    const { data: latestAnn } = await supabase
                      .from("announcements")
                      .select("created_at")
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    const ts = latestAnn?.created_at || new Date().toISOString();
                    localStorage.setItem("gymberget_last_read_announcements", ts);
                    if (userRole === "admin") {
                      const { data: latestSug } = await supabase
                        .from("suggestions")
                        .select("created_at")
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                      localStorage.setItem("grim_last_read_suggestions", latestSug?.created_at || new Date().toISOString());
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
              onClick={handleLogout}
              className="p-1.5 transition-colors text-destructive"
              title="Logga ut">

              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-8 text-center text-muted-foreground text-sm">Laddar…</div>}>
      <main className="max-w-lg mx-auto px-4 py-4">
        {tab === "workout" && <WorkoutView key={workoutRefreshKey} userId={user.id} isAdmin={userRole === "admin"} />}
        {tab === "friends" &&
          <FriendsView
            userId={user.id}
            isAdmin={userRole === "admin"}
            friendActivities={friendActivities}
            onClearActivitiesForFriend={(nickname) => {
              setFriendActivities((prev) => {
                const remaining = prev.filter((a) => a.nickname !== nickname);
                const seenRaw = localStorage.getItem("seenFriendActivities");
                const seenMap: Record<string, string> = seenRaw ? JSON.parse(seenRaw) : {};
                seenMap[nickname] = new Date().toISOString();
                localStorage.setItem("seenFriendActivities", JSON.stringify(seenMap));
                return remaining;
              });
            }}
            initialFriendId={notificationFriendId} />


          }
        {tab === "chat" && <ChatView userId={user.id} />}
        {tab === "stats" && <WorkoutStats userId={user.id} />}
        {tab === "calc" &&
          <div className="py-2 space-y-4">
            <ReferralLink userId={user.id} />
            <WorkoutTimer />
            <OneRMCalculator />
            <PulseZoneCalculator />
            <CalorieCalculator />
            <HelpSection />
          </div>
          }
        {tab === "settings" &&
          <div className="py-2 space-y-4">
            {/* Profile section */}
            <ProfileTab userId={user.id} isAdmin={userRole === "admin"} />
            {/* Role badge */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${userRole === "admin" ? "bg-primary/20 text-primary" : isHonorary ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground"}`}>
                {userRole === "admin" ? "👑 Admin" : isHonorary ? "👑 Hedersmedlem" : "👤 Medlem"}
              </span>
            </div>
            <AnnouncementInbox userId={user.id} isAdmin={userRole === "admin"} />
            {userRole === "admin" && <AdminUserList userId={user.id} />}
            {userRole === "admin" && <ExerciseGifManager />}
            <SettingsPanel userId={user.id} isAdmin={userRole === "admin"} />
            <NotificationSettings userId={user.id} />
            <SuggestionBox userId={user.id} isAdmin={userRole === "admin"} />
            <p className="text-center text-[11px] text-muted-foreground pt-2 pb-4">Version {APP_VERSION}</p>
          </div>
          }
      </main>
      </Suspense>

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

      {/* What's new dialog - temporarily hidden */}
      {/* {!forceChangePassword && <WhatsNewDialog />} */}

      {/* Install guide modal */}
      {showInstallGuide &&
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
      }

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

      {/* AI Chat Button - temporarily disabled */}
      {/* <AIChatButton
          userId={user.id}
          onActionsExecuted={() => setWorkoutRefreshKey((k) => k + 1)} /> */}


      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border z-50">
        <div className="max-w-lg mx-auto flex">
          {tabs.map(({ key, icon: Icon, label, badge }) =>
          <button
            key={key}
            onClick={() => {
              setTab(key);
              if (key === "settings" && unreadAnnouncements > 0) {
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
        </div>
      </nav>
    </div>);

};

export default Index;