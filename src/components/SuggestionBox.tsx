import { useState } from "react";
import { MessageSquarePlus, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SuggestionBoxProps {
  userId: string;
}

const SuggestionBox = ({ userId }: SuggestionBoxProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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
      setTimeout(() => setSent(false), 3000);
    }
    setSending(false);
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
    </div>
  );
};

export default SuggestionBox;
