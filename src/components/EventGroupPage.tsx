import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, Trash2, Calendar } from "lucide-react";
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

const EventGroupPage = ({ groupId, userId, isAdmin, onBack, onDeleted }: EventGroupPageProps) => {
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProfile, setViewingProfile] = useState<{ id: string; nickname: string } | null>(null);

  useEffect(() => {
    loadGroup();
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

      {/* Members list */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Medlemmar</h4>
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
    </div>
  );
};

export default EventGroupPage;
