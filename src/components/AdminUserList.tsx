import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Check, Loader2, ChevronDown, Eye, ShieldAlert } from "lucide-react";
import HonoraryBadge from "./HonoraryBadge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AdminUserListProps {
  userId: string;
  onViewUserPlan?: (targetUserId: string) => void;
}

type AccessLevelKey = "member" | "honorary" | "admin";

const ACCESS_LEVELS: { key: AccessLevelKey; label: string }[] = [
  { key: "member", label: "Medlem" },
  { key: "honorary", label: "👑 Hedersmedlem" },
  { key: "admin", label: "🛡️ Admin" },
];

interface UserEntry {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_honorary: boolean;
  role: "admin" | "member";
}

interface FriendshipStatus {
  [userId: string]: "accepted" | "pending_sent" | "pending_received" | null;
}

const levelOf = (u: UserEntry): AccessLevelKey =>
  u.role === "admin" ? "admin" : u.is_honorary ? "honorary" : "member";


const AdminUserList = ({ userId, onViewUserPlan }: AdminUserListProps) => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [friendshipStatuses, setFriendshipStatuses] = useState<FriendshipStatus>({});
  const [loading, setLoading] = useState(false);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);
  const [savingAccess, setSavingAccess] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ user: UserEntry; level: AccessLevelKey } | null>(null);
  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open]);

  const fetchData = async () => {
    setLoading(true);

    const [{ data: profiles }, { data: friendships }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, nickname, avatar_url, is_honorary").order("nickname"),
      supabase.from("friendships").select("user_id, friend_id, status").or(`user_id.eq.${userId},friend_id.eq.${userId}`),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    if (profiles) {
      const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
      setUsers(
        profiles
          .filter((p) => p.user_id !== userId)
          .map((p) => ({
            ...p,
            role: (roleMap.get(p.user_id) === "admin" ? "admin" : "member") as "admin" | "member",
          }))
      );
    }


    if (friendships) {
      const statuses: FriendshipStatus = {};
      for (const f of friendships) {
        const otherId = f.user_id === userId ? f.friend_id : f.user_id;
        if (f.status === "accepted") {
          statuses[otherId] = "accepted";
        } else if (f.status === "pending") {
          statuses[otherId] = f.user_id === userId ? "pending_sent" : "pending_received";
        }
      }
      setFriendshipStatuses(statuses);
    }

    setLoading(false);
  };

  const addFriend = async (friendId: string) => {
    setAddingFriend(friendId);

    // Check if friendship exists in either direction
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status, user_id, friend_id")
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
      .limit(1);

    if (existing && existing.length > 0) {
      const row = existing[0];
      if (row.status === "pending" && row.friend_id === userId) {
        await supabase.from("friendships").update({ status: "accepted" }).eq("id", row.id);
      }
    } else {
      await supabase.from("friendships").insert({
        user_id: userId,
        friend_id: friendId,
        status: "pending",
      });
    }

    await fetchData();
    setAddingFriend(null);
  };

  const applyAccessChange = async () => {
    if (!pendingChange) return;
    const { user: target, level } = pendingChange;
    setPendingChange(null);
    setSavingAccess(target.user_id);
    const { error } = await (supabase as any).rpc("admin_set_user_access", {
      _user_id: target.user_id,
      _role: level === "admin" ? "admin" : "member",
      _honorary: level !== "member",
    });
    setSavingAccess(null);
    if (error) {
      toast.error(error.message || "Kunde inte ändra behörighet");
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === target.user_id
          ? { ...u, role: level === "admin" ? "admin" : "member", is_honorary: level !== "member" }
          : u
      )
    );
    toast.success(
      `${target.nickname} är nu ${ACCESS_LEVELS.find((l) => l.key === level)?.label.replace(/^\S+\s/, "")}`
    );
  };


  const getStatusLabel = (status: FriendshipStatus[string]) => {
    switch (status) {
      case "accepted": return "Vän ✓";
      case "pending_sent": return "Skickad";
      case "pending_received": return "Mottagen";
      default: return null;
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">👑 Alla användare</h3>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2 animate-fade-in">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Inga användare hittades.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{users.length} användare</p>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {users.map((u) => {
                  const status = friendshipStatuses[u.user_id];
                  const isFriend = status === "accepted";
                  const isPending = status === "pending_sent" || status === "pending_received";

                  return (
                    <div
                      key={u.user_id}
                      className="flex flex-col gap-1 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.nickname} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-primary">{u.nickname[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{u.nickname}</span>
                        {u.is_honorary && <HonoraryBadge size="xs" nickname={u.nickname} />}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => onViewUserPlan?.(u.user_id)}
                          title="Visa träningsplan"
                          className="p-1.5 rounded-md bg-secondary text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {savingAccess === u.user_id ? (
                          <span className="px-2 py-1 rounded-md bg-secondary">
                            <Loader2 className="w-3 h-3 animate-spin" />
                          </span>
                        ) : u.nickname?.trim().toLowerCase() === "grim" ? (
                          <span className="px-2 py-1 rounded-md text-[10px] font-semibold bg-primary/15 text-primary">
                            🛡️ Skapare
                          </span>
                        ) : (
                          <select
                            value={levelOf(u)}
                            onChange={(e) =>
                              setPendingChange({ user: u, level: e.target.value as AccessLevelKey })
                            }
                            title="Ändra behörighetsnivå"
                            className={`px-2 py-1 rounded-md text-[10px] font-semibold border-0 outline-none cursor-pointer ${
                              levelOf(u) === "admin"
                                ? "bg-primary/15 text-primary"
                                : levelOf(u) === "honorary"
                                  ? "bg-warning/20 text-warning"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {ACCESS_LEVELS.map((l) => (
                              <option key={l.key} value={l.key}>{l.label}</option>
                            ))}
                          </select>
                        )}

                        {isFriend ? (
                          <span className="text-xs text-primary font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Vän
                          </span>
                        ) : isPending ? (
                          <span className="text-xs text-muted-foreground">{getStatusLabel(status)}</span>
                        ) : (
                          <button
                            onClick={() => addFriend(u.user_id)}
                            disabled={addingFriend === u.user_id}
                            className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {addingFriend === u.user_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <AlertDialog open={!!pendingChange} onOpenChange={(o) => !o && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-warning" /> Ändra behörighet
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vill du ändra <strong>{pendingChange?.user.nickname}</strong> till{" "}
              <strong>{ACCESS_LEVELS.find((l) => l.key === pendingChange?.level)?.label}</strong>?
              {pendingChange?.level === "admin" && " Admin får full tillgång till alla användare och adminverktyg."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={applyAccessChange}>Bekräfta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

};

export default AdminUserList;
