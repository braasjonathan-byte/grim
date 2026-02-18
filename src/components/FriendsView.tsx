import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, UserPlus, Check, X, ChevronDown, ChevronUp, Users, MessageSquare, Send, Dumbbell, Footprints, Moon, Bike, ChevronLeft, ChevronRight, Sparkles, Pencil, Save, Plus, Crown, User } from "lucide-react";
import { exerciseLibrary, muscleGroups } from "@/data/exerciseLibrary";
import FriendProfileView from "@/components/FriendProfileView";

interface FriendActivity {
  nickname: string;
  day: string;
  week: number;
  timestamp: string;
}

interface FriendsViewProps {
  userId: string;
  isAdmin?: boolean;
  friendActivities?: FriendActivity[];
  onClearActivitiesForFriend?: (nickname: string) => void;
}

interface FriendProfile {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_honorary?: boolean;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
}

interface FriendPlanDay {
  id: string;
  week: number;
  day: string;
  session_name: string;
  details: string;
  tempo: string | null;
  created_at: string;
}

interface FriendCompletion {
  week: number;
  day: string;
  done: boolean;
  user_comment: string | null;
}

interface WorkoutComment {
  id: string;
  target_user_id: string;
  week: number;
  day: string;
  author_id: string;
  comment: string;
  created_at: string;
  authorNickname?: string;
}

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

const getSessionIcon = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return Dumbbell;
  if (s.includes("löpning") || s.includes("jogg") || s.includes("långpass") || s.includes("tröskel")) return Footprints;
  if (s.includes("cykel") || s.includes("återhämtning") || s.includes("crosstrainer")) return Bike;
  return Moon;
};

const getSessionColor = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return "text-primary";
  if (s.includes("löpning") || s.includes("tröskel")) return "text-warning";
  if (s.includes("långpass")) return "text-destructive";
  if (s.includes("vila")) return "text-muted-foreground";
  return "text-secondary-foreground";
};

const FriendsView = ({ userId, isAdmin = false, friendActivities = [], onClearActivitiesForFriend }: FriendsViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [friends, setFriends] = useState<(Friendship & { profile: FriendProfile })[]>([]);
  const [pendingRequests, setPendingRequests] = useState<(Friendship & { profile: FriendProfile })[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestedFriends, setSuggestedFriends] = useState<{ user_id: string; nickname: string; mutual_count: number }[]>([]);

  // Viewing a friend's workouts
  const [viewingFriend, setViewingFriend] = useState<(Friendship & { profile: FriendProfile }) | null>(null);
  const [showFriendProfile, setShowFriendProfile] = useState(true);
  const [friendPlans, setFriendPlans] = useState<FriendPlanDay[]>([]);
  const [friendCompletions, setFriendCompletions] = useState<Record<string, FriendCompletion>>({});
  const [friendWeeks, setFriendWeeks] = useState<number[]>([]);
  const [friendCurrentWeek, setFriendCurrentWeek] = useState(1);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Comments
  const [comments, setComments] = useState<WorkoutComment[]>([]);
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  
  // Admin editing
  const [togglingDone, setTogglingDone] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editDetails, setEditDetails] = useState("");
  const [editSessionName, setEditSessionName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showAdminExercisePicker, setShowAdminExercisePicker] = useState(false);
  const [adminExerciseSearch, setAdminExerciseSearch] = useState("");
  const [adminSelectedMuscle, setAdminSelectedMuscle] = useState<string | null>(null);
  const [customExercises, setCustomExercises] = useState<{ id: string; name: string; category: string; muscle_group: string }[]>([]);
  
  // Admin weight/reps/sets dialog
  const [adminWeightDialog, setAdminWeightDialog] = useState<{ exerciseName: string } | null>(null);
  const [adminWeightInput, setAdminWeightInput] = useState("");
  const [adminRepsInput, setAdminRepsInput] = useState("10");
  const [adminSetsInput, setAdminSetsInput] = useState("3");
  
  // Admin conditioning dialog
  const [adminCondDialog, setAdminCondDialog] = useState<{ exerciseName: string } | null>(null);
  const [adminCondTimeInput, setAdminCondTimeInput] = useState("");
  const [adminCondTempoInput, setAdminCondTempoInput] = useState("");
  const [adminCondDistanceInput, setAdminCondDistanceInput] = useState("");

  useEffect(() => {
    fetchFriends();
    fetchSuggestions();
  }, [userId]);

  // Load custom exercises for admin exercise picker
  useEffect(() => {
    if (isAdmin) {
      supabase.from("custom_exercises").select("*").order("name").then(({ data }) => {
        if (data) setCustomExercises(data);
      });
    }
  }, [isAdmin]);

  const allExercises = [
    ...exerciseLibrary.map((e) => ({ ...e, isCustom: false })),
    ...customExercises.map((e) => ({ name: e.name, category: e.category, muscleGroup: e.muscle_group, isCustom: true })),
  ];

  const filteredAdminExercises = allExercises.filter((e) => {
    const matchesSearch = !adminExerciseSearch || e.name.toLowerCase().includes(adminExerciseSearch.toLowerCase());
    const matchesMuscle = !adminSelectedMuscle || e.muscleGroup === adminSelectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  const fetchFriends = async () => {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (!friendships) return;

    const otherIds = friendships.map((f) =>
      f.user_id === userId ? f.friend_id : f.user_id
    );

    if (otherIds.length === 0) {
      setFriends([]);
      setPendingRequests([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url, is_honorary")
      .in("user_id", otherIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

    const accepted: typeof friends = [];
    const pending: typeof pendingRequests = [];
    const seenUserIds = new Set<string>();

    for (const f of friendships) {
      const otherId = f.user_id === userId ? f.friend_id : f.user_id;
      const profile = profileMap.get(otherId);
      if (!profile) continue;

      const entry = { ...f, profile };
      if (f.status === "accepted") {
        if (!seenUserIds.has(otherId)) {
          seenUserIds.add(otherId);
          accepted.push(entry);
        }
      } else if (f.status === "pending" && f.friend_id === userId) {
        if (!seenUserIds.has(otherId)) {
          pending.push(entry);
        }
      }
    }

    setFriends(accepted);
    setPendingRequests(pending);
  };

  const fetchSuggestions = async () => {
    const { data } = await supabase.rpc("get_suggested_friends", {
      requesting_user_id: userId,
    });
    setSuggestedFriends((data || []).map((d: any) => ({ ...d, mutual_count: Number(d.mutual_count) })));
  };


  const searchUsers = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);

    const { data } = await supabase
      .rpc("search_users_by_nickname", {
        search_term: searchQuery.trim(),
        requesting_user_id: userId,
      });

    setSearchResults((data || []).map((d: any) => ({ ...d, avatar_url: null })));
    setSearching(false);
  };

  const sendRequest = async (friendId: string) => {
    // Check if a friendship already exists in either direction
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status, user_id, friend_id")
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .limit(1);

    if (existing && existing.length > 0) {
      const row = existing[0];
      // If they sent us a pending request, auto-accept it
      if (row.status === "pending" && row.friend_id === userId) {
        await supabase.from("friendships").update({ status: "accepted" }).eq("id", row.id);
      }
      // Otherwise already friends or we already sent a request — do nothing
    } else {
      await supabase.from("friendships").insert({
        user_id: userId,
        friend_id: friendId,
        status: "pending",
      });

      // Send push notification to the recipient
      supabase.functions.invoke("notify-friend-request", {
        body: { friendId },
      }).catch((err) => console.error("Failed to notify friend request:", err));
    }

    setSearchResults([]);
    setSearchQuery("");
    fetchFriends();
    fetchSuggestions();
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    fetchFriends();
  };

  const rejectRequest = async (friendshipId: string) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    fetchFriends();
  };

  const isAlreadyFriend = (uid: string) =>
    friends.some((f) => f.profile.user_id === uid) ||
    pendingRequests.some((f) => f.profile.user_id === uid);

  // View friend's workouts
  const viewFriendWorkouts = async (friend: typeof friends[0]) => {
    setViewingFriend(friend);
    onClearActivitiesForFriend?.(friend.profile.nickname);
    const fid = friend.profile.user_id;

    const [{ data: plans }, { data: completions }, { data: commentsData }] = await Promise.all([
      supabase.from("workout_plans").select("id, week, day, session_name, details, tempo, created_at").eq("user_id", fid).order("week").order("day"),
      supabase.from("workout_completions").select("week, day, done, user_comment").eq("user_id", fid),
      supabase.from("workout_comments").select("*").eq("target_user_id", fid),
    ]);

    if (plans) {
      setFriendPlans(plans);
      const wks = [...new Set(plans.map((p) => p.week))].sort((a, b) => a - b);
      setFriendWeeks(wks);
      if (wks.length > 0) setFriendCurrentWeek(wks[0]);
    }

    if (completions) {
      const map: Record<string, FriendCompletion> = {};
      for (const c of completions) {
        map[`${c.week}-${c.day}`] = c;
      }
      setFriendCompletions(map);
    }

    // Fetch nicknames for comment authors
    if (commentsData && commentsData.length > 0) {
      setComments(commentsData);
      const authorIds = [...new Set(commentsData.map((c) => c.author_id))];
      const { data: authorProfiles } = await supabase
        .from("profiles")
        .select("user_id, nickname")
        .in("user_id", authorIds);
      if (authorProfiles) {
        const map: Record<string, string> = {};
        for (const p of authorProfiles) map[p.user_id] = p.nickname;
        setNicknameMap(map);
      }
    } else {
      setComments([]);
    }
  };

  const isWithinOneHour = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return now - created < 60 * 60 * 1000;
  };

  const startEditing = (plan: FriendPlanDay) => {
    setEditingPlanId(plan.id);
    setEditDetails(plan.details);
    setEditSessionName(plan.session_name);
    setShowAdminExercisePicker(false);
    setAdminExerciseSearch("");
    setAdminSelectedMuscle(null);
  };

  const getEditDetailsParts = () => editDetails.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const getEditSeparator = () => editDetails.includes("\n") ? "\n" : "; ";

  const removeEditExercise = (index: number) => {
    const parts = getEditDetailsParts();
    parts.splice(index, 1);
    setEditDetails(parts.join(getEditSeparator()));
  };

  const handleAdminExerciseSelect = (exerciseName: string) => {
    const exercise = allExercises.find((e) => e.name === exerciseName);
    setShowAdminExercisePicker(false);
    setAdminExerciseSearch("");
    if (exercise && exercise.category === "kondition") {
      setAdminCondDialog({ exerciseName });
      setAdminCondTimeInput("");
      setAdminCondTempoInput("");
      setAdminCondDistanceInput("");
    } else {
      setAdminWeightDialog({ exerciseName });
      setAdminWeightInput("");
      setAdminRepsInput("10");
      setAdminSetsInput("3");
    }
  };

  const addAdminExerciseWithWeight = () => {
    if (!adminWeightDialog) return;
    const sets = parseInt(adminSetsInput) || 3;
    const reps = parseInt(adminRepsInput) || 10;
    const w = adminWeightInput.trim();
    const entry = w
      ? `${adminWeightDialog.exerciseName} — ${sets}×${reps} @ ${w} kg`
      : `${adminWeightDialog.exerciseName} — ${sets}×${reps}`;
    const sep = editDetails ? getEditSeparator() : "";
    setEditDetails(editDetails ? `${editDetails}${sep}${entry}` : entry);
    setAdminWeightDialog(null);
  };

  const addAdminCondExercise = () => {
    if (!adminCondDialog) return;
    const infoParts: string[] = [];
    if (adminCondTimeInput.trim()) infoParts.push(`${adminCondTimeInput.trim()} min`);
    if (adminCondTempoInput.trim()) infoParts.push(`${adminCondTempoInput.trim()}/km`);
    if (adminCondDistanceInput.trim()) infoParts.push(`${adminCondDistanceInput.trim()} km`);
    const entry = infoParts.length > 0
      ? `${adminCondDialog.exerciseName} — ${infoParts.join(", ")}`
      : adminCondDialog.exerciseName;
    const sep = editDetails ? getEditSeparator() : "";
    setEditDetails(editDetails ? `${editDetails}${sep}${entry}` : entry);
    setAdminCondDialog(null);
  };

  const saveEdit = async (planId: string) => {
    setSavingEdit(true);
    await supabase.from("workout_plans").update({
      details: editDetails,
      session_name: editSessionName,
    }).eq("id", planId);
    
    setFriendPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, details: editDetails, session_name: editSessionName } : p
      )
    );
    setEditingPlanId(null);
    setSavingEdit(false);
  };

  const adminToggleDone = async (plan: FriendPlanDay) => {
    if (!viewingFriend) return;
    const fid = viewingFriend.profile.user_id;
    const key = `${plan.week}-${plan.day}`;
    const current = friendCompletions[key];
    const newDone = !current?.done;
    setTogglingDone(key);

    setFriendCompletions((prev) => ({
      ...prev,
      [key]: { week: plan.week, day: plan.day, done: newDone, user_comment: current?.user_comment || null },
    }));

    await supabase.from("workout_completions").upsert(
      {
        user_id: fid,
        week: plan.week,
        day: plan.day,
        done: newDone,
        skipped: false,
      } as any,
      { onConflict: "user_id,week,day" }
    );

    setTogglingDone(null);
  };

  const postComment = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const text = newComment[key]?.trim();
    if (!text || !viewingFriend) return;

    const { data } = await supabase.from("workout_comments").insert({
      target_user_id: viewingFriend.profile.user_id,
      week,
      day,
      author_id: userId,
      comment: text,
    }).select().single();

    if (data) {
      setComments((prev) => [...prev, data]);
      // Make sure our nickname is in the map
      if (!nicknameMap[userId]) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("user_id", userId)
          .maybeSingle();
        if (profile) {
          setNicknameMap((prev) => ({ ...prev, [userId]: profile.nickname }));
        }
      }
      // Send push notification to the friend
      try {
        await supabase.functions.invoke("notify-comment", {
          body: { targetUserId: viewingFriend.profile.user_id, day, week },
        });
      } catch (e) {
        console.error("Failed to send comment push:", e);
      }
    }
    setNewComment((prev) => ({ ...prev, [key]: "" }));
  };

  // Friend workout detail view
  if (viewingFriend) {
    const weekDays = friendPlans
      .filter((p) => p.week === friendCurrentWeek)
      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

    const weekIdx = friendWeeks.indexOf(friendCurrentWeek);
    const doneCount = weekDays.filter((d) => friendCompletions[`${d.week}-${d.day}`]?.done).length;
    const progress = weekDays.length > 0 ? Math.round((doneCount / weekDays.length) * 100) : 0;

    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => { setViewingFriend(null); setExpandedDay(null); }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Tillbaka till vänner
        </button>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden mx-auto">
            {viewingFriend.profile.avatar_url ? (
              <img src={viewingFriend.profile.avatar_url} alt={viewingFriend.profile.nickname} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-primary">{viewingFriend.profile.nickname[0]?.toUpperCase()}</span>
            )}
          </div>
          <h2 className="text-xl font-black">{viewingFriend.profile.nickname}</h2>
          <button
            onClick={() => setShowFriendProfile(true)}
            className="text-xs text-primary font-semibold flex items-center gap-1 mx-auto hover:opacity-80"
          >
            <User className="w-3 h-3" /> Visa profil
          </button>
        </div>

        {showFriendProfile && (
          <FriendProfileView
            friendUserId={viewingFriend.profile.user_id}
            nickname={viewingFriend.profile.nickname}
            onClose={() => setShowFriendProfile(false)}
          />
        )}

        {friendPlans.length === 0 ? (
          <div className="text-center py-8">
            <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Inget schema ännu</p>
          </div>
        ) : (
          <>
            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => weekIdx > 0 && setFriendCurrentWeek(friendWeeks[weekIdx - 1])}
                disabled={weekIdx <= 0}
                className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h3 className="text-lg font-black">Vecka {friendCurrentWeek}</h3>
                <p className="text-xs text-muted-foreground">av {friendWeeks.length} veckor</p>
              </div>
              <button
                onClick={() => weekIdx < friendWeeks.length - 1 && setFriendCurrentWeek(friendWeeks[weekIdx + 1])}
                disabled={weekIdx >= friendWeeks.length - 1}
                className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Progress bar */}
            <div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">{progress}% avklarat</p>
            </div>

            {/* Week overview */}
            <div className="grid grid-cols-6 gap-1.5">
              {friendWeeks.map((w) => (
                <button
                  key={w}
                  onClick={() => setFriendCurrentWeek(w)}
                  className={`flex flex-col items-center p-2 rounded-md text-xs transition-all ${
                    w === friendCurrentWeek
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="font-bold">V{w}</span>
                </button>
              ))}
            </div>

            {/* Workout cards */}
            <div className="space-y-2">
              {weekDays.map((plan) => {
                const key = `${plan.week}-${plan.day}`;
                const completion = friendCompletions[key];
                const isDone = completion?.done || false;
                const expanded = expandedDay === key;
                const Icon = getSessionIcon(plan.session_name);
                const colorClass = getSessionColor(plan.session_name);
                const isRest = plan.session_name.toLowerCase().includes("vila") || plan.session_name.toLowerCase().includes("återhämtning");
                const dayComments = comments.filter((c) => c.week === plan.week && c.day === plan.day);

                return (
                  <div
                    key={key}
                    className={`rounded-lg border bg-card transition-all ${isDone ? "opacity-80" : ""} ${isRest ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedDay(expanded ? null : key)}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        isDone ? "bg-success border-success" : "border-muted-foreground/30"
                      }`}>
                        {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                      </div>
                      <div className={`flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-mono text-muted-foreground uppercase">{plan.day}</span>
                          <span className={`font-semibold text-sm truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
                            {plan.session_name}
                          </span>
                        </div>
                        {plan.tempo && plan.tempo !== "—" && (
                          <span className="text-xs text-muted-foreground font-mono">{plan.tempo}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {dayComments.length > 0 && (
                          <span className="text-xs text-primary font-semibold">{dayComments.length} 💬</span>
                        )}
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3 animate-fade-in">
                        {/* Admin actions */}
                        {isAdmin && editingPlanId !== plan.id && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => adminToggleDone(plan)}
                              disabled={togglingDone === key}
                              className={`flex items-center gap-1.5 text-xs font-semibold hover:underline ${
                                isDone ? "text-muted-foreground" : "text-success"
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" /> {isDone ? "Ångra klarmarkering" : "Klarmarkera"}
                            </button>
                            <button
                              onClick={() => startEditing(plan)}
                              className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Redigera pass
                            </button>
                          </div>
                        )}

                        {/* Admin editing mode */}
                        {editingPlanId === plan.id ? (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Passnamn</label>
                              <input
                                type="text"
                                value={editSessionName}
                                onChange={(e) => setEditSessionName(e.target.value)}
                                className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>

                            {/* Exercise list with remove buttons */}
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Övningar</label>
                              <div className="space-y-1">
                                {getEditDetailsParts().map((part, i) => (
                                  <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded-md px-2 py-1.5">
                                    <span className="flex-1 text-sm text-foreground">{part}</span>
                                    <button
                                      onClick={() => removeEditExercise(i)}
                                      className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                      title="Ta bort övning"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Add exercise picker */}
                            {showAdminExercisePicker ? (
                              <div className="bg-secondary/50 rounded-lg p-3 space-y-2 animate-fade-in">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-semibold">Lägg till övning</h4>
                                  <button onClick={() => { setShowAdminExercisePicker(false); setAdminExerciseSearch(""); }} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={adminExerciseSearch}
                                  onChange={(e) => setAdminExerciseSearch(e.target.value)}
                                  placeholder="Sök övning..."
                                  className="w-full bg-background text-foreground text-xs px-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                                />
                                <div className="flex flex-wrap gap-1">
                                  {muscleGroups.map((mg) => (
                                    <button
                                      key={mg}
                                      onClick={() => setAdminSelectedMuscle(adminSelectedMuscle === mg ? null : mg)}
                                      className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${adminSelectedMuscle === mg ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                                    >
                                      {mg}
                                    </button>
                                  ))}
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-0.5">
                                  {filteredAdminExercises.slice(0, 30).map((ex) => (
                                    <button
                                      key={ex.name}
                                      onClick={() => handleAdminExerciseSelect(ex.name)}
                                      className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-primary/10 text-foreground transition-colors"
                                    >
                                      {ex.name}
                                      <span className="text-muted-foreground ml-1">({ex.muscleGroup})</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setShowAdminExercisePicker(true); setAdminExerciseSearch(""); setAdminSelectedMuscle(null); }}
                                className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Lägg till övning
                              </button>
                            )}

                            {/* Weight/reps/sets dialog */}
                            {adminWeightDialog && (
                              <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-primary/30">
                                <h4 className="text-sm font-bold flex items-center gap-1.5">
                                  <Dumbbell className="w-4 h-4 text-primary" />
                                  {adminWeightDialog.exerciseName}
                                </h4>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Set</label>
                                    <input type="number" inputMode="numeric" value={adminSetsInput} onChange={(e) => setAdminSetsInput(e.target.value)} className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Reps</label>
                                    <input type="number" inputMode="numeric" value={adminRepsInput} onChange={(e) => setAdminRepsInput(e.target.value)} className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Vikt (kg)</label>
                                    <input type="number" inputMode="decimal" value={adminWeightInput} onChange={(e) => setAdminWeightInput(e.target.value)} placeholder="—" className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono placeholder:text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={addAdminExerciseWithWeight} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">
                                    <Plus className="w-3.5 h-3.5" /> Lägg till
                                  </button>
                                  <button onClick={() => setAdminWeightDialog(null)} className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                                    Avbryt
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Conditioning dialog */}
                            {adminCondDialog && (
                              <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-warning/30">
                                <h4 className="text-sm font-bold flex items-center gap-1.5">
                                  <Footprints className="w-4 h-4 text-warning" />
                                  {adminCondDialog.exerciseName}
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid (min)</label>
                                    <input type="number" inputMode="numeric" value={adminCondTimeInput} onChange={(e) => setAdminCondTimeInput(e.target.value)} placeholder="t.ex. 30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo (min/km)</label>
                                    <input type="text" value={adminCondTempoInput} onChange={(e) => setAdminCondTempoInput(e.target.value)} placeholder="t.ex. 5:30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Distans (km)</label>
                                  <input type="number" inputMode="decimal" value={adminCondDistanceInput} onChange={(e) => setAdminCondDistanceInput(e.target.value)} placeholder="t.ex. 5" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={addAdminCondExercise} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">
                                    <Plus className="w-3.5 h-3.5" /> Lägg till
                                  </button>
                                  <button onClick={() => setAdminCondDialog(null)} className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                                    Avbryt
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(plan.id)}
                                disabled={savingEdit}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md disabled:opacity-40"
                              >
                                <Save className="w-3.5 h-3.5" /> Spara
                              </button>
                              <button
                                onClick={() => setEditingPlanId(null)}
                                className="px-3 py-1.5 bg-secondary text-muted-foreground text-xs font-semibold rounded-md hover:text-foreground"
                              >
                                Avbryt
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Workout details */
                          (() => {
                            const detailParts = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
                            return detailParts.length > 1 ? (
                              <ul className="space-y-1.5">
                                {detailParts.map((line, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                                    <span className="text-muted-foreground">•</span>
                                    <span className="flex-1">{line}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-foreground leading-relaxed">{plan.details}</p>
                            );
                          })()
                        )}

                        {/* User's own comment */}
                        {completion?.user_comment && (
                          <div className="bg-secondary/50 rounded-md p-2">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">{viewingFriend.profile.nickname}:</span>{" "}
                              {completion.user_comment}
                            </p>
                          </div>
                        )}

                        {/* Comments from friends */}
                        {dayComments.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground">Kommentarer</p>
                            {dayComments.map((c) => (
                              <div key={c.id} className="bg-secondary/50 rounded-md p-2">
                                <p className="text-xs">
                                  <span className="font-semibold text-primary">{nicknameMap[c.author_id] || "..."}</span>{" "}
                                  <span className="text-muted-foreground">{c.comment}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add comment */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <input
                              type="text"
                              value={newComment[key] || ""}
                              onChange={(e) => setNewComment((prev) => ({ ...prev, [key]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && postComment(plan.week, plan.day)}
                              placeholder="Skriv en kommentar..."
                              className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                            />
                          </div>
                          <button
                            onClick={() => postComment(plan.week, plan.day)}
                            disabled={!newComment[key]?.trim()}
                            className="px-3 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-40"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Friends list view
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black">Vänner</h2>

      {/* Search */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              placeholder="Sök efter användarnamn..."
              className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={searchUsers}
            disabled={searching}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md"
          >
            Sök
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="bg-card border border-border rounded-lg divide-y divide-border animate-fade-in">
            {searchResults.map((profile) => (
              <div key={profile.user_id} className="flex items-center justify-between p-3">
                <span className="font-semibold text-sm">{profile.nickname}</span>
                {isAlreadyFriend(profile.user_id) ? (
                  <span className="text-xs text-muted-foreground">Redan tillagd</span>
                ) : (
                  <button
                    onClick={() => sendRequest(profile.user_id)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md"
                  >
                    <UserPlus className="w-3 h-3" /> Lägg till
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Vänförfrågningar</h3>
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-3 bg-card border border-primary/30 rounded-lg">
              <span className="font-semibold text-sm">{req.profile.nickname}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => acceptRequest(req.id)}
                  className="p-1.5 bg-success text-success-foreground rounded-md"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => rejectRequest(req.id)}
                  className="p-1.5 bg-destructive text-destructive-foreground rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggested friends */}
      {suggestedFriends.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Föreslagna vänner
          </h3>
          {suggestedFriends.map((suggestion) => (
            <div key={suggestion.user_id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center overflow-hidden">
                  <span className="text-sm font-bold text-accent-foreground">{suggestion.nickname[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <span className="font-semibold text-sm block">{suggestion.nickname}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {suggestion.mutual_count} gemensam{suggestion.mutual_count !== 1 ? "ma" : ""} vän{suggestion.mutual_count !== 1 ? "ner" : ""}
                  </span>
                </div>
              </div>
              <button
                onClick={() => sendRequest(suggestion.user_id)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md"
              >
                <UserPlus className="w-3 h-3" /> Lägg till
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Dina vänner ({friends.length})
        </h3>
        {friends.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Users className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Inga vänner ännu. Sök efter användarnamn ovan!</p>
          </div>
        ) : (
          friends.map((friend) => {
            const recentCount = friendActivities.filter(a => a.nickname === friend.profile.nickname).length;
            return (
              <div
                key={friend.id}
                className="w-full flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <button
                  onClick={() => viewFriendWorkouts(friend)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="relative w-9 h-9 flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                      {friend.profile.avatar_url ? (
                        <img src={friend.profile.avatar_url} alt={friend.profile.nickname} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{friend.profile.nickname[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    {friend.profile.is_honorary && (
                      <div className="absolute -top-2 -left-2 z-10 -rotate-[22deg]">
                        <Crown className="w-5 h-5 text-warning drop-shadow-sm" />
                      </div>
                    )}
                  </div>
                  <span className="font-semibold text-sm">{friend.profile.nickname}</span>
                  {recentCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] font-bold rounded-full">
                      🔥 {recentCount} pass
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={() => viewFriendWorkouts(friend)}
                      className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Redigera pass"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => viewFriendWorkouts(friend)} className="text-muted-foreground">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FriendsView;
