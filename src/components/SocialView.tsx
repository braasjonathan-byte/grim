import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Heart, ImagePlus, Send, Trash2, MessageCircle, Globe, UsersRound, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import HonoraryBadge from "./HonoraryBadge";
import { lazy, Suspense } from "react";

const FriendsView = lazy(() => import("./FriendsView"));
const ChatView = lazy(() => import("./ChatView"));

interface SocialViewProps {
  userId: string;
  isAdmin: boolean;
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

const SocialView = ({ userId, isAdmin, friendActivities, unreadChats = 0, onClearActivitiesForFriend, initialFriendId }: SocialViewProps) => {
  const [subTab, setSubTab] = useState<SubTab>(initialFriendId ? "friends" : "feed");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [showCompose, setShowCompose] = useState(false);
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [postVisibility, setPostVisibility] = useState<string>("public");
  const [postGroupId, setPostGroupId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "friends">("all");
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadFeed(); loadGroups(); loadFriendIds(); }, [userId]);

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
        const { data: nicks } = await supabase.rpc("get_suggestion_nicknames", { user_ids: userIds });
        if (nicks) {
          const map: Record<string, string> = {};
          nicks.forEach((n: { user_id: string; nickname: string }) => { map[n.user_id] = n.nickname; });
          setNicknames(map);
        }
      }
      // Load likes
      const postIds = postsData.map(p => p.id);
      if (postIds.length > 0) {
        const { data: likesData } = await supabase
          .from("social_post_likes")
          .select("post_id, user_id")
          .in("post_id", postIds);
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
    setImageFile(resized);
    setImagePreview(URL.createObjectURL(resized));
  };

  const submitPost = async () => {
    if (!caption.trim() && !imageFile) { toast.error("Skriv något eller välj en bild"); return; }
    setUploading(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("social-images").upload(path, imageFile);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("social-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      await supabase.from("social_posts").insert({
        user_id: userId,
        image_url: imageUrl,
        caption: caption.trim() || null,
        visibility: postVisibility === "group" ? "group" : "public",
        group_id: postVisibility === "group" ? postGroupId : null,
      });

      toast.success("Inlägg publicerat!");

      // Send push notification to friends (fire-and-forget)
      supabase.functions.invoke("notify-social-post", {
        body: { caption: caption.trim() || null },
      }).catch(() => {});
      setShowCompose(false);
      setCaption("");
      setImageFile(null);
      setImagePreview(null);
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

  const deletePost = async (postId: string) => {
    await supabase.from("social_posts").delete().eq("id", postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast.success("Inlägg borttaget");
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

  const groupsForPosting = groups.filter(g => myGroups.includes(g.id));

  return (
    <div className="py-2 space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        {([
          { key: "feed" as SubTab, label: "Flöde", icon: Globe },
          { key: "friends" as SubTab, label: "Vänner", icon: Users },
          { key: "chat" as SubTab, label: "Chatt", icon: MessageCircle, badge: unreadChats },
          { key: "groups" as SubTab, label: "Grupper", icon: UsersRound },
        ]).map(st => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
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
                <button onClick={() => { setShowCompose(false); setImageFile(null); setImagePreview(null); }}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Image preview */}
              {imagePreview && (
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
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30"
              />

              {/* Image upload */}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <div className="flex gap-2">
                <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm">
                  <ImagePlus className="w-4 h-4 mr-1.5" /> Bild
                </Button>

                {/* Visibility selector */}
                <select
                  value={postVisibility}
                  onChange={e => { setPostVisibility(e.target.value); if (e.target.value !== "group") setPostGroupId(null); }}
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

              {/* If group visibility, show group picker */}
              {postVisibility === "group" && groupsForPosting.length > 0 && !postGroupId && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Välj grupp:</p>
                  {groupsForPosting.map(g => (
                    <button key={g.id} onClick={() => setPostGroupId(g.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        postGroupId === g.id ? "bg-primary/20 text-primary" : "bg-muted/50 hover:bg-muted"
                      }`}>
                      {g.event_name}
                    </button>
                  ))}
                </div>
              )}

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

            return filteredPosts.map(post => (
            <div key={post.id} className="border border-border rounded-xl overflow-hidden bg-card">
              {/* Post header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {(nicknames[post.user_id] || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-semibold">{nicknames[post.user_id] || "Anonym"}</span>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(post.created_at), "d MMM HH:mm", { locale: sv })}
                      {post.visibility === "group" && " • 👥 Grupp"}
                    </p>
                  </div>
                </div>
                {post.user_id === userId && (
                  <button onClick={() => deletePost(post.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Image */}
              {post.image_url && (
                <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" loading="lazy" />
              )}

              {/* Caption */}
              {post.caption && (
                <p className="px-4 py-2 text-sm">{post.caption}</p>
              )}

              {/* Like button */}
              <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4">
                <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 text-sm">
                  <Heart className={`w-4 h-4 transition-colors ${myLikes.has(post.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">{likes[post.id] || 0}</span>
                </button>
              </div>
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
            initialFriendId={initialFriendId || undefined}
          />
        </Suspense>
      )}

      {/* CHAT TAB */}
      {subTab === "chat" && (
        <Suspense fallback={<div className="py-4 text-center text-xs text-muted-foreground">Laddar...</div>}>
          <ChatView userId={userId} />
        </Suspense>
      )}

      {/* GROUPS TAB */}
      {subTab === "groups" && (
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
                  <div>
                    <p className="text-sm font-bold">{g.event_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {g.event_date && format(new Date(g.event_date), "d MMM yyyy", { locale: sv })}
                      {" • "}{g.member_count || 0} {(g.member_count || 0) === 1 ? "medlem" : "medlemmar"}
                    </p>
                  </div>
                  <Button onClick={() => leaveGroup(g.id)} variant="ghost" size="sm" className="text-xs text-destructive">
                    Lämna
                  </Button>
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
                <div>
                  <p className="text-sm font-bold">{g.event_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.event_date && format(new Date(g.event_date), "d MMM yyyy", { locale: sv })}
                    {" • "}{g.member_count || 0} {(g.member_count || 0) === 1 ? "medlem" : "medlemmar"}
                  </p>
                </div>
                <Button onClick={() => joinGroup(g.id)} size="sm" className="text-xs">
                  Gå med
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialView;
