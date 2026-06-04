import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogOut, Bell, BarChart3, MessageCircle, Dumbbell, Calculator, HelpCircle, Apple } from "lucide-react";
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
import { requestInitialPermissions } from "@/lib/requestInitialPermissions";
import { autoConnectHeartRate } from "@/lib/heartRate";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useDataSnapshots } from "@/hooks/useDataSnapshots";
import HonoraryBadge from "@/components/HonoraryBadge";
import MiniTimer from "@/components/MiniTimer";
import WhatsNewDialog from "@/components/WhatsNewDialog";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import TourPrompt from "@/components/TourPrompt";
import PageTransition from "@/components/PageTransition";
import { hapticLight } from "@/lib/haptics";
import { ensureUnlocked } from "@/lib/biometric";
import { Capacitor } from "@capacitor/core";
import { logCrashlyticsMessage, recordError, setCrashlyticsUserId } from "@/lib/crashlytics";


// Lazy-loaded tab components for code splitting
const WorkoutView = lazy(() => import("@/components/WorkoutView"));
const SocialView = lazy(() => import("@/components/SocialView"));
const ChangePassword = lazy(() => import("@/components/ChangePassword"));
const WorkoutStats = lazy(() => import("@/components/WorkoutStats"));
const ToolsTab = lazy(() => import("@/components/ToolsTab"));
const ChatView = lazy(() => import("@/components/ChatView"));
const NutritionView = lazy(() => import("@/components/NutritionView"));

type Tab = "workout" | "nutrition" | "social" | "friends" | "calc" | "stats" | "profile" | "settings";

interface FriendActivity {
  nickname: string;
  day: string;
  week: number;
  timestamp: string;
}

interface AccessStatus {
  nickname: string | null;
  must_change_password: boolean | null;
  is_honorary: boolean | null;
  theme: string | null;
  role: "admin" | "member" | string | null;
}

const GRIM_INFO_KEY = "gymberget_grim_info_seen";
const isPreviewEnvironment = () =>
  window.location.hostname.includes("preview") || window.location.hostname.includes("lovableproject.com");

const fallbackNicknameFromUser = (currentUser: User | null | undefined) => {
  const rawNickname = currentUser?.user_metadata?.nickname;
  if (typeof rawNickname === "string" && rawNickname.trim()) return rawNickname.trim();
  const emailName = currentUser?.email?.split("@")[0]?.trim();
  if (!emailName) return "";
  return emailName.toLowerCase() === "jonne" ? "Grim" : emailName;
};

const GrimInfoDialog = () => {
  const [open, setOpen] = useState(() => !localStorage.getItem(GRIM_INFO_KEY));
  const handleClose = () => { localStorage.setItem(GRIM_INFO_KEY, "1"); setOpen(false); };
  if (isPreviewEnvironment()) return null;
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
    if (urlTab === "workout" || urlTab === "nutrition" || urlTab === "social" || urlTab === "friends" || urlTab === "chat" || urlTab === "calc" || urlTab === "stats" || urlTab === "settings") {
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

  // Listen for timer running state to show pulse on bottom nav
  const [timerRunning, setTimerRunning] = useState(false);
  useEffect(() => {
    const onState = (e: Event) => setTimerRunning(!!(e as CustomEvent).detail?.running);
    window.addEventListener("grim:timer-state", onState);
    return () => window.removeEventListener("grim:timer-state", onState);
  }, []);

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
    if (newTab === "workout") {
      setWorkoutRefreshKey((key) => key + 1);
    }
    hapticLight();
    setTabState(newTab);
    localStorage.setItem("grim_active_tab", newTab);
    window.history.pushState({ tab: newTab }, "", "");
    if (newTab === "social") {
      localStorage.setItem("grim_last_read_posts", new Date().toISOString());
      setUnreadPosts(0);
    }
  }, []);

  // Listen for tour navigation events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Tab;
      if (detail === "workout" || detail === "nutrition" || detail === "stats" || detail === "social" || detail === "calc") {
        setTab(detail);
      }
    };

    window.addEventListener("grim:set-tab", handler);
    return () => window.removeEventListener("grim:set-tab", handler);
  }, [setTab]);

  // Auto-resume an interrupted tour after a page reload
  useEffect(() => {
    import("@/lib/tour").then(({ resumeTourIfNeeded }) => resumeTourIfNeeded());
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
  const userRef = useRef<User | null>(null);
  const loadUserDataSeqRef = useRef(0);
  const [workoutRefreshKey, setWorkoutRefreshKey] = useState(0);
  const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([]);
  const [notification, setNotification] = useState<FriendActivity | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [forceChangePassword, setForceChangePassword] = useState(false);
  const [userRole, setUserRole] = useState<string>("member");
  const [isHonorary, setIsHonorary] = useState(false);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadPosts, setUnreadPosts] = useState(0);
  const [isAppInstalled, setIsAppInstalled] = useState(() => {
    const isPreview = isPreviewEnvironment();
    if (isPreview) return false;
    if (Capacitor.isNativePlatform()) return true;
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  });
  const [showInstallDialog, setShowInstallDialog] = useState(false);

  // Detect if app is installed (standalone mode or native Capacitor app)
  useEffect(() => {
    const isPreview = isPreviewEnvironment();
    const isNative = Capacitor.isNativePlatform();
    const isStandalone =
      isNative ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsAppInstalled(isStandalone && !isPreview);

    if (isPreview || isNative) {
      setShowInstallDialog(false);
      return;
    }

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

  useEffect(() => {
    if (!user || Capacitor.isNativePlatform()) return;
    void requestInitialPermissions();
    void autoConnectHeartRate();
  }, [user]);


  // Shared helper to load profile + role. Profile and role are loaded
  // INDEPENDENTLY — a failure in one must not silently wipe the other,
  // which previously caused admins/hedersmedlemmar to render as "Medlem".
  const loadUserData = useCallback(async (uid: string) => {
    const requestId = ++loadUserDataSeqRef.current;
    await logCrashlyticsMessage("loadUserData:start");

    try {
      const { data: statusData, error: statusError } = await (supabase as any)
        .rpc("get_my_access_status");
      if (statusError) throw statusError;

      const status = (Array.isArray(statusData) ? statusData[0] : statusData) as AccessStatus | undefined;
      if (requestId !== loadUserDataSeqRef.current) return;
      if (status) {
        setNickname(status.nickname || fallbackNicknameFromUser(userRef.current));
        setIsHonorary(Boolean(status.is_honorary) || status.role === "admin");
        setUserRole(status.role || "member");
        if (status.must_change_password) {
          setForceChangePassword(true);
          setShowChangePassword(true);
        }
        const savedTheme = status.theme || "default";
        storeThemeId(savedTheme);
        if (!isThemeLocked()) {
          applyTheme(savedTheme);
        }
        await logCrashlyticsMessage(`loadUserData:access-status:${status.role || "member"}`);
        return;
      }
    } catch (error) {
      console.warn("[loadUserData] access status failed", error);
      await recordError(error instanceof Error ? error : new Error(String(error)), { step: "loadUserData:accessStatus" });
    }

    try {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("nickname, must_change_password, is_honorary, theme")
        .eq("user_id", uid)
        .maybeSingle();
      if (profileError) throw profileError;
      if (requestId !== loadUserDataSeqRef.current) return;
      if (data) {
        setNickname(data.nickname);
        setIsHonorary((data as any).is_honorary || false);
        if (data.must_change_password) {
          setForceChangePassword(true);
          setShowChangePassword(true);
        }
        const savedTheme = (data as any).theme || "default";
        storeThemeId(savedTheme);
        if (!isThemeLocked()) {
          applyTheme(savedTheme);
        }
      }
    } catch (error) {
      console.warn("[loadUserData] profile failed", error);
      await recordError(error instanceof Error ? error : new Error(String(error)), { step: "loadUserData:profile" });
    }

    try {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();
      if (roleError) throw roleError;
      if (requestId !== loadUserDataSeqRef.current) return;
      const role = roleData ? (roleData as any).role : "member";
      setUserRole(role);
      if (role === "admin") setIsHonorary(true);
    } catch (error) {
      console.warn("[loadUserData] role failed", error);
      await recordError(error instanceof Error ? error : new Error(String(error)), { step: "loadUserData:role" });
    }

    await logCrashlyticsMessage("loadUserData:done");
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void logCrashlyticsMessage(`auth:${_event}`);
        void setCrashlyticsUserId(session?.user?.id ?? null);
        userRef.current = session?.user ?? null;
        setUser(session?.user ?? null);
        if (session?.user) setNickname(fallbackNicknameFromUser(session.user));
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        supabase.auth.signOut().catch(() => {});
      }
      userRef.current = session?.user ?? null;
      setUser(session?.user ?? null);
      if (session?.user) setNickname(fallbackNicknameFromUser(session.user));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Single source of truth: (re)load profile + role whenever the auth user changes.
  useEffect(() => {
    if (!user?.id) {
      setUserRole("member");
      setIsHonorary(false);
      setNickname("");
      return;
    }
    userRef.current = user;
    void loadUserData(user.id);
  }, [user?.id, loadUserData]);

  // Force-refresh profile/role data when the app resumes (native APK) or tab
  // becomes visible (PWA). Ensures admin/honorary status appears without
  // requiring a logout/login cycle after server-side grant changes.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const refresh = () => {
      void (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const activeUser = session?.user ?? userRef.current;
        if (activeUser) {
          userRef.current = activeUser;
          setUser(activeUser);
          setNickname((current) => current || fallbackNicknameFromUser(activeUser));
          await loadUserData(activeUser.id);
        } else {
          await loadUserData(uid);
        }
      })();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);

    let disposed = false;
    let removeNative: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          const { App } = await import("@capacitor/app");
          const handle = await App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) refresh();
          });
          const handle2 = await App.addListener("resume", refresh);
          removeNative = () => {
            handle.remove().catch(() => {});
            handle2.remove().catch(() => {});
          };
          if (disposed) removeNative();
        } catch {
          /* @capacitor/app unavailable */
        }
      })();
    }

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
      removeNative?.();
    };
  }, [user?.id, loadUserData]);
  // App icon badge — show unread count when away, clear when visible
  const totalUnread = unreadAnnouncements + unreadChats + unreadPosts + friendActivities.length;
  useEffect(() => {
    const nav: any = navigator;
    const setBadge = () => {
      if (document.visibilityState === "visible" || totalUnread === 0) {
        nav.clearAppBadge?.().catch?.(() => {});
      } else {
        nav.setAppBadge?.(totalUnread).catch?.(() => {});
      }
    };
    setBadge();
    document.addEventListener("visibilitychange", setBadge);
    window.addEventListener("focus", setBadge);
    return () => {
      document.removeEventListener("visibilitychange", setBadge);
      window.removeEventListener("focus", setBadge);
    };
  }, [totalUnread]);

  // Idle preload — warm up the most likely next tab while user is idle.
  useEffect(() => {
    if (!user) return;
    const ric: any = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1500));
    const handle = ric(() => {
      // Preload tabs the user hasn't visited yet
      if (tab !== "social") import("@/components/SocialView").catch(() => {});
      if (tab !== "stats") import("@/components/WorkoutStats").catch(() => {});
      if (tab !== "calc") import("@/components/ToolsTab").catch(() => {});
      if (tab !== "workout") import("@/components/WorkoutView").catch(() => {});
    });
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && typeof handle === "number") cic(handle);
    };
  }, [user, tab]);

  // Biometric app-lock gate (opt-in). Re-prompt when app returns to foreground.
  const [biometricLocked, setBiometricLocked] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const gate = async () => {
      const ok = await ensureUnlocked();
      if (!cancelled) setBiometricLocked(!ok);
    };
    gate();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        sessionStorage.removeItem("grim_biometric_unlocked");
        gate();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user]);

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

  // Fetch unread chat count — always re-sync from DB to avoid drift
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

    const onFocus = () => fetchUnreadChats();
    const onVisibility = () => { if (document.visibilityState === "visible") fetchUnreadChats(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase.
    channel("unread-chat-count").
    on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `receiver_id=eq.${user.id}` }, () => {
      fetchUnreadChats();
    }).
    on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `receiver_id=eq.${user.id}` }, () => {
      fetchUnreadChats();
    }).
    on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, () => {
      fetchUnreadChats();
    }).
    subscribe();
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
    return <AuthScreen onAuth={() => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        userRef.current = session.user;
        setUser(session.user);
        setNickname(fallbackNicknameFromUser(session.user));
        void loadUserData(session.user.id);
      });
    }} />;
  }

  const friendActivityCount = friendActivities.length;

  const socialBadge = friendActivityCount + unreadChats + unreadPosts + unreadAnnouncements;
  const tabs: {key: Tab;icon: typeof Dumbbell;label: string;badge?: number;}[] = [
  { key: "workout", icon: Dumbbell, label: "Träning" },
  { key: "nutrition", icon: Apple, label: "Kost" },
  { key: "stats", icon: BarChart3, label: "Statistik" },
  { key: "social", icon: Users, label: "Social", badge: socialBadge > 0 ? socialBadge : undefined },
  { key: "calc", icon: Calculator, label: "Verktyg" }];


  return (
    <div className="min-h-screen bg-background pb-20" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 44px)" }}>
      {biometricLocked && (
        <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center gap-6 px-6">
          <img src={grimIcon} alt="Grim app icon" className="w-16 h-16" />
          <div className="text-center space-y-2">
            <p className="text-xl font-black font-serif">Lås upp Grim</p>
            <p className="text-sm text-muted-foreground">Bekräfta din identitet för att fortsätta.</p>
          </div>
          <button
            onClick={async () => {
              const { verifyBiometric } = await import("@/lib/biometric");
              const ok = await verifyBiometric();
              if (ok) setBiometricLocked(false);
            }}
            className="px-6 py-3 bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-transform"
          >
            Lås upp
          </button>
        </div>
      )}
      <WhatsNewDialog />
      {/* Install prompt dialog */}
      <Dialog open={showInstallDialog && !isPreviewEnvironment()} onOpenChange={(v) => {
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
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background border-primary" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="max-w-lg mx-auto px-4 py-1 flex items-center justify-between text-primary-foreground">
          <button onClick={() => setTab("workout")} className="flex items-center gap-2 cursor-pointer" aria-label="Grim – Din personliga träningspartner">
            <h1 className="text-2xl font-black tracking-tight font-serif text-foreground">
              <span aria-hidden="true">Grim<span className="text-accent">.</span></span>
              <span className="sr-only">Grim – Din personliga träningspartner</span>
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
              data-tour="header-help"
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
            <span className="text-sm font-semibold text-primary text-center font-sans">{nickname}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <Suspense fallback={<TabSkeleton />}>
      <main className="max-w-lg mx-auto px-4 py-4" style={{ paddingBottom: bottomNavOffset }}>
        <PageTransition tabKey={tab}>
          {tab === "workout" && <>
            <OnboardingTutorial />
            <WorkoutView key={adminViewUserId || workoutRefreshKey} userId={adminViewUserId || user.id} isAdmin={userRole === "admin"} isHonorary={isHonorary} onBack={adminViewUserId ? () => { setAdminViewUserId(null); setTab("calc"); } : undefined} />
          </>}
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
          {tab === "nutrition" && <NutritionView userId={user.id} isHonorary={isHonorary} />}
          {tab === "calc" &&
            <ToolsTab userId={user.id} isAdmin={userRole === "admin"} isHonorary={isHonorary} userRole={userRole} onLogout={handleLogout} onViewUserPlan={(targetUserId) => { setAdminViewUserId(targetUserId); setTab("workout"); }} />
          }
        </PageTransition>
      </main>
      </Suspense>

      <TourPrompt userId={user.id} />

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
        {timerRunning && (
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider"
            aria-label="Timer aktiv"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
            Timer
          </div>
        )}
        <div className="max-w-lg mx-auto flex">
          {tabs.map(({ key, icon: Icon, label, badge }) =>
          <button
            key={key}
            data-tour={`tab-${key}`}
            onClick={async () => {
              setTab(key);
              if (key === "social" && unreadAnnouncements > 0) {
                const { data: latestAnn } = await supabase.
                from("announcements").
                select("created_at").
                order("created_at", { ascending: false }).
                limit(1).
                maybeSingle();
                localStorage.setItem("gymberget_last_read_announcements", latestAnn?.created_at || new Date().toISOString());
                setUnreadAnnouncements(0);
              }
              if (key === "calc" && userRole === "admin") {
                const { data: latestSug } = await supabase.
                from("suggestions").
                select("created_at").
                order("created_at", { ascending: false }).
                limit(1).
                maybeSingle();
                localStorage.setItem("grim_last_read_suggestions", latestSug?.created_at || new Date().toISOString());
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
              <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center [border-radius:9999px!important]">
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