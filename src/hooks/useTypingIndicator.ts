import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight "typing…" signalling over Supabase Realtime broadcast.
 * Each user listens on their own channel (`typing:<myUserId>`), and senders
 * broadcast into the receiver's channel. No database writes involved.
 */

const TYPING_TTL_MS = 4000;
const THROTTLE_MS = 1500;

const channelName = (userId: string) => `typing:${userId}`;

/** Returns a set of user ids that are currently typing to me. */
export const useTypingListener = (userId?: string | null) => {
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(channelName(userId))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const from = (payload as any)?.from as string | undefined;
        if (!from) return;
        const typing = (payload as any)?.typing !== false;
        setTypingUsers((prev) => {
          if (!typing) {
            const { [from]: _drop, ...rest } = prev;
            return rest;
          }
          return { ...prev, [from]: Date.now() };
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Expire stale typing signals
  useEffect(() => {
    if (Object.keys(typingUsers).length === 0) return;
    const t = window.setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next = Object.fromEntries(
          Object.entries(prev).filter(([, at]) => now - at < TYPING_TTL_MS)
        );
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [typingUsers]);

  const isTyping = useCallback((id: string) => Boolean(typingUsers[id]), [typingUsers]);

  return { typingUsers, isTyping };
};

/** Returns a throttled `notifyTyping()` plus `stopTyping()` for a conversation. */
export const useTypingSender = (fromUserId?: string | null, toUserId?: string | null) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!toUserId) return;
    const channel = supabase.channel(channelName(toUserId));
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [toUserId]);

  const send = useCallback((typing: boolean) => {
    if (!channelRef.current || !fromUserId) return;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { from: fromUserId, typing },
    });
  }, [fromUserId]);

  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    lastSentRef.current = 0;
    send(false);
  }, [send]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current > THROTTLE_MS) {
      lastSentRef.current = now;
      send(true);
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(() => stopTyping(), TYPING_TTL_MS - 500);
  }, [send, stopTyping]);

  return { notifyTyping, stopTyping };
};
