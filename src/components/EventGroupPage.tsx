import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, Trash2, Calendar, ImagePlus, Send, Heart, X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import HonoraryBadge from "./HonoraryBadge";
import FriendProfileView from "./FriendProfileView";

interface EventGroupPageProps {
  groupId: string;
  userId: string;
  isAdmin: boolean;
  onBack: () => void;
  onDeleted?: () => void;
}

interface GroupMember {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_honorary: boolean;
  joined_at: string;
}

interface GroupInfo {
  id: string;
  event_name: string;
  event_date: string | null;
  event_end_date: string | null;
  event_type: string;
}

interface GroupPost {
  id: string;
  user_id: string;
  image_url: string | null;
  caption: string | null;
  created_at: string;
  pinned: boolean;
}

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

// Render caption text with clickable links
const RenderCaption = ({ text }: { text: string }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <p className="px-4 py-2 text-sm whitespace-pre-line">
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
};

const EventGroupPage = ({ groupId, userId, isAdmin, onBack, onDeleted }: EventGroupPageProps) => {
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProfile, setViewingProfile] = useState<{ id: string; nickname: string } | null>(null);

  // Feed state
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());

  // Compose state
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"feed" | "members">("feed");

  useEffect(() => {
    loadGroup();
    loadPosts();
  }, [groupId]);

  const loadGroup = async () => {
    setLoading(true);
    const [{ data: groupData }, { data: memberRows }] = await Promise.all([
      supabase.from("event_groups").select("id, event_name, event_date, event_end_date, event_type").eq("id", groupId).single(),
      supabase.from("event_group_members").select("user_id, joined_at").eq("group_id", groupId),
    ]);

    if (groupData) setGroup(groupData as GroupInfo);

    if (memberRows && memberRows.length > 0) {
      const userIds = memberRows.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, avatar_url, is_honorary")
        .in("user_id", userIds);

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });

      setMembers(
        memberRows.map((m: any) => ({
          user_id: m.user_id,
          nickname: profileMap[m.user_id]?.nickname || "Okänd",
          avatar_url: profileMap[m.user_id]?.avatar_url || null,
          is_honorary: profileMap[m.user_id]?.is_honorary || false,
          joined_at: m.joined_at,
        }))
      );
    }
    setLoading(false);
  };

  const loadPosts = async () => {
    const { data: postsData } = await supabase
      .from("social_posts")
      .select("id, user_id, image_url, caption, created_at, pinned")
      .eq("group_id", groupId)
      .eq("visibility", "group")
      .order("created_at", { ascending: false })
      .limit(50);

    if (postsData) {
      setPosts(postsData as GroupPost[]);
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
        visibility: "group",
        group_id: groupId,
      });

      toast.success("Inlägg publicerat!");
      setShowCompose(false);
      setCaption("");
      setImageFile(null);
      setImagePreview(null);
      loadPosts();
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

  const deleteGroup = async () => {
    if (!confirm("Ta bort hela gruppen och alla medlemskap?")) return;
    await supabase.from("event_group_members").delete().eq("group_id", groupId);
    await supabase.from("social_posts").delete().eq("group_id", groupId);
    await supabase.from("event_groups").delete().eq("id", groupId);
    toast.success("Grupp borttagen");
    onDeleted?.();
    onBack();
  };

  if (viewingProfile) {
    return (
      <FriendProfileView
        friendUserId={viewingProfile.id}
        nickname={viewingProfile.nickname}
        onClose={() => setViewingProfile(null)}
      />
    );
  }

  if (loading) {
    return <div className="py-8 text-center text-xs text-muted-foreground">Laddar grupp...</div>;
  }

  if (!group) {
    return (
      <div className="py-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">Gruppen hittades inte.</p>
        <Button onClick={onBack} variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Tillbaka</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold truncate">{group.event_name}</h3>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {group.event_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(group.event_date), "d MMM yyyy", { locale: sv })}
                {group.event_end_date && ` – ${format(new Date(group.event_end_date), "d MMM yyyy", { locale: sv })}`}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {members.length} {members.length === 1 ? "medlem" : "medlemmar"}
            </span>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={deleteGroup} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("feed")}
          className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${activeTab === "feed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          Flöde
        </button>
        <button
          onClick={() => setActiveTab("members")}
          className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${activeTab === "members" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          Medlemmar ({members.length})
        </button>
      </div>

      {/* FEED TAB */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          {/* Compose button */}
          {!showCompose ? (
            <button
              onClick={() => setShowCompose(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {avatarUrls[userId] ? (
                  <img src={avatarUrls[userId]!} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold">{(nicknames[userId] || "?")[0]?.toUpperCase()}</span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">Skriv något till gruppen...</span>
            </button>
          ) : (
            <div className="border rounded-xl p-4 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Nytt inlägg</span>
                <button onClick={() => { setShowCompose(false); setCaption(""); setImageFile(null); setImagePreview(null); }}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Skriv något... klistra in länkar direkt i texten"
                className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none min-h-[80px]"
                rows={3}
              />
              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-lg" />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
                  >
                    <ImagePlus className="w-4 h-4" /> Bild
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                </div>
                <Button
                  onClick={submitPost}
                  disabled={uploading || (!caption.trim() && !imageFile)}
                  size="sm"
                  className="gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {uploading ? "Publicerar..." : "Publicera"}
                </Button>
              </div>
            </div>
          )}

          {/* Posts */}
          {posts.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">Inga inlägg i gruppen ännu. Var först att posta!</p>
          )}
          {posts.map(post => (
            <div key={post.id} className="border rounded-xl overflow-hidden bg-card border-border">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
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
                    </p>
                  </div>
                </div>
                {(post.user_id === userId || isAdmin) && (
                  <button onClick={() => deletePost(post.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {post.image_url && (
                <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" loading="lazy" />
              )}

              {post.caption && <RenderCaption text={post.caption} />}

              <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4">
                <button onClick={() => toggleLike(post.id)} className="flex items-center gap-1.5 text-sm">
                  <Heart className={`w-4 h-4 transition-colors ${myLikes.has(post.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">{likes[post.id] || 0}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MEMBERS TAB */}
      {activeTab === "members" && (
        <div className="space-y-1">
          {members.map(m => (
            <button
              key={m.user_id}
              onClick={() => m.user_id !== userId && setViewingProfile({ id: m.user_id, nickname: m.nickname })}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                  {m.nickname[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold truncate">{m.nickname}</span>
                  {m.is_honorary && <HonoraryBadge />}
                  {m.user_id === userId && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">du</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Gick med {format(new Date(m.joined_at), "d MMM yyyy", { locale: sv })}
                </p>
              </div>
            </button>
          ))}
          {members.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Inga medlemmar ännu.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default EventGroupPage;