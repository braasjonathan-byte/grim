import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut, Bell, BarChart3, Megaphone, X, MessageCircle, Dumbbell, Calculator, HelpCircle } from "lucide-react";
import { APP_VERSION } from "@/lib/version";
import { applyTheme, getStoredThemeId, storeThemeId, isThemeLocked } from "@/lib/themes";
import grimIcon from "@/assets/grim-icon.webp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import TabSkeleton from "@/components/TabSkeleton";
import AuthScreen from "@/components/AuthScreen";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNativePush } from "@/hooks/useNativePush";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useDataSnapshots } from "@/hooks/useDataSnapshots";
import HonoraryBadge from "@/components/HonoraryBadge";
import MiniTimer from "@/components/MiniTimer";
import WhatsNewDialog from "@/components/WhatsNewDialog";

// Lazy-loaded tab components for code splitting
const WorkoutView = lazy(() => import("@/components/WorkoutView"));
const SocialView = lazy(() => import("@/components/SocialView"));
const ChangePassword = lazy(() => import("@/components/ChangePassword"));
const WorkoutStats = lazy(() => import("@/components/WorkoutStats"));
const ToolsTab = lazy(() => import("@/components/ToolsTab"));
const ChatView = lazy(() => import("@/components/ChatView"));

type Tab = "workout" | "social" | "friends" | "calc" | "stats" | "profile" | "settings";

interface FriendActivity {
  nickname: string;
  day: string;
  week: number;
  timestamp: string;
}

const GRIM_INFO_KEY = "gymberget_grim_info_seen";
const GrimInfoDialog = () => {
  const [open, setOpen] = useState(() => !localStorage.getItem(GRIM_INFO_KEY));
  const handleClose = () => { localStorage.setItem(GRIM_INFO_KEY, "1"); setOpen(false); };
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Nytt: Grim Supporter Support
          </DialogTitle>
          <DialogDescription>En ny funktion för Supporters</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img src={grimIcon} alt="Grim" className="w-12 h-12 rounded-full" />
            <p className="text-sm text-foreground">
              Supporters har nu tillgång till <strong>direktsupport via Grim</strong> i chatten!
            </p>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>💬 Skriv direkt till Grim för hjälp och frågor</li>
            <li>📸 Skicka bilder i supportchatten</li>
            <li>⚡ Snabbsvar på vanliga frågor</li>
          </ul>
          <p className="text-xs text-muted-foreground italic">
            Bli Supporter för att få tillgång – hitta Grim i chatten!
          </p>
        </div>
        <button onClick={handleClose} className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-md text-sm mt-2">
          Förstått!
        </button>
      </DialogContent>
    </Dialog>
  );
};

const Index = () => {
  const bottomSafeInset = "max(env(safe-area-inset-bottom), 16px)";
  const bottomNavOffset = `calc(5.5rem + ${bottomSafeInset})`;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationFriendId, setNotificationFriendId] = useState<string | null>(null);
  const [adminViewUserId, setAdminViewUserId] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>(() => {
    // Check URL params first (from push notification deep links)
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab");
    if (urlTab === "workout" || urlTab === "social" || urlTab === "friends" || urlTab === "chat" || urlTab === "calc" || urlTab === "stats" || urlTab === "settings") {
      const resolvedTab = (urlTab === "friends" || urlTab === "chat") ? "social" : urlTab;
      localStorage.setItem("grim_active_tab", resolvedTab);
      return resolvedTab as Tab;
    }
    if (urlTab === "profile") {
      localStorage.setItem("grim_active_tab", "calc");
      return "calc";
    }
    const saved = localStorage.getItem("grim_active_tab");
    if (saved === "profile" || saved === "settings") return "calc";
    if (saved === "friends" || saved === "chat") return "social";
    return saved === "workout" || saved === "social" || saved === "calc" || saved === "stats" ? saved as Tab : "workout";
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
    if (newTab === "social") {
      localStorage.setItem("grim_last_read_posts", new Date().toISOString());
      setUnreadPosts(0);
    }
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
  const navigate = useNavigate();
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
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadPosts, setUnreadPosts] = useState(0);
  const [isAppInstalled, setIsAppInstalled] = useState(() => {
    const isPreview = window.location.hostname.includes("preview") || window.location.hostname.includes("lovableproject.com");
    if (isPreview) return false;
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  });
  const [showInstallDialog, setShowInstallDialog] = useState(false);

  // Detect if app is installed (standalone mode)
  useEffect(() => {
    const isPreview = window.location.hostname.includes("preview") || window.location.hostname.includes("lovableproject.com");
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsAppInstalled(isStandalone && !isPreview);

    if (!isStandalone && user) {
      const dismissed = sessionStorage.getItem("grim_install_prompt_dismissed");
      if (!dismissed) {
        setShowInstallDialog(true);
      }
    }
  }, [user]);

  usePushNotifications(user?.id ?? null);
  useNativePush(user?.id ?? null);
  useOfflineSync();
  useDataSnapshots(user?.id ?? null);


  // Shared helper to load profile + role (called once per session)
  const loadUserData = useCallback(async (uid: string) => {
    const [{ data }, { data: roleData }] = await Promise.all([
      supabase.from("profiles").select("nickname, must_change_password, is_honorary, theme").eq("user_id", uid).single(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    if (data) {
      setNickname(data.nickname);
      setIsHonorary((data as any).is_honorary || false);
      if (data.must_change_password) {
        setForceChangePassword(true);
        setShowChangePassword(true);
      }
      // Apply saved color theme (only if not locked by friend profile view)
      const savedTheme = (data as any).theme || "default";
      storeThemeId(savedTheme);
      if (!isThemeLocked()) {
        applyTheme(savedTheme);
      }
    }
    if (roleData) setUserRole(roleData.role);
  }, []);

  useEffect(() => {
    let initialDone = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user && initialDone) {
          setTimeout(() => loadUserData(session.user.id), 0);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      initialDone = true;
      if (error || !session) {
        // Clear any stale/invalid session so user gets a clean login screen
        supabase.auth.signOut().catch(() => {});
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);
  // Clear PWA app icon badge on load/focus
  useEffect(() => {
    const clearBadge = () => {
      if ("clearAppBadge" in navigator) {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    };
    clearBadge();
    window.addEventListener("focus", clearBadge);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") clearBadge();
    });
    return () => {
      window.removeEventListener("focus", clearBadge);
    };
  }, []);

  // Check for unread announcements + suggestions (for admins) — single combined query
  useEffect(() => {
    if (!user) return;
    const checkUnread = async () => {
      const lastRead = localStorage.getItem("gymberget_last_read_announcements") || "1970-01-01T00:00:00Z";

      // Fetch announcements (serves both count and display — avoids separate head query)
      const { data } = await supabase.
      from("announcements").
      select("id, title, message, created_at").
      order("created_at", { ascending: false }).
      limit(20);
      if (data) {
        setHeaderAnnouncements(data.slice(0, 5));
        const unreadCount = data.filter(a => a.created_at > lastRead).length;

        let suggestionCount = 0;
        if (userRole === "admin") {
          const lastReadSuggestions = localStorage.getItem("grim_last_read_suggestions") || "1970-01-01T00:00:00Z";
          const { count } = await supabase.
          from("suggestions").
          select("*", { count: "exact", head: true }).
          gt("created_at", lastReadSuggestions);
          suggestionCount = count || 0;
        }

        setUnreadAnnouncements(unreadCount + suggestionCount);
      }
    };
    checkUnread();
  }, [user, userRole]);

  // Fetch unread chat count — use incremental updates from realtime instead of refetching
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
      // Increment locally instead of refetching
      setUnreadChats(prev => prev + 1);
    }).
    on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `receiver_id=eq.${user.id}` }, (payload) => {
      // If message was marked as read, decrement
      const newMsg = payload.new as any;
      if (newMsg.read) {
        setUnreadChats(prev => Math.max(0, prev - 1));
      }
    }).
    subscribe();
    return () => {supabase.removeChannel(channel);};
  }, [user]);

  // Track unread social posts
  useEffect(() => {
    if (!user) return;
    const lastRead = localStorage.getItem("grim_last_read_posts") || "1970-01-01T00:00:00Z";

    const fetchUnread = async () => {
      const { count } = await supabase
        .from("social_posts")
        .select("*", { count: "exact", head: true })
        .gt("created_at", lastRead)
        .neq("user_id", user.id);
      setUnreadPosts(count || 0);
    };
    fetchUnread();

    const channel = supabase
      .channel("unread-social-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_posts" }, (payload) => {
        const newPost = payload.new as any;
        if (newPost.user_id !== user.id) {
          setUnreadPosts(prev => prev + 1);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <img src={grimIcon} alt="Grim" className="w-8 h-8 animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
          {[1, 2, 3].map((i) =>
          <div key={i} className="rounded-xl border border-border p-4 space-y-3">
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>);

  }

  if (!user) {
    return <AuthScreen onAuth={() => {}} />;
  }

  const friendActivityCount = friendActivities.length;

  const tabs: {key: Tab;icon: typeof Dumbbell;label: string;badge?: number;}[] = [
  { key: "workout", icon: Dumbbell, label: "Träning" },
  { key: "stats", icon: BarChart3, label: "Statistik" },
  { key: "social", icon: Users, label: "Social", badge: (friendActivityCount + unreadChats + unreadPosts) > 0 ? (friendActivityCount + unreadChats + unreadPosts) : undefined },
  { key: "calc", icon: Calculator, label: "Verktyg", badge: unreadAnnouncements > 0 ? unreadAnnouncements : undefined }];


  return (
    <div className="min-h-screen bg-background pb-20">
      <WhatsNewDialog />
      {/* Install prompt dialog */}
      <Dialog open={showInstallDialog} onOpenChange={(v) => {
        if (!v) {
          sessionStorage.setItem("grim_install_prompt_dismissed", "1");
          setShowInstallDialog(false);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Installera Grim
            </DialogTitle>
            <DialogDescription>
              Lägg till Grim på din hemskärm för en snabbare och bättre upplevelse – precis som en vanlig app!
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                sessionStorage.setItem("grim_install_prompt_dismissed", "1");
                setShowInstallDialog(false);
                navigate("/install");
              }}
              className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity active:scale-95"
            >
              Visa guide
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem("grim_install_prompt_dismissed", "1");
                setShowInstallDialog(false);
              }}
              className="flex-1 bg-secondary text-secondary-foreground font-medium py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity active:scale-95"
            >
              Inte nu
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background border-primary will-change-transform" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="max-w-lg mx-auto px-4 py-1 flex items-center justify-between text-primary-foreground">
          <button onClick={() => setTab("workout")} className="flex items-center gap-2 cursor-pointer">
            <h1 className="text-2xl font-black tracking-tight font-serif text-foreground">
              Grim<span className="text-accent">.</span>
            </h1>
          </button>
          <div className="flex items-center gap-2 mx-[2px] px-[15px]">
            <button
              onClick={() => {
                setTab("calc");
                // Poll for the help section to appear (lazy-loaded), then scroll to it
                let attempts = 0;
                const tryScroll = () => {
                  const el = document.getElementById("help-section");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth" });
                    return;
                  }
                  if (attempts++ < 40) setTimeout(tryScroll, 100);
                };
                setTimeout(tryScroll, 50);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-primary/10 transition-colors"
              aria-label="Hjälp & tips"
              title="Hjälp & tips"
            >
              <HelpCircle className="w-4 h-4 text-primary" />
            </button>
            {!isAppInstalled && (
              <button
                onClick={() => navigate("/install")}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-primary/10 transition-colors"
                aria-label="Installera appen"
                title="Installera appen"
              >
                <Download className="w-4 h-4 text-primary" />
              </button>
            )}
            <div className="relative">
              <button
                onClick={async () => {
                  setShowInboxDropdown((prev) => !prev);
                  // Always mark as read when opening inbox
                  const { data: latestAnn } = await supabase.
                  from("announcements").
                  select("created_at").
                  order("created_at", { ascending: false }).
                  limit(1).
                  maybeSingle();
                  if (latestAnn?.created_at) {
                    localStorage.setItem("gymberget_last_read_announcements", latestAnn.created_at);
                  }
                  if (userRole === "admin") {
                    const { data: latestSug } = await supabase.
                    from("suggestions").
                    select("created_at").
                    order("created_at", { ascending: false }).
                    limit(1).
                    maybeSingle();
                    if (latestSug?.created_at) {
                      localStorage.setItem("grim_last_read_suggestions", latestSug.created_at);
                    }
                  }
                  setUnreadAnnouncements(0);
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
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.message}</p>
                          </div>
                    )
                    }
                    </div>
                  </div>
                </>
              }
            </div>
            <span className="text-sm font-semibold text-primary text-center font-sans">{nickname}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <Suspense fallback={<TabSkeleton />}>
      <main className="max-w-lg mx-auto px-4 py-4" style={{ paddingBottom: bottomNavOffset }}>
        {tab === "workout" && <WorkoutView key={adminViewUserId || workoutRefreshKey} userId={adminViewUserId || user.id} isAdmin={userRole === "admin"} isHonorary={isHonorary} onBack={adminViewUserId ? () => { setAdminViewUserId(null); setTab("calc"); } : undefined} />}
        {tab === "social" &&
          <SocialView
            userId={user.id}
            isAdmin={userRole === "admin"}
            isHonorary={isHonorary}
            friendActivities={friendActivities}
            unreadChats={unreadChats}
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
        
        {tab === "stats" && <WorkoutStats userId={user.id} />}
        {tab === "calc" &&
          <ToolsTab userId={user.id} isAdmin={userRole === "admin"} isHonorary={isHonorary} userRole={userRole} onLogout={handleLogout} onViewUserPlan={(targetUserId) => { setAdminViewUserId(targetUserId); setTab("workout"); }} />
        }
      </main>
      </Suspense>

      {/* Notification toast at bottom */}
      {notification &&
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
          <div className="bg-card border border-primary/40 rounded-lg px-4 py-3 flex items-center gap-3 max-w-sm">
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

      {/* Grim support info – shown once for all users */}
      {!forceChangePassword && <GrimInfoDialog />}



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


      {/* Mini Timer above footer */}
      <MiniTimer />

      {/* Bottom tab bar */}
      <nav
        className="fixed left-0 right-0 bottom-0 bg-card border-t border-border z-50"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: "translate3d(0,0,0)",
          WebkitTransform: "translate3d(0,0,0)",
          willChange: "transform",
        }}
      >
        <div className="max-w-lg mx-auto flex">
          {tabs.map(({ key, icon: Icon, label, badge }) =>
          <button
            key={key}
            onClick={async () => {
              setTab(key);
              if (key === "calc" && unreadAnnouncements > 0) {
                const { data: latestAnn } = await supabase.
                from("announcements").
                select("created_at").
                order("created_at", { ascending: false }).
                limit(1).
                maybeSingle();
                localStorage.setItem("gymberget_last_read_announcements", latestAnn?.created_at || new Date().toISOString());
                if (userRole === "admin") {
                  const { data: latestSug } = await supabase.
                  from("suggestions").
                  select("created_at").
                  order("created_at", { ascending: false }).
                  limit(1).
                  maybeSingle();
                  localStorage.setItem("grim_last_read_suggestions", latestSug?.created_at || new Date().toISOString());
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