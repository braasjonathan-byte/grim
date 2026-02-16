import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const GRIM_AVATAR = "https://gnhbkevtoajzdpsengki.supabase.co/storage/v1/object/public/avatars/25c48738-eb8e-4180-8755-034d01dc5ccc/avatar.jpg";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatButtonProps {
  userId: string;
  currentWeek?: number;
  onActionsExecuted?: () => void;
}

const AIChatButton = ({ userId, currentWeek = 1, onActionsExecuted }: AIChatButtonProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Draggable button state
  const btnRef = useRef<HTMLDivElement>(null);
  const [btnPos, setBtnPos] = useState<{ x: number; y: number }>(() => ({
    x: window.innerWidth - 72,
    y: window.innerHeight - 160,
  }));
  const dragging = useRef(false);
  const dragStart = useRef({ px: 0, py: 0, bx: 0, by: 0 });
  const didMove = useRef(false);
  const btnSize = 56;
  const edgePad = 8;

  // Keep button in bounds on resize
  useEffect(() => {
    const onResize = () => setBtnPos(prev => {
      const maxX = window.innerWidth - btnSize - edgePad;
      const maxY = window.innerHeight - btnSize - edgePad;
      return {
        x: Math.max(edgePad, Math.min(prev.x, maxX)),
        y: Math.max(edgePad, Math.min(prev.y, maxY)),
      };
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const snapToEdge = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - btnSize - edgePad;
    const maxY = window.innerHeight - btnSize - edgePad;
    const cy = Math.max(edgePad, Math.min(y, maxY));
    const snapX = x < window.innerWidth / 2 ? edgePad : maxX;
    return { x: snapX, y: cy };
  }, []);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      didMove.current = false;
      const rect = el.getBoundingClientRect();
      dragStart.current = { px: e.clientX, py: e.clientY, bx: rect.left, by: rect.top };
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.px;
      const dy = e.clientY - dragStart.current.py;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didMove.current = true;
      const nx = dragStart.current.bx + dx;
      const ny = dragStart.current.by + dy;
      const maxX = window.innerWidth - btnSize - edgePad;
      const maxY = window.innerHeight - btnSize - edgePad;
      setBtnPos({
        x: Math.max(edgePad, Math.min(nx, maxX)),
        y: Math.max(edgePad, Math.min(ny, maxY)),
      });
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setBtnPos(prev => snapToEdge(prev.x, prev.y));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [snapToEdge]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workout-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            currentWeek,
          }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Fel ${resp.status}`);
      }

      const data = await resp.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);

      if (data.actions_executed && onActionsExecuted) {
        onActionsExecuted();
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${e.message || "Något gick fel"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, currentWeek, onActionsExecuted]);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <div
          ref={btnRef as any}
          onClick={() => { if (!didMove.current) setOpen(true); }}
          role="button"
          tabIndex={0}
          style={{
            left: btnPos.x,
            top: btnPos.y,
            touchAction: "none",
          }}
          className="fixed z-50 w-14 h-14 rounded-full overflow-hidden cursor-grab active:cursor-grabbing select-none border-none shadow-none outline-none ring-0 p-0"
          aria-label="Öppna Grim AI"
        >
          <img src={GRIM_AVATAR} alt="Grim" className="w-full h-full object-cover block scale-[1.15]" draggable={false} />
          <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.5)]" />
        </div>
      )}

      {/* Chat popup - Messenger style */}
      {open && (
        <div className="fixed bottom-20 right-3 z-50 w-[calc(100vw-1.5rem)] max-w-sm h-[28rem] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <img src={GRIM_AVATAR} alt="Grim" className="w-8 h-8 rounded-full object-cover ring-1 ring-primary/30" />
              <div>
                <span className="font-bold text-sm block leading-tight">Grim</span>
                <span className="text-[10px] text-muted-foreground">AI-assistent · Vecka {currentWeek}</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-8 space-y-3">
                <img src={GRIM_AVATAR} alt="Grim" className="w-16 h-16 rounded-full mx-auto object-cover ring-2 ring-primary/20" />
                <p className="font-medium text-foreground">Hej! Jag är Grim.</p>
                <p className="text-xs">Jag kan hjälpa dig med ditt träningsschema.</p>
                <div className="text-xs space-y-1.5 mt-2">
                  <p>💪 "Lägg till bänkpress 3×10 80kg på tisdag"</p>
                  <p>🗑️ "Ta bort knäböj från onsdag"</p>
                  <p>✏️ "Ändra vikten på marklyft till 120kg"</p>
                  <p>💡 "Föreslå en bra ryggövning"</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex items-end gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <img src={GRIM_AVATAR} alt="Grim" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-0.5" />
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-end gap-2">
                <img src={GRIM_AVATAR} alt="Grim" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-0.5" />
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-4 py-3 bg-background">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Skriv till Grim..."
                className="flex-1 bg-muted text-foreground rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatButton;
