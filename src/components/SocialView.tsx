import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Flame, ImagePlus, Send, Trash2, MessageCircle, Globe, UsersRound, X, Camera, Pin, MoreHorizontal, Dumbbell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import HonoraryBadge from "./HonoraryBadge";
import ImageCarousel from "./ImageCarousel";
import WorkoutCheerButton from "./WorkoutCheerButton";
import FlameReaction from "./FlameReaction";
import { parseWorkoutCaption, WORKOUT_KIND_META, CHIP_TONE_CLASS } from "@/lib/parseWorkoutCaption";
import { lazy, Suspense } from "react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { checkInteractionAchievements } from "@/lib/achievements";
import { emitPostInteraction, onPostInteraction } from "@/lib/postInteractionBus";
import { isSocialInteractionId, mergeWorkoutComments, stripSocialInteractionId } from "@/lib/workoutSocialSync";
import { parseDateKeyNoonUtc } from "@/lib/dateUtils";
import { FeedSkeleton } from "@/components/LoadingSkeletons";
import EmptyState from "@/components/EmptyState";

const FriendsView = lazy(() => import("./FriendsView"));
const ChatView = lazy(() => import("./ChatView"));
const EventGroupPage = lazy(() => import("./EventGroupPage"));
const AnnouncementInbox = lazy(() => import("./AnnouncementInbox"));

interface SocialViewProps {
  userId: string;
  isAdmin: boolean;
  isHonorary?: boolean;
  friendActivities: { nickname: string; day: string; week: number; timestamp: string }[];
  unreadChats?: number;
  onClearActivitiesForFriend: (nickname: string) => void;
  initialFriendId?: string | null;
}

interface SocialPost {
  id: string;
  user_id: string;
  image_url: string | null;
  caption: string | null;
  visibility: string;
  group_id: string | null;
  workout_week: number | null;
  workout_day: string | null;
  created_at: string;
  pinned: boolean;
}

interface EventGroup {
  id: string;
  event_name: string;
  event_date: string | null;
  event_type: string;
  is_auto: boolean;
  member_count?: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAY_INDEX: Record<string, number> = { "Mån": 0, "Tis": 1, "Ons": 2, "Tor": 3, "Tors": 3, "Fre": 4, "Lör": 5, "Sön": 6 };

const addUtcDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY);

const getMonday = (date: Date) => {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
  const day = normalized.getUTCDay() || 7;
  return addUtcDays(normalized, -day + 1);
};

const resolveWorkoutPostDate = (post: SocialPost, planStartDate?: string | null) => {
  const dateMatch = post.workout_day?.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return parseDateKeyNoonUtc(dateMatch[1]);

  const dayKey = post.workout_day?.replace(/_[a-z0-9]+$/i, "").trim();
  const dayIndex = dayKey ? DAY_INDEX[dayKey] : undefined;
  if (planStartDate && post.workout_week && post.workout_week > 0 && dayIndex !== undefined) {
    return addUtcDays(getMonday(parseDateKeyNoonUtc(planStartDate)), (post.workout_week - 1) * 7 + dayIndex);
  }

  return null;
};

type SubTab = "feed" | "friends" | "chat" | "groups";

const SocialView = ({ userId, isAdmin, isHonorary = false, friendActivities, unreadChats = 0, onClearActivitiesForFriend, initialFriendId }: SocialViewProps) => {
  const [subTab, setSubTabState] = useState<SubTab>(() => {
    if (initialFriendId) return "friends";
    const saved = localStorage.getItem("grim_social_subtab");
    return (saved === "feed" || saved === "friends" || saved === "chat" || saved === "groups") ? saved : "feed";
  });
  const setSubTab = (t: SubTab) => {
    setSubTabState(t);
    try { localStorage.setItem("grim_social_subtab", t); } catch {}
  };
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [likeUsers, setLikeUsers] = useState<Record<string, string[]>>({});
  const [showCompose, setShowCompose] = useState(false);
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string; caption: string }[]>([]);
  const [postVisibility, setPostVisibility] = useState<string>("public");
  const [postGroupId, setPostGroupId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "friends">("all");
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);
  const [postImages, setPostImages] = useState<Record<string, { image_url: string; caption: string | null }[]>>({});
  const [planStartDates, setPlanStartDates] = useState<Record<string, string | null>>({});
  const [comments, setComments] = useState<Record<string, { id: string; user_id: string; comment: string; created_at: string }[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const isChatTab = subTab === "chat";

  useLockBodyScroll(isChatTab);

  useEffect(() => { loadFeed(); loadGroups(); loadFriendIds(); }, [userId]);

  // Live-sync new posts, comments and likes (e.g. when added from a workout card)
  useEffect(() => {
    const channel = supabase
      .channel(`social-feed-interactions-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "social_posts" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "social_post_comments" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "social_post_likes" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_comments" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_likes" }, () => loadFeed())
      .subscribe();
    // Backup: in-app event bus — fires immediately when WorkoutPostThread mutates
    const off = onPostInteraction((pid) => {
      loadFeed();
      if (pid && comments[pid]) loadComments(pid);
    });
    // Refresh whenever the tab regains focus / becomes visible
    const onFocus = () => loadFeed();
    const onVisibility = () => { if (document.visibilityState === "visible") loadFeed(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    // Also poll lightly every 60s as a final safety net
    const interval = window.setInterval(() => loadFeed(), 60000);
    return () => {
      supabase.removeChannel(channel);
      off();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Highlight state for notification deep-linking
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);

  // Open a specific post (and optionally a comment) from a notification click
  useEffect(() => {
    const openTarget = async (detail: { postId?: string; commentId?: string } | undefined) => {
      if (!detail?.postId) return;
      setSubTab("feed");
      setFeedFilter("all");
      setOpenGroupId(null);
      setOpenComments(prev => {
        const s = new Set(prev);
        s.add(detail.postId!);
        return s;
      });
      await loadComments(detail.postId);
      setHighlightedPostId(detail.postId);
      setHighlightedCommentId(detail.commentId || null);
      // Retry scroll until the target element exists in the DOM (max ~3s)
      const sel = detail.commentId
        ? `[data-comment-id="${detail.commentId}"]`
        : `[data-post-id="${detail.postId}"]`;
      let attempts = 0;
      const tryScroll = () => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        if (attempts++ < 20) setTimeout(tryScroll, 150);
      };
      tryScroll();
      setTimeout(() => { setHighlightedCommentId(null); setHighlightedPostId(null); }, 4000);
    };

    // Consume any pending target that was set before SocialView mounted (lazy load)
    try {
      const raw = sessionStorage.getItem("grim_pending_social_post");
      if (raw) {
        sessionStorage.removeItem("grim_pending_social_post");
        openTarget(JSON.parse(raw));
      }
      const pendingSub = sessionStorage.getItem("grim_pending_social_subtab");
      if (pendingSub === "friends") {
        sessionStorage.removeItem("grim_pending_social_subtab");
        setSubTab("friends");
      }
    } catch {}

    const handler = (e: Event) => openTarget((e as CustomEvent).detail);
    const subtabHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { subtab?: SubTab } | undefined;
      if (detail?.subtab) setSubTab(detail.subtab);
    };
    window.addEventListener("grim:open-social-post", handler as EventListener);
    window.addEventListener("grim:open-social-subtab", subtabHandler as EventListener);
    return () => {
      window.removeEventListener("grim:open-social-post", handler as EventListener);
      window.removeEventListener("grim:open-social-subtab", subtabHandler as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tour navigation – switch sub-tab when tour requests it
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as SubTab;
      if (detail === "feed" || detail === "friends" || detail === "chat" || detail === "groups") {
        setSubTab(detail);
      }
    };
    window.addEventListener("grim:social-subtab", handler);
    return () => window.removeEventListener("grim:social-subtab", handler);
  }, []);

  const loadFriendIds = async () => {
    const { data } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (data) {
      const ids = new Set<string>();
      data.forEach((f: { user_id: string; friend_id: string }) => {
        ids.add(f.user_id === userId ? f.friend_id : f.user_id);
      });
      setFriendIds(ids);
    }
  };

  const loadFeed = async () => {
    try {
      await loadFeedInner();
    } finally {
      setFeedLoading(false);
    }
  };

  const loadFeedInner = async () => {
    const { data: postsData } = await supabase
      .from("social_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (postsData) {
      setPosts(postsData as SocialPost[]);
      // Load nicknames
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      if (userIds.length > 0) {
        const [{ data: nicks }, { data: profilesData }] = await Promise.all([
          supabase.rpc("get_suggestion_nicknames", { user_ids: userIds }),
          supabase.from("profiles").select("user_id, avatar_url, plan_start_date").in("user_id", userIds),
        ]);
        if (nicks) {
          const map: Record<string, string> = {};
          nicks.forEach((n: { user_id: string; nickname: string }) => { map[n.user_id] = n.nickname; });
          setNicknames(map);
        }
        if (profilesData) {
          const aMap: Record<string, string | null> = {};
          const startMap: Record<string, string | null> = {};
          profilesData.forEach((p: { user_id: string; avatar_url: string | null; plan_start_date: string | null }) => {
            aMap[p.user_id] = p.avatar_url;
            startMap[p.user_id] = p.plan_start_date;
          });
          setAvatarUrls(aMap);
          setPlanStartDates(startMap);
        }
      }
      // Load likes + post images
      const postIds = postsData.map(p => p.id);
      if (postIds.length > 0) {
        const [{ data: likesData }, { data: imgData }, { data: commentsData }] = await Promise.all([
          supabase.from("social_post_likes").select("post_id, user_id").in("post_id", postIds),
          supabase.from("social_post_images").select("post_id, image_url, caption, sort_order").in("post_id", postIds).order("sort_order", { ascending: true }),
          supabase.from("social_post_comments").select("post_id").in("post_id", postIds),
        ]);
        if (commentsData) {
          const cMap: Record<string, number> = {};
          (commentsData as { post_id: string }[]).forEach(c => { cMap[c.post_id] = (cMap[c.post_id] || 0) + 1; });
          setCommentCounts(cMap);
        }
        if (likesData) {
          const countMap: Record<string, number> = {};
          const userMap: Record<string, string[]> = {};
          const mySet = new Set<string>();
          likesData.forEach((l: { post_id: string; user_id: string }) => {
            countMap[l.post_id] = (countMap[l.post_id] || 0) + 1;
            (userMap[l.post_id] ||= []).push(l.user_id);
            if (l.user_id === userId) mySet.add(l.post_id);
          });
          setLikes(countMap);
          setLikeUsers(userMap);
          setMyLikes(mySet);
        }
        if (imgData) {
          const imgMap: Record<string, { image_url: string; caption: string | null }[]> = {};
          (imgData as any[]).forEach((row: { post_id: string; image_url: string; caption: string | null }) => {
            if (!imgMap[row.post_id]) imgMap[row.post_id] = [];
            imgMap[row.post_id].push({ image_url: row.image_url, caption: row.caption });
          });
          setPostImages(imgMap);
        }
      }
    }
  };

  const loadGroups = async () => {
    const { data: groupsData } = await supabase
      .from("event_groups")
      .select("*")
      .order("event_date", { ascending: true });
    if (groupsData) {
      // Get member counts
      const { data: members } = await supabase.from("event_group_members").select("group_id, user_id");
      const counts: Record<string, number> = {};
      const myGroupIds: string[] = [];
      members?.forEach((m: { group_id: string; user_id: string }) => {
        counts[m.group_id] = (counts[m.group_id] || 0) + 1;
        if (m.user_id === userId) myGroupIds.push(m.group_id);
      });
      setGroups(groupsData.map(g => ({ ...g, member_count: counts[g.id] || 0 })) as EventGroup[]);
      setMyGroups(myGroupIds);
    }
  };

  const resizeImage = (file: File, maxDim = 1920, maxBytes = 2 * 1024 * 1024): Promise<File> =>
    new Promise((resolve) => {
      if (file.size <= maxBytes) { resolve(file); return; }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.82
        );
      };
      img.src = url;
    });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20 MB"); return; }
    const resized = await resizeImage(file);
    if (isAdmin) {
      // Admin: multi-image mode
      if (imageFiles.length >= 10) { toast.error("Max 10 bilder per inlägg"); return; }
      setImageFiles(prev => [...prev, { file: resized, preview: URL.createObjectURL(resized), caption: "" }]);
    } else {
      // Non-admin: single image
      setImageFile(resized);
      setImagePreview(URL.createObjectURL(resized));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const submitPost = async () => {
    const hasImages = isAdmin ? imageFiles.length > 0 : !!imageFile;
    if (!caption.trim() && !hasImages) { toast.error("Skriv något eller välj en bild"); return; }
    setUploading(true);
    try {
      let imageUrl: string | null = null;

      // For non-admin single image, upload to image_url field
      if (!isAdmin && imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("social-images").upload(path, imageFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("social-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      // For admin with single image and no per-image captions, use legacy field
      if (isAdmin && imageFiles.length === 1 && !imageFiles[0].caption) {
        const f = imageFiles[0].file;
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("social-images").upload(path, f);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("social-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const resolvedVisibility = postVisibility === "group" ? "group" : postVisibility === "friends" ? "friends" : "public";

      const { data: insertedPost, error: insertError } = await supabase.from("social_posts").insert({
        user_id: userId,
        image_url: imageUrl,
        caption: caption.trim() || null,
        visibility: resolvedVisibility,
        group_id: resolvedVisibility === "group" ? postGroupId : null,
      }).select("id").single();
      if (insertError) throw insertError;
      if (!insertedPost) throw new Error("Inlägget kunde inte sparas");

      // For admin multi-image (or single with caption), upload to social_post_images
      if (isAdmin && insertedPost && (imageFiles.length > 1 || (imageFiles.length === 1 && imageFiles[0].caption))) {
        const imageRows = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const f = imageFiles[i].file;
          const ext = f.name.split(".").pop() || "jpg";
          const path = `${userId}/${Date.now()}_${i}.${ext}`;
          const { error } = await supabase.storage.from("social-images").upload(path, f);
          if (error) throw error;
          const { data: urlData } = supabase.storage.from("social-images").getPublicUrl(path);
          imageRows.push({
            post_id: insertedPost.id,
            image_url: urlData.publicUrl,
            caption: imageFiles[i].caption.trim() || null,
            sort_order: i,
          });
        }
        if (imageRows.length > 0) {
          await supabase.from("social_post_images").insert(imageRows);
        }
      }

      toast.success("Inlägg publicerat!");

      // Send push notification to friends (fire-and-forget)
      supabase.functions.invoke("notify-social-post", {
        body: { caption: caption.trim() || null, visibility: resolvedVisibility },
      }).catch(() => {});
      setShowCompose(false);
      setCaption("");
      setImageFile(null);
      setImagePreview(null);
      setImageFiles([]);
      setPostVisibility("public");
      setPostGroupId(null);
      loadFeed();
    } catch (err: any) {
      toast.error("Kunde inte publicera: " + (err.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const toggleLike = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    const isWorkoutPost = !!post?.workout_day && post.workout_week !== null;
    if (myLikes.has(postId)) {
      await Promise.all([
        supabase.from("social_post_likes").delete().eq("post_id", postId).eq("user_id", userId),
        isWorkoutPost ? supabase.from("workout_likes").delete().eq("target_user_id", post!.user_id).eq("week", post!.workout_week).eq("day", post!.workout_day).eq("user_id", userId) : Promise.resolve(),
      ]);
      setMyLikes(prev => { const s = new Set(prev); s.delete(postId); return s; });
      setLikes(prev => ({ ...prev, [postId]: (prev[postId] || 1) - 1 }));
      setLikeUsers(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(u => u !== userId) }));
    } else {
      await Promise.all([
        supabase.from("social_post_likes").insert({ post_id: postId, user_id: userId }),
        isWorkoutPost ? supabase.from("workout_likes").insert({ target_user_id: post!.user_id, week: post!.workout_week, day: post!.workout_day, user_id: userId, plan_id: null } as any) : Promise.resolve(),
      ]);
      setMyLikes(prev => new Set(prev).add(postId));
      setLikes(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
      setLikeUsers(prev => ({ ...prev, [postId]: [...(prev[postId] || []).filter(u => u !== userId), userId] }));
      const fresh = await checkInteractionAchievements(userId);
      if (fresh.length > 0) toast.success(`Achievement upplåst: ${fresh[0].title}`);
    }
    emitPostInteraction(postId);
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from("social_post_comments")
      .select("id, user_id, comment, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (data) {
      const merged = (data as any[]).map((c) => ({ id: `social:${c.id}`, user_id: c.user_id, comment: c.comment, created_at: c.created_at }));
      setComments(prev => ({ ...prev, [postId]: merged as any }));
      const missing = [...new Set(merged.map((c: any) => c.user_id).filter((id: string) => !nicknames[id]))];
      if (missing.length > 0) {
        const [{ data: nicks }, { data: profs }] = await Promise.all([
          supabase.rpc("get_suggestion_nicknames", { user_ids: missing }),
          supabase.from("profiles").select("user_id, avatar_url").in("user_id", missing),
        ]);
        if (nicks) setNicknames(prev => { const m = { ...prev }; (nicks as any[]).forEach(n => { m[n.user_id] = n.nickname; }); return m; });
        if (profs) setAvatarUrls(prev => { const m = { ...prev }; (profs as any[]).forEach(p => { m[p.user_id] = p.avatar_url; }); return m; });
      }
    }
  };

  const toggleComments = (postId: string) => {
    setOpenComments(prev => {
      const s = new Set(prev);
      if (s.has(postId)) { s.delete(postId); }
      else { s.add(postId); if (!comments[postId]) loadComments(postId); }
      return s;
    });
  };

  const submitComment = async (postId: string) => {
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;
    const post = posts.find(p => p.id === postId);
    const { data, error } = await supabase
      .from("social_post_comments")
      .insert({ post_id: postId, user_id: userId, comment: text })
      .select("id, user_id, comment, created_at")
      .single();
    if (error) { toast.error("Kunde inte kommentera"); return; }
    if (post?.workout_day && post.workout_week !== null) {
      await supabase.from("workout_comments").insert({
        target_user_id: post.user_id,
        week: post.workout_week,
        day: post.workout_day,
        plan_id: null,
        author_id: userId,
        comment: text,
      } as any);
    }
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data as any] }));
    setCommentCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    setCommentDrafts(prev => ({ ...prev, [postId]: "" }));
    emitPostInteraction(postId);
    const fresh = await checkInteractionAchievements(userId);
    if (fresh.length > 0) toast.success(`Achievement upplåst: ${fresh[0].title}`);
    // Push-notify post owner
    if (post && post.user_id !== userId) {
      supabase.functions.invoke("notify-comment", {
        body: {
          targetUserId: post.user_id,
          day: post.workout_day || "",
          week: post.workout_week ?? 0,
        },
      }).catch(() => {});
    }
  };

  const deleteComment = async (postId: string, commentId: string) => {
    const post = posts.find(p => p.id === postId);
    const comment = (comments[postId] || []).find(c => c.id === commentId);
    const { error } = isSocialInteractionId(commentId)
      ? await supabase.from("social_post_comments").delete().eq("id", stripSocialInteractionId(commentId))
      : await supabase.from("workout_comments").delete().eq("id", commentId);
    if (error) { toast.error("Kunde inte ta bort"); return; }
    if (post?.workout_day && post.workout_week !== null && comment) {
      await supabase.from("workout_comments").delete().eq("target_user_id", post.user_id).eq("week", post.workout_week).eq("day", post.workout_day).eq("author_id", comment.user_id).eq("comment", comment.comment);
    }
    setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
    setCommentCounts(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 1) - 1) }));
    emitPostInteraction(postId);
  };

  const deletePost = async (postId: string) => {
    await supabase.from("social_posts").delete().eq("id", postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast.success("Inlägg borttaget");
  };

  const togglePin = async (postId: string, currentlyPinned: boolean) => {
    await supabase.from("social_posts").update({ pinned: !currentlyPinned }).eq("id", postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, pinned: !currentlyPinned } : p));
    toast.success(currentlyPinned ? "Inlägg lossat" : "Inlägg nålat");
  };

  const joinGroup = async (groupId: string) => {
    await supabase.from("event_group_members").insert({ group_id: groupId, user_id: userId });
    setMyGroups(prev => [...prev, groupId]);
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, member_count: (g.member_count || 0) + 1 } : g));
    toast.success("Du gick med i gruppen!");
  };

  const leaveGroup = async (groupId: string) => {
    await supabase.from("event_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    setMyGroups(prev => prev.filter(id => id !== groupId));
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, member_count: Math.max(0, (g.member_count || 1) - 1) } : g));
    toast.success("Du lämnade gruppen");
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("Ta bort hela gruppen?")) return;
    await supabase.from("event_group_members").delete().eq("group_id", groupId);
    await supabase.from("social_posts").delete().eq("group_id", groupId);
    await supabase.from("event_groups").delete().eq("id", groupId);
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setMyGroups(prev => prev.filter(id => id !== groupId));
    toast.success("Grupp borttagen");
  };

  const groupsForPosting = groups.filter(g => myGroups.includes(g.id));

  return (
    <div
      className={isChatTab ? "box-border flex min-h-0 flex-col gap-4 overflow-hidden overscroll-none pt-2 pb-0 touch-none" : "py-2 space-y-4"}
      style={isChatTab ? { height: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 10.5rem)" } : undefined}
    >
      <h2 className="sr-only">Socialt – flöde, vänner, chatt och grupper</h2>
      {/* Sub-tab navigation */}
      {(() => {
        const tabs = [
          { key: "feed" as SubTab, label: "Flöde", icon: Globe },
          { key: "friends" as SubTab, label: "Vänner", icon: Users },
          { key: "chat" as SubTab, label: "Chatt", icon: MessageCircle, badge: unreadChats },
          { key: "groups" as SubTab, label: "Grupper", icon: UsersRound },
        ];
        const activeIndex = Math.max(0, tabs.findIndex(t => t.key === subTab));
        return (
          <div className="relative shrink-0 border-b border-border/60 touch-none">
            <div className="flex">
              {tabs.map(st => (
                <button
                  key={st.key}
                  onClick={() => setSubTab(st.key)}
                  data-tour={st.key === "friends" ? "social-friends" : st.key === "groups" ? "social-groups" : undefined}
                  className={`flex-1 flex items-center justify-center gap-1.5 pb-2 pt-1 text-xs font-semibold transition-colors ${
                    subTab === st.key ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <st.icon className="w-3.5 h-3.5" />
                  {st.label}
                  {st.key === "friends" && friendActivities.length > 0 && (
                    <span className="w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {friendActivities.length > 9 ? "9+" : friendActivities.length}
                    </span>
                  )}
                  {st.key === "chat" && (st.badge || 0) > 0 && (
                    <span className="w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {(st.badge || 0) > 9 ? "9+" : st.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <span
              aria-hidden
              className="absolute bottom-0 left-0 h-0.5 rounded-full bg-primary transition-transform duration-300 ease-out"
              style={{ width: `${100 / tabs.length}%`, transform: `translateX(${activeIndex * 100}%)` }}
            />
          </div>
        );
      })()}

      {/* FEED TAB */}
      {subTab === "feed" && (
        <div className="space-y-4">
          {/* Feed filter – compact segment */}
          <div className="flex items-center justify-between gap-2">
            <div className="relative inline-flex rounded-full bg-muted/40 p-1">
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-card transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${feedFilter === "all" ? 0 : 100}%)` }}
              />
              {(["all", "friends"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFeedFilter(f)}
                  className={`relative z-10 w-[72px] rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    feedFilter === f ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {f === "all" ? "Alla" : "Vänner"}
                </button>
              ))}
            </div>
            {feedLoading && posts.length > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                Uppdaterar
              </span>
            )}
          </div>

          {/* Compose – compact pill row */}
          {!showCompose && (
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                {avatarUrls[userId] ? (
                  <img src={avatarUrls[userId]!} alt="" className="h-full w-full object-cover" />
                ) : (
                  (nicknames[userId] || "?")[0]?.toUpperCase()
                )}
              </div>
              <button
                onClick={() => setShowCompose(true)}
                className="flex-1 rounded-full border border-border/60 bg-muted/40 px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/70"
              >
                Vad tränade du idag?
              </button>
              <button
                onClick={() => setShowCompose(true)}
                aria-label="Skapa inlägg med bild"
                className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center transition-colors hover:bg-primary/20"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Compose form */}
          {showCompose && (
            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">Nytt inlägg</h4>
                <button onClick={() => { setShowCompose(false); setImageFile(null); setImagePreview(null); setImageFiles([]); }}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Admin multi-image previews */}
              {isAdmin && imageFiles.length > 0 && (
                <div className="space-y-2">
                  {imageFiles.map((img, idx) => (
                    <div key={idx} className="relative bg-secondary/30 rounded-lg p-2">
                      <div className="flex gap-2">
                        <img src={img.preview} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={img.caption}
                            onChange={(e) => setImageFiles(prev => prev.map((f, i) => i === idx ? { ...f, caption: e.target.value } : f))}
                            placeholder={`Bildtext ${idx + 1} (valfritt)`}
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/30"
                          />
                          <p className="text-[10px] text-muted-foreground">Bild {idx + 1} av {imageFiles.length}</p>
                        </div>
                        <button onClick={() => { URL.revokeObjectURL(img.preview); setImageFiles(prev => prev.filter((_, i) => i !== idx)); }}
                          className="p-1 text-muted-foreground hover:text-destructive self-start">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Non-admin single image preview */}
              {!isAdmin && imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="" className="w-full rounded-lg max-h-64 object-cover" />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Caption */}
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Skriv något om ditt pass..."
                rows={6}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y outline-none focus:ring-2 focus:ring-primary/30 min-h-[120px]"
              />

              {/* Image upload */}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => cameraRef.current?.click()} variant="outline" size="sm">
                  <Camera className="w-4 h-4 mr-1.5" /> Kamera
                </Button>
                <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm">
                  <ImagePlus className="w-4 h-4 mr-1.5" /> {isAdmin && imageFiles.length > 0 ? `Bild (${imageFiles.length})` : "Bild"}
                </Button>

                {/* Visibility selector */}
                <select
                  value={postVisibility === "group" && postGroupId ? `group:${postGroupId}` : postVisibility}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.startsWith("group:")) {
                      setPostVisibility("group");
                      setPostGroupId(val.replace("group:", ""));
                    } else {
                      setPostVisibility(val);
                      setPostGroupId(null);
                    }
                  }}
                  className="flex-1 rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none"
                >
                  <option value="public">🌍 Alla</option>
                  <option value="friends">👫 Bara vänner</option>
                  {groupsForPosting.map(g => (
                    <option key={g.id} value={`group:${g.id}`}>
                      👥 {g.event_name}
                    </option>
                  ))}
                </select>
              </div>



              <Button onClick={submitPost} disabled={uploading} className="w-full">
                <Send className="w-4 h-4 mr-1.5" />
                {uploading ? "Laddar upp..." : "Publicera"}
              </Button>
            </div>
          )}

          {/* Posts feed */}
          {(() => {
            if (feedLoading && posts.length === 0) return <FeedSkeleton count={3} />;

            const filteredPosts = feedFilter === "friends"
              ? posts.filter(p => friendIds.has(p.user_id) || p.user_id === userId)
              : posts;
            
            
            if (filteredPosts.length === 0) return (
              <EmptyState
                icon={Camera}
                emoji="📸"
                title={feedFilter === "friends" ? "Inga inlägg från vänner ännu" : "Inga inlägg ännu"}
                description={feedFilter === "friends"
                  ? "Lägg till fler vänner – eller dela ditt eget pass så syns det här."
                  : "Var den första att dela ett pass med gänget!"}
                actionLabel="Dela ditt första inlägg"
                onAction={() => setShowCompose(true)}
                secondaryLabel={feedFilter === "friends" ? "Hitta vänner" : undefined}
                onSecondary={feedFilter === "friends" ? () => setSubTab("friends") : undefined}
              />
            );

            const sortedPosts = [...filteredPosts].sort((a, b) => {
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return 0;
            });

            return sortedPosts.map(post => {
            const parsed = parseWorkoutCaption(post.caption);
            const kindMeta = WORKOUT_KIND_META[parsed.kind];
            const KindIcon = kindMeta.icon;
            const isWorkoutPost = !!parsed.title;
            const likerIds = (likeUsers[post.id] || []).filter(id => id !== userId);
            const likerNames = likerIds.map(id => nicknames[id]).filter(Boolean) as string[];
            const totalLikes = likes[post.id] || 0;
            const canManage = isAdmin || post.user_id === userId;
            return (
            <div key={post.id} data-post-id={post.id} className={`relative overflow-hidden rounded-2xl border bg-card shadow-soft transition-all ${post.pinned ? "border-primary/40" : "border-border/50"} ${highlightedPostId === post.id ? "ring-2 ring-primary" : ""}`}>
              {/* Type accent line */}
              {isWorkoutPost && <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${kindMeta.accent}`} />}
              {/* Pinned indicator */}
              {post.pinned && (
                <div className="px-4 pt-3 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                  <Pin className="w-3 h-3" /> Nålat inlägg
                </div>
              )}
              {/* Post header */}
              <div className={`px-4 flex items-center justify-between ${isWorkoutPost && !post.pinned ? "pt-3.5" : "pt-3"} pb-2.5`}>
                <button
                  type="button"
                  onClick={() => {
                    if (post.user_id === userId) return;
                    setPendingFriendId(post.user_id);
                    setSubTab("friends");
                  }}
                  className="flex min-w-0 items-center gap-2.5 text-left transition-opacity hover:opacity-80"
                  aria-label={`Visa ${nicknames[post.user_id] || "användarens"} profil`}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/50 flex items-center justify-center text-sm font-bold">
                    {avatarUrls[post.user_id] ? (
                      <img src={avatarUrls[post.user_id]!} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (nicknames[post.user_id] || "?")[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-bold">{nicknames[post.user_id] || "Anonym"}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {(() => {
                        const workoutDate = resolveWorkoutPostDate(post, planStartDates[post.user_id]);
                        if (workoutDate) return format(workoutDate, "d MMM", { locale: sv });
                        return format(new Date(post.created_at), "d MMM HH:mm", { locale: sv });
                      })()}
                      {post.visibility === "group" && " · 👥 Grupp"}
                    </span>
                  </div>
                </button>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Fler alternativ" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => togglePin(post.id, post.pinned)}>
                          <Pin className="mr-2 h-4 w-4" /> {post.pinned ? "Lossa" : "Nåla fast"}
                        </DropdownMenuItem>
                      )}
                      {(post.user_id === userId || isAdmin) && (
                        <DropdownMenuItem onClick={() => deletePost(post.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Ta bort inlägg
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Media – full width above the text */}
              {(() => {
                const imgs = postImages[post.id];
                if (imgs && imgs.length > 0) {
                  return (
                    <div className="px-3 pb-3 [&_img]:rounded-2xl">
                      <div className="overflow-hidden rounded-2xl">
                        <ImageCarousel images={imgs} />
                      </div>
                    </div>
                  );
                }
                if (post.image_url) {
                  return (
                    <div className="px-3 pb-3">
                      <img src={post.image_url} alt="" className="max-h-96 w-full rounded-2xl object-cover" loading="lazy" />
                    </div>
                  );
                }
                return null;
              })()}

              {/* Title + stat chips */}
              {(parsed.title || parsed.chips.length > 0) && (
                <div className="px-4 pb-2 space-y-2">
                  {parsed.title && (
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${kindMeta.badge}`}>
                        <KindIcon className="h-4 w-4" />
                      </span>
                      <h3 className="font-sans text-[15px] font-bold leading-snug tracking-normal">{parsed.title}</h3>
                    </div>
                  )}
                  {parsed.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {parsed.chips.map((chip, i) => {
                        const ChipIcon = chip.icon;
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${CHIP_TONE_CLASS[chip.tone]}`}
                          >
                            <ChipIcon className="h-3.5 w-3.5" />
                            {chip.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Träningslogg */}
              {parsed.exercises.length > 0 && (
                <div className="px-4 pb-2">
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Träningslogg</p>
                    <ul className="space-y-2">
                      {parsed.exercises.map((ex, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                          <Dumbbell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold">{ex.name}</span>
                            {ex.detail && <span className="text-muted-foreground"> · {ex.detail}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Free text */}
              {parsed.text && (
                <div className="px-4 pb-2">
                  <p className="whitespace-pre-line text-sm leading-snug">{parsed.text}</p>
                </div>
              )}

              {/* Who reacted */}
              {totalLikes > 0 && (
                <div className="flex items-center gap-2 px-4 pb-1.5">
                  <div className="flex -space-x-2">
                    {(myLikes.has(post.id) ? [userId, ...likerIds] : likerIds).slice(0, 3).map(id => (
                      <span key={id} className="h-5 w-5 overflow-hidden rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[9px] font-bold">
                        {avatarUrls[id] ? (
                          <img src={avatarUrls[id]!} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (nicknames[id] || "?")[0]?.toUpperCase()
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {(() => {
                      const names = myLikes.has(post.id) ? ["Du", ...likerNames] : likerNames;
                      if (names.length === 0) return `${totalLikes} eldade passet`;
                      const shown = names.slice(0, 2).join(", ");
                      const rest = totalLikes - Math.min(2, names.length);
                      return `${shown}${rest > 0 ? ` +${rest}` : ""} eldade detta`;
                    })()}
                  </p>
                </div>
              )}

              {/* Reactions */}
              <div className="flex items-center gap-2 border-t border-border/40 px-3 py-2.5">
                <FlameReaction
                  fullWidth
                  active={myLikes.has(post.id)}
                  count={likes[post.id] || 0}
                  onToggle={() => toggleLike(post.id)}
                />
                <button
                  onClick={() => toggleComments(post.id)}
                  aria-pressed={openComments.has(post.id)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
                    openComments.has(post.id)
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/60 bg-secondary/50 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="tabular-nums">{commentCounts[post.id] || 0}</span>
                </button>
                {post.user_id !== userId && (
                  <WorkoutCheerButton
                    fullWidth
                    toUserId={post.user_id}
                    fromUserId={userId}
                    week={post.workout_week}
                    day={post.workout_day}
                  />
                )}
              </div>


              {/* Comments */}
              {openComments.has(post.id) && (
                <div className="px-3 py-2.5 border-t border-border/40 space-y-2 bg-secondary/20">
                  {(comments[post.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center">Inga kommentarer än. Var först!</p>
                  )}
                  {(comments[post.id] || []).map(c => {
                    const rawCommentId = c.id.startsWith("social:") ? c.id.slice(7) : c.id;
                    const isHighlighted = highlightedCommentId === rawCommentId;
                    return (
                    <div key={c.id} data-comment-id={rawCommentId} className={`flex items-start gap-2 group transition-all rounded-lg ${isHighlighted ? "ring-2 ring-primary bg-primary/10 p-1.5 -m-1.5" : ""}`}>
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                        {avatarUrls[c.user_id] ? (
                          <img src={avatarUrls[c.user_id]!} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (nicknames[c.user_id] || "?")[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-card rounded-2xl px-3 py-1.5">
                          <p className="text-xs font-semibold">{nicknames[c.user_id] || "Anonym"}</p>
                          <p className="text-sm whitespace-pre-line break-words">{c.comment}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 px-2">
                          {format(new Date(c.created_at), "d MMM HH:mm", { locale: sv })}
                        </p>
                      </div>
                      {(c.user_id === userId || isAdmin) && (
                        <button
                          onClick={() => deleteComment(post.id, c.id)}
                          className="p-1 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                          title="Ta bort"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    );
                  })}
                  <div className="flex items-end gap-2 pt-1">
                    <textarea
                      value={commentDrafts[post.id] || ""}
                      onChange={e => setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder="Skriv en kommentar..."
                      maxLength={500}
                      rows={1}
                      className="flex-1 bg-card text-foreground text-sm px-3 py-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground resize-none"
                    />
                    <button
                      onClick={() => submitComment(post.id)}
                      disabled={!(commentDrafts[post.id] || "").trim()}
                      className="h-9 w-9 flex items-center justify-center bg-primary text-primary-foreground rounded-full disabled:opacity-40 hover:opacity-90 flex-shrink-0"
                      title="Skicka"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
            });
          })()}
        </div>
      )}

      {/* FRIENDS TAB */}
      {subTab === "friends" && (
        <Suspense fallback={<div className="py-4 text-center text-xs text-muted-foreground">Laddar...</div>}>
          <FriendsView
            userId={userId}
            isAdmin={isAdmin}
            friendActivities={friendActivities}
            onClearActivitiesForFriend={onClearActivitiesForFriend}
            initialFriendId={pendingFriendId || initialFriendId || undefined}
          />
        </Suspense>
      )}

      {/* CHAT TAB */}
      {subTab === "chat" && (
        <div className="min-h-0 flex-1 flex flex-col overflow-hidden touch-none">
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<div className="py-4 text-center text-xs text-muted-foreground">Laddar...</div>}>
              <ChatView userId={userId} isAdmin={isAdmin} isPremium={isHonorary} />
            </Suspense>
          </div>
        </div>
      )}

      {/* GROUPS TAB */}
      {subTab === "groups" && (
        openGroupId ? (
          <Suspense fallback={<div className="py-4 text-center text-xs text-muted-foreground">Laddar...</div>}>
            <EventGroupPage
              groupId={openGroupId}
              userId={userId}
              isAdmin={isAdmin}
              onBack={() => setOpenGroupId(null)}
              onDeleted={() => { loadGroups(); setOpenGroupId(null); }}
            />
          </Suspense>
        ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Gå med i grupper för event du ska delta i. Dela bilder och peppa varandra!
          </p>

          {/* My groups */}
          {groups.filter(g => myGroups.includes(g.id)).length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-muted-foreground">Mina grupper</h3>
              <div className="rounded-2xl bg-card shadow-soft overflow-hidden divide-y divide-border/50">
                {groups.filter(g => myGroups.includes(g.id)).map(g => (
                  <div key={g.id} className="p-3.5 flex items-center gap-3 transition-colors hover:bg-muted/40">
                    <button onClick={() => setOpenGroupId(g.id)} className="flex flex-1 items-center gap-3 text-left min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                        <UsersRound className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{g.event_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {g.event_date && format(new Date(g.event_date), "d MMM yyyy", { locale: sv })}
                          {" • "}{g.member_count || 0} {(g.member_count || 0) === 1 ? "medlem" : "medlemmar"}
                        </p>
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button aria-label="Fler val" className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => leaveGroup(g.id)}>Lämna grupp</DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteGroup(g.id)}>
                            Radera grupp
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All groups */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-muted-foreground">Alla grupper</h3>
            {groups.filter(g => !myGroups.includes(g.id)).length === 0 ? (
              <div className="rounded-2xl bg-card shadow-soft px-4 py-6 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <UsersRound className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Inga fler grupper tillgängliga. Lägg till ett event i verktygsfliken så skapas en grupp automatiskt!
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card shadow-soft overflow-hidden divide-y divide-border/50">
                {groups.filter(g => !myGroups.includes(g.id)).map(g => (
                  <div key={g.id} className="p-3.5 flex items-center gap-3 transition-colors hover:bg-muted/40">
                    <button onClick={() => setOpenGroupId(g.id)} className="flex flex-1 items-center gap-3 text-left min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
                        <UsersRound className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{g.event_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {g.event_date && format(new Date(g.event_date), "d MMM yyyy", { locale: sv })}
                          {" • "}{g.member_count || 0} {(g.member_count || 0) === 1 ? "medlem" : "medlemmar"}
                        </p>
                      </div>
                    </button>
                    <Button onClick={(e) => { e.stopPropagation(); joinGroup(g.id); }} size="sm" className="rounded-full text-xs">
                      Gå med
                    </Button>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button aria-label="Fler val" className="p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteGroup(g.id)}>
                            Radera grupp
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        )
      )}
    </div>
  );
};

export default SocialView;
