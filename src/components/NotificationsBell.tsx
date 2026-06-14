import { useEffect, useState, useCallback } from "react";
import { Bell, Trophy, MessageCircle, Flame, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { getAchievementById } from "@/lib/achievements";
import { onPostInteraction } from "@/lib/postInteractionBus";

type NotifType = "comment" | "like" | "friend_request" | "achievement";
type NotifTarget = "workout" | "calc" | "social" | "triathlon" | "tools";

interface Notif {
  id: string;
  type: NotifType;
  text: string;
  createdAt: string;
  target: NotifTarget;
  postId?: string;
  commentId?: string;
  avatarUrl?: string | null;
  initial?: string;
}

const iconFor = (type: NotifType) => {
  switch (type) {
    case "comment": return MessageCircle;
    case "like": return Flame;
    case "friend_request": return UserPlus;
    case "achievement": return Trophy;
    default: return Bell;
  }
};

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just nu";
  if (min < 60) return `${min} min sedan`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} tim sedan`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Igår";
  if (d < 7) return `${d} dagar sedan`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} v sedan`;
  const mo = Math.floor(d / 30);
  return `${mo} mån sedan`;
};

interface NotificationsBellProps {
  userId: string;
  onViewAll?: () => void;
  onNavigate?: (target: NotifTarget, payload?: { postId?: string; commentId?: string }) => void;
}

export default function NotificationsBell({ userId, onViewAll, onNavigate }: NotificationsBellProps) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    const v = localStorage.getItem(`grim_notif_last_seen_${userId}`);
    return v ? parseInt(v, 10) : 0;
  });

  const load = useCallback(async () => {
    if (!userId) return;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    // 1) my social posts → comments & likes on them
    const { data: myPosts } = await supabase
      .from("social_posts")
      .select("id, caption")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    const postIds = (myPosts || []).map((p: any) => p.id);

    const [commentsRes, likesRes, friendsRes, achRes] = await Promise.all([
      postIds.length
        ? supabase
            .from("social_post_comments")
            .select("id, post_id, user_id, comment, created_at")
            .in("post_id", postIds)
            .neq("user_id", userId)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] as any[] } as any),
      postIds.length
        ? supabase
            .from("social_post_likes")
            .select("id, post_id, user_id, created_at")
            .in("post_id", postIds)
            .neq("user_id", userId)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] as any[] } as any),
      supabase
        .from("friendships")
        .select("id, user_id, created_at")
        .eq("friend_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("user_achievements")
        .select("id, achievement_id, unlocked_at")
        .eq("user_id", userId)
        .gte("unlocked_at", since)
        .order("unlocked_at", { ascending: false })
        .limit(10),
    ]);

    const actorIds = new Set<string>();
    (commentsRes.data || []).forEach((c: any) => actorIds.add(c.user_id));
    (likesRes.data || []).forEach((l: any) => actorIds.add(l.user_id));
    (friendsRes.data || []).forEach((f: any) => actorIds.add(f.user_id));

    let profMap: Record<string, { nickname: string; avatar_url: string | null }> = {};
    if (actorIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nickname, avatar_url")
        .in("user_id", [...actorIds]);
      (profs || []).forEach((p: any) => {
        profMap[p.user_id] = { nickname: p.nickname || "Någon", avatar_url: p.avatar_url };
      });
    }

    const out: Notif[] = [];

    (commentsRes.data || []).forEach((c: any) => {
      const p = profMap[c.user_id];
      out.push({
        id: `c-${c.id}`,
        type: "comment",
        text: `${p?.nickname || "Någon"} kommenterade: "${c.comment.slice(0, 60)}${c.comment.length > 60 ? "…" : ""}"`,
        createdAt: c.created_at,
        target: "social",
        postId: c.post_id,
        commentId: c.id,
        avatarUrl: p?.avatar_url,
        initial: (p?.nickname || "?")[0]?.toUpperCase(),
      });
    });

    (likesRes.data || []).forEach((l: any) => {
      const p = profMap[l.user_id];
      out.push({
        id: `l-${l.id}`,
        type: "like",
        text: `${p?.nickname || "Någon"} eldade ditt inlägg 🔥`,
        createdAt: l.created_at,
        target: "social",
        postId: l.post_id,
        avatarUrl: p?.avatar_url,
        initial: (p?.nickname || "?")[0]?.toUpperCase(),
      });
    });

    (friendsRes.data || []).forEach((f: any) => {
      const p = profMap[f.user_id];
      out.push({
        id: `f-${f.id}`,
        type: "friend_request",
        text: `${p?.nickname || "Någon"} vill bli din vän`,
        createdAt: f.created_at,
        target: "social",
        avatarUrl: p?.avatar_url,
        initial: (p?.nickname || "?")[0]?.toUpperCase(),
      });
    });

    (achRes.data || []).forEach((a: any) => {
      const def = getAchievementById(a.achievement_id);
      out.push({
        id: `a-${a.id}`,
        type: "achievement",
        text: `Nytt achievement: ${def?.title || a.achievement_id} 🎉`,
        createdAt: a.unlocked_at,
        target: "tools",
      });
    });

    out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setNotifs(out.slice(0, 20));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Refresh when popover opens, or when post interactions happen elsewhere
  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => onPostInteraction(() => load()), [load]);

  // Realtime: refresh on incoming friend requests, comments, likes, achievements
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notif-bell-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_post_comments" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_post_likes" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friendships", filter: `friend_id=eq.${userId}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_achievements", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const unread = notifs.filter(n => new Date(n.createdAt).getTime() > lastSeen).length;

  const markAllRead = () => {
    const now = Date.now();
    localStorage.setItem(`grim_notif_last_seen_${userId}`, String(now));
    setLastSeen(now);
  };

  const handleClick = (n: Notif) => {
    setOpen(false);
    if ((n.type === "comment" || n.type === "like") && n.postId) {
      const payload = { postId: n.postId, commentId: n.type === "comment" ? n.commentId : undefined };
      // Persist so SocialView (lazy-loaded) can pick it up on mount
      try { sessionStorage.setItem("grim_pending_social_post", JSON.stringify(payload)); } catch {}
      // Also dispatch live in case SocialView is already mounted
      window.dispatchEvent(new CustomEvent("grim:open-social-post", { detail: payload }));
    } else if (n.type === "friend_request") {
      try { sessionStorage.setItem("grim_pending_social_subtab", "friends"); } catch {}
      window.dispatchEvent(new CustomEvent("grim:open-social-subtab", { detail: { subtab: "friends" } }));
    }
    onNavigate?.(n.target, { postId: n.postId, commentId: n.commentId });
    // Mark this individual item as read by bumping lastSeen past it
    const ts = new Date(n.createdAt).getTime();
    if (ts > lastSeen) {
      localStorage.setItem(`grim_notif_last_seen_${userId}`, String(ts));
      setLastSeen(ts);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary transition-colors"
          aria-label="Aviseringar"
          title="Aviseringar"
        >
          <Bell className="w-[18px] h-[18px]" strokeWidth={2.25} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none ring-2 ring-background">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 border-primary shadow-none">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Aviseringar</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Markera alla som lästa
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {notifs.slice(0, 10).map(n => {
            const Icon = iconFor(n.type);
            const isUnread = new Date(n.createdAt).getTime() > lastSeen;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left flex items-start gap-3 px-3 py-2 border-b border-border/50 hover:bg-primary/10 transition-colors ${isUnread ? "bg-primary/5" : ""}`}
                >
                  <div className="relative flex items-center justify-center w-8 h-8 bg-muted text-primary shrink-0 mt-0.5 rounded-full overflow-hidden">
                    {n.avatarUrl ? (
                      <img src={n.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold">{n.initial || <Icon className="w-4 h-4" />}</span>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center">
                      <Icon className="w-3 h-3 text-primary" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{n.text}</p>
                    <span className="text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
                  </div>
                  {isUnread && <span className="w-2 h-2 bg-destructive shrink-0 mt-2 rounded-full" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
          {notifs.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Inga aviseringar än</li>
          )}
        </ul>
        <div className="px-3 py-2 border-t border-border text-center">
          <button
            onClick={() => { setOpen(false); onViewAll?.(); }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Visa alla aviseringar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
