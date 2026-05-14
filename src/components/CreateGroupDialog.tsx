import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Users, Check, Loader2 } from "lucide-react";
import { createChatGroup } from "@/lib/chatGroups";
import { toast } from "sonner";

interface Friend {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
}

interface CreateGroupDialogProps {
  userId: string;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

const CreateGroupDialog = ({ userId, onClose, onCreated }: CreateGroupDialogProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: friendships } = await supabase
        .from("friendships")
        .select("user_id, friend_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (!friendships || friendships.length === 0) {
        setLoading(false);
        return;
      }
      const ids = friendships.map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, avatar_url")
        .in("user_id", ids);
      setFriends(((profiles || []) as Friend[]).sort((a, b) => a.nickname.localeCompare(b.nickname)));
      setLoading(false);
    })();
  }, [userId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const create = async () => {
    if (!name.trim()) {
      toast.error("Ge gruppen ett namn");
      return;
    }
    if (selected.size === 0) {
      toast.error("Välj minst en vän");
      return;
    }
    setCreating(true);
    const group = await createChatGroup(name, Array.from(selected));
    setCreating(false);
    if (!group) {
      toast.error("Kunde inte skapa grupp");
      return;
    }
    toast.success("Grupp skapad");
    onCreated(group.id);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-3">
      <div className="w-full max-w-md bg-card border border-border max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Skapa gruppchatt
          </h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Gruppnamn</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="t.ex. Träningsbuddies"
            maxLength={50}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border focus:border-primary outline-none"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Välj vänner ({selected.size} valda)
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : friends.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Lägg till vänner först för att kunna skapa grupp.
            </p>
          ) : (
            <div className="space-y-1">
              {friends.map((f) => {
                const isSelected = selected.has(f.user_id);
                return (
                  <button
                    key={f.user_id}
                    onClick={() => toggle(f.user_id)}
                    className={`w-full flex items-center gap-3 p-2 transition-colors text-left ${
                      isSelected ? "bg-primary/10 border border-primary" : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-primary">{f.nickname.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium flex-1">{f.nickname}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            disabled={creating}
            className="flex-1 px-3 py-2 text-sm border border-border hover:bg-muted transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={create}
            disabled={creating || !name.trim() || selected.size === 0}
            className="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground font-bold disabled:opacity-50"
          >
            {creating ? "Skapar..." : "Skapa grupp"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupDialog;
