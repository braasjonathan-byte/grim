import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import FlameReaction from "./FlameReaction";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import { checkInteractionAchievements } from "@/lib/achievements";
import { emitPostInteraction, onPostInteraction } from "@/lib/postInteractionBus";
import { isSocialInteractionId, mergeWorkoutComments, mergeWorkoutLikes, stripSocialInteractionId } from "@/lib/workoutSocialSync";

interface WorkoutPostThreadProps {
  userId: string; // owner of the workout (post owner)
  viewerId: string; // current logged-in user
  week: number;
  day: string;
}

interface Comment {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

const WorkoutPostThread = ({ userId, viewerId, week, day }: WorkoutPostThreadProps) => {
  const [postId, setPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [iLiked, setILiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { nickname: string; avatar_url: string | null }>>({});
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: post } = await supabase
        .from("social_posts")
        .select("id")
        .eq("user_id", userId)
        .eq("workout_week", week)
        .eq("workout_day", day)
        .maybeSingle();
      if (cancelled) return;
      const pid = post?.id || null;
      setPostId(pid);
      if (pid) {
        await loadInteractions(pid);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, week, day]);

  // Live-sync comments and likes from other surfaces (e.g. social feed)
  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`post-thread-${postId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_post_comments", filter: `post_id=eq.${postId}` },
        () => { loadInteractions(postId); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_post_likes", filter: `post_id=eq.${postId}` },
        () => { loadInteractions(postId); }
      )
      .subscribe();
    // Backup: in-app event bus (fires immediately, no realtime needed)
    const off = onPostInteraction((pid) => {
      if (pid === postId) loadInteractions(postId);
    });
    return () => { supabase.removeChannel(channel); off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const loadInteractions = async (pid: string) => {
    // Only load interactions tied directly to this social_post via post_id.
    // Legacy workout_comments/workout_likes are keyed on (user_id, week, day)
    // which collides across plans — a Feb comment on "Vecka 1 Tis" would bleed
    // onto a new plan's "Vecka 1 Tis" post. New comments are dual-written, so
    // social_post_* is the source of truth going forward.
    const [{ data: likes }, { data: cmts }] = await Promise.all([
      supabase.from("social_post_likes").select("id, user_id").eq("post_id", pid),
      supabase.from("social_post_comments").select("id, user_id, comment, created_at").eq("post_id", pid).order("created_at", { ascending: true }),
    ]);
    const likeRows = (likes || []) as any[];
    const commentRows = (cmts || []) as any[];
    setLikeCount(likeRows.length);
    setILiked(likeRows.some((l) => l.user_id === viewerId));
    setComments(commentRows.map((c) => ({ id: `social:${c.id}`, user_id: c.user_id, comment: c.comment, created_at: c.created_at })));
    const ids = [...new Set([...likeRows.map((l) => l.user_id), ...commentRows.map((c) => c.user_id)])];
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nickname, avatar_url").in("user_id", ids);
      const map: Record<string, { nickname: string; avatar_url: string | null }> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = { nickname: p.nickname, avatar_url: p.avatar_url }; });
      setProfiles(map);
    }
  };

  const toggleLike = async () => {
    if (!postId) return;
    if (iLiked) {
      await Promise.all([
        supabase.from("social_post_likes").delete().eq("post_id", postId).eq("user_id", viewerId),
        supabase.from("workout_likes").delete().eq("target_user_id", userId).eq("week", week).eq("day", day).eq("user_id", viewerId).is("plan_id", null),
      ]);
      setILiked(false);
      setLikeCount((n) => Math.max(0, n - 1));
    } else {
      await Promise.all([
        supabase.from("social_post_likes").insert({ post_id: postId, user_id: viewerId }),
        supabase.from("workout_likes").insert({ target_user_id: userId, week, day, user_id: viewerId, plan_id: null } as any),
      ]);
      setILiked(true);
      setLikeCount((n) => n + 1);
      const fresh = await checkInteractionAchievements(viewerId);
      if (fresh.length > 0) toast.success(`Achievement upplåst: ${fresh[0].title}`);
    }
    emitPostInteraction(postId);
  };

  const submit = async () => {
    if (!postId) return;
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    const { data, error } = await supabase
      .from("social_post_comments")
      .insert({ post_id: postId, user_id: viewerId, comment: text })
      .select("id, user_id, comment, created_at")
      .single();
    setPosting(false);
    if (error) { toast.error("Kunde inte kommentera"); return; }
    await supabase.from("workout_comments").insert({
      target_user_id: userId,
      week,
      day,
      author_id: viewerId,
      comment: text,
    } as any);
    setComments((prev) => [...prev, data as Comment]);
    setDraft("");
    emitPostInteraction(postId);
    const fresh = await checkInteractionAchievements(viewerId);
    if (fresh.length > 0) toast.success(`Achievement upplåst: ${fresh[0].title}`);
    if (!profiles[viewerId]) {
      const { data: p } = await supabase.from("profiles").select("user_id, nickname, avatar_url").eq("user_id", viewerId).maybeSingle();
      if (p) setProfiles((prev) => ({ ...prev, [viewerId]: { nickname: (p as any).nickname, avatar_url: (p as any).avatar_url } }));
    }
    // Push-notify the workout owner (post author)
    if (userId && userId !== viewerId) {
      supabase.functions.invoke("notify-comment", {
        body: { targetUserId: userId, day, week },
      }).catch(() => {});
    }
  };

  const removeComment = async (comment: Comment) => {
    if (comment.user_id !== viewerId && userId !== viewerId) return;
    if (isSocialInteractionId(comment.id)) {
      await Promise.all([
        supabase.from("social_post_comments").delete().eq("id", stripSocialInteractionId(comment.id)),
        supabase.from("workout_comments").delete().eq("target_user_id", userId).eq("week", week).eq("day", day).eq("author_id", comment.user_id).eq("comment", comment.comment),
      ]);
    } else {
      await supabase.from("workout_comments").delete().eq("id", comment.id);
    }
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    emitPostInteraction(postId);
  };

  if (loading) {
    return <div className="text-xs text-muted-foreground text-center py-3">Laddar reaktioner…</div>;
  }
  if (!postId) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">
        Markera passet som klart för att dela det med vänner.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <FlameReaction active={iLiked} count={likeCount} onToggle={toggleLike} />
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <MessageCircle className="w-4 h-4" />
          <span className="tabular-nums">{comments.length}</span>
        </div>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Inga kommentarer än.</p>
        )}
        {comments.map((c) => {
          const prof = profiles[c.user_id];
          const canDelete = c.user_id === viewerId || userId === viewerId;
          return (
            <div key={c.id} className="flex items-start gap-2 group">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold overflow-hidden flex-shrink-0">
                {prof?.avatar_url ? (
                  <img src={prof.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (prof?.nickname || "?")[0]?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-secondary rounded-2xl px-3 py-1.5">
                  <p className="text-[11px] font-semibold">{prof?.nickname || "Anonym"}</p>
                  <p className="text-sm whitespace-pre-line break-words">{c.comment}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 px-2">
                  {format(new Date(c.created_at), "d MMM HH:mm", { locale: sv })}
                </p>
              </div>
              {canDelete && (
                <button
                  onClick={() => removeComment(c)}
                  className="p-1 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100"
                  title="Ta bort"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Skriv en kommentar…"
          rows={1}
          className="flex-1 resize-none bg-secondary text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        />
        <button
          onClick={submit}
          disabled={posting || !draft.trim()}
          className="p-2.5 bg-primary text-primary-foreground rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default WorkoutPostThread;
