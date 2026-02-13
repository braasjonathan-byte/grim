import { useState, useEffect } from "react";
import { Megaphone, Loader2, Check, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AnnouncementInboxProps {
  userId: string;
  isAdmin: boolean;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

const AnnouncementInbox = ({ userId, isAdmin }: AnnouncementInboxProps) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, message, created_at")
      .order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePublish = async () => {
    const trimmedTitle = title.trim();
    const trimmedMsg = message.trim();
    if (!trimmedTitle || !trimmedMsg) return;

    setSending(true);
    const { error } = await supabase
      .from("announcements")
      .insert({ author_id: userId, title: trimmedTitle, message: trimmedMsg });

    if (!error) {
      setTitle("");
      setMessage("");
      setSent(true);
      fetchAnnouncements();
      setTimeout(() => setSent(false), 3000);
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    fetchAnnouncements();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">📢 Inkorg</h3>
      </div>

      {/* Admin: publish form */}
      {isAdmin && (
        <div className="space-y-2 border-b border-border pb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rubrik..."
            maxLength={100}
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Skriv meddelande till alla användare..."
            maxLength={1000}
            rows={3}
            className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none"
          />
          <button
            onClick={handlePublish}
            disabled={!title.trim() || !message.trim() || sending}
            className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : sent ? (
              <>
                <Check className="w-4 h-4" /> Publicerat!
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Publicera
              </>
            )}
          </button>
        </div>
      )}

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Inga meddelanden ännu.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div key={a.id} className="bg-secondary rounded-lg p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-foreground">{a.title}</h4>
                  <span className="text-[10px] text-muted-foreground">{formatDate(a.created_at)}</span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1 text-destructive hover:opacity-70 transition-opacity flex-shrink-0"
                    title="Ta bort"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementInbox;
