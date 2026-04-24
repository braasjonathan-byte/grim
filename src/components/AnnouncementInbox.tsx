import { useState, useEffect } from "react";
import { Loader2, Check, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import grimIcon from "@/assets/grim-icon.webp";

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
      .order("created_at", { ascending: true });
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
      try {
        await supabase.functions.invoke("notify-announcement", {
          body: { title: trimmedTitle },
        });
      } catch (e) {
        console.error("Failed to send push notifications:", e);
      }

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

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="border border-border rounded-lg bg-secondary overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary">
        <img src={grimIcon} alt="Grim" className="w-8 h-8 rounded-full object-cover" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">Grim</div>
          <div className="text-[10px] text-muted-foreground">Inkorg · officiella meddelanden</div>
        </div>
      </div>

      {/* Conversation */}
      <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto">
        {announcements.length === 0 ? (
          <div className="flex items-end gap-2">
            <img src={grimIcon} alt="Grim" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            <div className="bg-card text-foreground text-sm rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%]">
              <p className="text-sm">Här dyker nya meddelanden från Grim-teamet upp 📭</p>
            </div>
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="flex items-end gap-2 group">
              <img src={grimIcon} alt="Grim" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
              <div className="flex flex-col max-w-[85%]">
                <div className="bg-card text-foreground rounded-2xl rounded-bl-sm px-3 py-2 space-y-1">
                  <h4 className="text-sm font-bold text-foreground">{a.title}</h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{a.message}</p>
                </div>
                <div className="flex items-center gap-2 px-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatTime(a.created_at)}</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-0.5 text-destructive hover:opacity-70 transition-opacity opacity-60 group-hover:opacity-100"
                      title="Ta bort"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Admin: publish form */}
      {isAdmin && (
        <div className="p-3 border-t border-border space-y-2 bg-secondary">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rubrik..."
            maxLength={100}
            className="w-full bg-card text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
          />
          <div className="flex items-end gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv meddelande till alla användare..."
              maxLength={1000}
              rows={2}
              className="flex-1 bg-card text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none"
            />
            <button
              onClick={handlePublish}
              disabled={!title.trim() || !message.trim() || sending}
              className="h-10 w-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
              title="Publicera"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : sent ? (
                <Check className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementInbox;
