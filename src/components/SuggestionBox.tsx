import { useState, useEffect } from "react";
import { MessageSquarePlus, Loader2, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SuggestionBoxProps {
  userId: string;
  isAdmin?: boolean;
}

interface Suggestion {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
}

const SuggestionBox = ({ userId, isAdmin = false }: SuggestionBoxProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});

  const fetchSuggestions = async () => {
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setSuggestions(data as Suggestion[]);
      // Fetch nicknames via secure RPC function
      const userIds = [...new Set(data.map((s: Suggestion) => s.user_id))];
      if (userIds.length > 0) {
        const { data: nicknameData } = await supabase.rpc("get_suggestion_nicknames", {
          user_ids: userIds,
        });
        if (nicknameData) {
          const map: Record<string, string> = {};
          (nicknameData as { user_id: string; nickname: string }[]).forEach((p) => {
            map[p.user_id] = p.nickname;
          });
          setNicknames(map);
        }
      }
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed || trimmed.length < 3) return;

    setSending(true);
    const { error } = await supabase
      .from("suggestions")
      .insert({ user_id: userId, message: trimmed });

    if (!error) {
      setMessage("");
      setSent(true);
      fetchSuggestions();
      setTimeout(() => setSent(false), 3000);
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("suggestions").delete().eq("id", id);
    fetchSuggestions();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">💡 Förslagslåda</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Har du en idé eller feedback? Skicka in ditt förslag så tittar vi på det!
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Skriv ditt förslag här..."
        maxLength={500}
        rows={3}
        className="w-full bg-secondary text-foreground text-sm p-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{message.length}/500</span>
        <button
          onClick={handleSubmit}
          disabled={message.trim().length < 3 || sending}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : sent ? (
            <>
              <Check className="w-4 h-4" /> Skickat!
            </>
          ) : (
            "Skicka"
          )}
        </button>
      </div>
      {sent && (
        <p className="text-xs text-center text-success flex items-center justify-center gap-1">
          <Check className="w-3 h-3" /> Tack för ditt förslag!
        </p>
      )}

      {/* List of suggestions */}
      {suggestions.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Inskickade förslag</h4>
          {suggestions.map((s) => (
            <div key={s.id} className="bg-secondary rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">
                  {nicknames[s.user_id] || "Okänd"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{formatDate(s.created_at)}</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1 text-destructive hover:opacity-70 transition-opacity"
                      title="Ta bort"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-foreground">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestionBox;
