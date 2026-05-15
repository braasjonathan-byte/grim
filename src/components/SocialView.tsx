import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Heart, ImagePlus, Send, Trash2, MessageCircle, Globe, UsersRound, X, Camera, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import HonoraryBadge from "./HonoraryBadge";
import ImageCarousel from "./ImageCarousel";
import { lazy, Suspense } from "react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

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
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
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
  const [comments, setComments] = useState<Record<string, { id: string; user_id: string; comment: string; created_at: string }[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const isChatTab = subTab === "chat";

  useLockBodyScroll(isChatTab);

  useEffect(() => { loadFeed(); loadGroups(); loadFriendIds(); }, [userId]);

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
          supabase.from("profiles").select("user_id, avatar_url").in("user_id", userIds),
        ]);
        if (nicks) {
          const map: Record<string, string> = {};
          nicks.forEach((n: { user_id: string; nickname: string }) => { map[n.user_id] = n.nickname; });
          setNicknames(map);
        }
        if (profilesData) {
          const aMap: Record<string, string | null> = {};
          profilesData.forEach((p: { user_id: string; avatar_url: string | null }) => { aMap[p.user_id] = p.avatar_url; });
          setAvatarUrls(aMap);
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
          const mySet = new Set<string>();
          likesData.forEach((l: { post_id: string; user_id: string }) => {
            countMap[l.post_id] = (countMap[l.post_id] || 0) + 1;
            if (l.user_id === userId) mySet.add(l.post_id);
          });
          setLikes(countMap);
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
    if (myLikes.has(postId)) {
      await supabase.from("social_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
      setMyLikes(prev => { const s = new Set(prev); s.delete(postId); return s; });
      setLikes(prev => ({ ...prev, [postId]: (prev[postId] || 1) - 1 }));
    } else {
      await supabase.from("social_post_likes").insert({ post_id: postId, user_id: userId });
      setMyLikes(prev => new Set(prev).add(postId));
      setLikes(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    }
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from("social_post_comments")
      .select("id, user_id, comment, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (data) {
      setComments(prev => ({ ...prev, [postId]: data as any }));
      // Load nicknames/avatars for any new commenters
      const missing = [...new Set(data.map((c: any) => c.user_id).filter((id: string) => !nicknames[id]))];
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
    const { data, error } = await supabase
      .from("social_post_comments")
      .insert({ post_id: postId, user_id: userId, comment: text })
      .select("id, user_id, comment, created_at")
      .single();
    if (error) { toast.error("Kunde inte kommentera"); return; }
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data as any] }));
    setCommentCounts(prev => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    setCommentDrafts(prev => ({ ...prev, [postId]: "" }));
    // Push-notify post owner
    const post = posts.find(p => p.id === postId);
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
    const { error } = await supabase.from("social_post_comments").delete().eq("id", commentId);
    if (error) { toast.error("Kunde inte ta bort"); return; }
    setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
    setCommentCounts(prev => ({ ...prev, [postId]: Math.max(0, (prev[postId] || 1) - 1) }));
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
      <div className="flex shrink-0 gap-1 bg-muted/50 rounded-lg p-1 touch-none">
        {([
          { key: "feed" as SubTab, label: "Flöde", icon: Globe },
          { key: "friends" as SubTab, label: "Vänner", icon: Users },
          { key: "chat" as SubTab, label: "Chatt", icon: MessageCircle, badge: unreadChats },
          { key: "groups" as SubTab, label: "Grupper", icon: UsersRound },
        ]).map(st => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            data-tour={st.key === "friends" ? "social-friends" : st.key === "groups" ? "social-groups" : undefined}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
              subTab === st.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
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

      {/* FEED TAB */}
      {subTab === "feed" && (
        <div className="space-y-4">
          {/* Feed filter toggle */}
          <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
            <button
              onClick={() => setFeedFilter("all")}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                feedFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Alla
            </button>
            <button
              onClick={() => setFeedFilter("friends")}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                feedFilter === "friends" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Vänner
            </button>
          </div>
          {/* Compose button */}
          {!showCompose && (
            <Button onClick={() => setShowCompose(true)} className="w-full" variant="outline">
              <Camera className="w-4 h-4 mr-2" /> Skapa inlägg
            </Button>
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
              <div className="flex gap-2">
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
            const filteredPosts = feedFilter === "friends"
              ? posts.filter(p => friendIds.has(p.user_id) || p.user_id === userId)
              : posts;
            
            if (filteredPosts.length === 0) return (
              <div className="text-center py-8">
                <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {feedFilter === "friends" ? "Inga inlägg från vänner ännu." : "Inga inlägg ännu. Var den första!"}
                </p>
              </div>
            );

            const sortedPosts = [...filteredPosts].sort((a, b) => {
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return 0;
            });

            return sortedPosts.map(post => (
            <div key={post.id} className={`border rounded-xl overflow-hidden bg-card ${post.pinned ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
              {/* Pinned indicator */}
              {post.pinned && (
                <div className="px-4 py-1.5 bg-primary/10 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                  <Pin className="w-3 h-3" /> Nålat inlägg
                </div>
              )}
              {/* Post header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (post.user_id === userId) return;
                      setPendingFriendId(post.user_id);
                      setSubTab("friends");
                    }}
                    className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                    aria-label={`Visa ${nicknames[post.user_id] || "användarens"} profil`}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold overflow-hidden">
                      {avatarUrls[post.user_id] ? (
                        <img src={avatarUrls[post.user_id]!} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (nicknames[post.user_id] || "?")[0]?.toUpperCase()
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-semibold">{nicknames[post.user_id] || "Anonym"}</span>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(post.created_at), "d MMM HH:mm", { locale: sv })}
                        {post.visibility === "group" && " • 👥 Grupp"}
                      </p>
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <button onClick={() => togglePin(post.id, post.pinned)} className={`p-1 transition-colors ${post.pinned ? "text-primary" : "text-muted-foreground hover:text-primary"}`} title={post.pinned ? "Lossa" : "Nåla fast"}>
                      <Pin className="w-4 h-4" />
                    </button>
                  )}
                  {(post.user_id === userId || isAdmin) && (
                    <button onClick={() => deletePost(post.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Images - carousel for multi-image, fallback to legacy image_url */}
              {(() => {
                const imgs = postImages[post.id];
                if (imgs && imgs.length > 0) {
                  return <ImageCarousel images={imgs} />;
                }
                if (post.image_url) {
                  return <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" loading="lazy" />;
                }
                return null;
              })()}

              {/* Caption */}
              {post.caption && (
                <p className="px-4 py-2 text-sm whitespace-pre-line">{post.caption}</p>
              )}

              {/* Like + comment buttons */}
              <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4">
                <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 text-sm">
                  <Heart className={`w-4 h-4 transition-colors ${myLikes.has(post.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">{likes[post.id] || 0}</span>
                </button>
                <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1.5 text-sm">
                  <MessageCircle className={`w-4 h-4 transition-colors ${openComments.has(post.id) ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">{commentCounts[post.id] || 0}</span>
                </button>
              </div>

              {/* Comments */}
              {openComments.has(post.id) && (
                <div className="px-4 py-3 border-t border-border/50 space-y-3 bg-secondary/20">
                  {(comments[post.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center">Inga kommentarer än. Var först!</p>
                  )}
                  {(comments[post.id] || []).map(c => (
                    <div key={c.id} className="flex items-start gap-2 group">
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
                  ))}
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
          ));
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
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mina grupper</h4>
              {groups.filter(g => myGroups.includes(g.id)).map(g => (
                <div key={g.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                  <button onClick={() => setOpenGroupId(g.id)} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-bold truncate">{g.event_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {g.event_date && format(new Date(g.event_date), "d MMM yyyy", { locale: sv })}
                      {" • "}{g.member_count || 0} {(g.member_count || 0) === 1 ? "medlem" : "medlemmar"}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <Button onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }} variant="ghost" size="sm" className="text-destructive hover:text-destructive px-2">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button onClick={(e) => { e.stopPropagation(); leaveGroup(g.id); }} variant="ghost" size="sm" className="text-xs text-destructive">
                      Lämna
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All groups */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Alla grupper</h4>
            {groups.filter(g => !myGroups.includes(g.id)).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Inga fler grupper tillgängliga. Lägg till ett event i verktygsfliken så skapas en grupp automatiskt!
              </p>
            )}
            {groups.filter(g => !myGroups.includes(g.id)).map(g => (
              <div key={g.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <button onClick={() => setOpenGroupId(g.id)} className="flex-1 text-left min-w-0">
                  <p className="text-sm font-bold truncate">{g.event_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.event_date && format(new Date(g.event_date), "d MMM yyyy", { locale: sv })}
                    {" • "}{g.member_count || 0} {(g.member_count || 0) === 1 ? "medlem" : "medlemmar"}
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <Button onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }} variant="ghost" size="sm" className="text-destructive hover:text-destructive px-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button onClick={(e) => { e.stopPropagation(); joinGroup(g.id); }} size="sm" className="text-xs">
                    Gå med
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        )
      )}
    </div>
  );
};

export default SocialView;
