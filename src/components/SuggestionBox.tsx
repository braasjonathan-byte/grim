import { useState, useEffect } from "react";
import { MessageSquarePlus, Loader2, Check, Trash2, Send, Shield, Archive, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
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
  handled_at: string | null;
  handled_by: string | null;
}

interface Reply {
  id: string;
  suggestion_id: string;
  author_id: string;
  message: string;
  created_at: string;
}

const SuggestionBox = ({ userId, isAdmin = false }: SuggestionBoxProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const fetchSuggestions = async () => {
    const [{ data }, { data: replyData }] = await Promise.all([
      supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
      supabase.from("suggestion_replies").select("*").order("created_at", { ascending: true }),
    ]);

    if (data) {
      setSuggestions(data as Suggestion[]);
      const userIds = new Set(data.map((s: Suggestion) => s.user_id));
      // Add handled_by user ids
      data.forEach((s: any) => { if (s.handled_by) userIds.add(s.handled_by); });
      if (replyData) {
        setReplies(replyData as Reply[]);
        (replyData as Reply[]).forEach((r) => userIds.add(r.author_id));
      }
      if (userIds.size > 0) {
        const { data: nicknameData } = await supabase.rpc("get_suggestion_nicknames", {
          user_ids: [...userIds],
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

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("user_id", userId)
          .maybeSingle();

        await supabase.functions.invoke("notify-suggestion", {
          body: { nickname: profile?.nickname || "Okänd" },
        });
      } catch (e) {
        console.error("Failed to send suggestion push:", e);
      }
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("suggestions").delete().eq("id", id);
    fetchSuggestions();
  };

  const handleMarkHandled = async (id: string) => {
    await supabase.from("suggestions").update({
      handled_at: new Date().toISOString(),
      handled_by: userId,
    } as any).eq("id", id);
    fetchSuggestions();
  };

  const handleUnmarkHandled = async (id: string) => {
    await supabase.from("suggestions").update({
      handled_at: null,
      handled_by: null,
    } as any).eq("id", id);
    fetchSuggestions();
  };

  const handleReply = async (suggestionId: string) => {
    const text = (replyInputs[suggestionId] || "").trim();
    if (!text) return;
    setSendingReply(true);
    await supabase.from("suggestion_replies").insert({
      suggestion_id: suggestionId,
      author_id: userId,
      message: text,
    });
    setReplyInputs((prev) => ({ ...prev, [suggestionId]: "" }));
    setReplyingTo(null);
    setSendingReply(false);
    fetchSuggestions();
  };

  const handleDeleteReply = async (id: string) => {
    await supabase.from("suggestion_replies").delete().eq("id", id);
    fetchSuggestions();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  };

  const activeSuggestions = suggestions.filter((s) => !s.handled_at);
  const handledSuggestions = suggestions.filter((s) => !!s.handled_at);

  const renderSuggestion = (s: Suggestion, isHandled: boolean) => {
    const suggestionReplies = replies.filter((r) => r.suggestion_id === s.id);
    return (
      <div key={s.id} className={`bg-secondary rounded-lg p-3 space-y-2 ${isHandled ? "opacity-80" : ""}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-primary">
            {nicknames[s.user_id] || "Okänd"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{formatDate(s.created_at)}</span>
            {isAdmin && !isHandled && (
              <button
                onClick={() => handleMarkHandled(s.id)}
                className="p-1 text-success hover:opacity-70 transition-opacity"
                title="Markera som hanterad"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {isAdmin && isHandled && (
              <button
                onClick={() => handleUnmarkHandled(s.id)}
                className="p-1 text-muted-foreground hover:text-foreground transition-opacity"
                title="Ångra hanterad"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
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

        {isHandled && s.handled_by && (
          <p className="text-[10px] text-success flex items-center gap-1">
            <Check className="w-3 h-3" />
            Hanterad av {nicknames[s.handled_by] || "Admin"} · {s.handled_at ? formatDate(s.handled_at) : ""}
          </p>
        )}

        {/* Replies */}
        {suggestionReplies.length > 0 && (
          <div className="space-y-1.5 pl-3 border-l-2 border-primary/30 mt-2">
            {suggestionReplies.map((r) => (
              <div key={r.id} className="bg-primary/5 rounded-md px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {nicknames[r.author_id] || "Admin"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{formatDate(r.created_at)}</span>
                    {isAdmin && (
                      <button onClick={() => handleDeleteReply(r.id)} className="p-0.5 text-destructive hover:opacity-70">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-foreground mt-0.5">{r.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Admin reply input */}
        {isAdmin && (
          replyingTo === s.id ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={replyInputs[s.id] || ""}
                onChange={(e) => setReplyInputs((prev) => ({ ...prev, [s.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleReply(s.id)}
                placeholder="Skriv svar..."
                className="flex-1 bg-background text-foreground text-xs p-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                autoFocus
              />
              <button
                onClick={() => handleReply(s.id)}
                disabled={!(replyInputs[s.id] || "").trim() || sendingReply}
                className="p-2 bg-primary text-primary-foreground rounded-md disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setReplyingTo(null)} className="text-xs text-muted-foreground">
                Avbryt
              </button>
            </div>
          ) : (
            <button
              onClick={() => setReplyingTo(s.id)}
              className="text-[11px] text-primary hover:underline mt-1"
            >
              Svara
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary">
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

      {/* Active suggestions */}
      {activeSuggestions.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Inskickade förslag</h4>
          {activeSuggestions.map((s) => renderSuggestion(s, false))}
        </div>
      )}

      {/* Handled suggestions archive */}
      {handledSuggestions.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Hanterade förslag ({handledSuggestions.length})</span>
            {showArchive ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showArchive && (
            <div className="space-y-2 animate-fade-in">
              {handledSuggestions.map((s) => renderSuggestion(s, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuggestionBox;
