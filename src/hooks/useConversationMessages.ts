import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mergeMessages, MESSAGE_PAGE_SIZE } from "@/lib/socialConversation";

export function useConversationMessages<T extends { id: string; created_at: string }>(userId: string, peerId: string, group = false) {
  const [messages, setMessages] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const oldest = useRef<T | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (older = false) => {
    const version = generation.current;
    setError(false);
    older ? setLoadingOlder(true) : setLoading(true);
    try {
      let query = supabase.from("chat_messages").select("*");
      query = group ? query.eq("group_id", peerId) : query.or(`and(sender_id.eq.${userId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${userId})`).is("group_id", null);
      const cursor = older ? oldest.current : null;
      if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
      const { data, error: readError } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(MESSAGE_PAGE_SIZE);
      if (readError) throw readError;
      if (version !== generation.current) return;
      const rows = (data || []) as unknown as T[];
      setMessages(previous => mergeMessages(previous, rows));
      oldest.current = rows.at(-1) ?? oldest.current;
      setHasOlder(rows.length === MESSAGE_PAGE_SIZE);
    } catch { if (version === generation.current) setError(true); }
    finally { if (version === generation.current) { setLoading(false); setLoadingOlder(false); } }
  }, [userId, peerId, group]);
  useEffect(() => {
    generation.current += 1;
    setMessages([]); oldest.current = null;
    void load();
    const channel = supabase.channel(`conversation-${group ? "group" : "direct"}-${userId}-${peerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, payload => {
        const row = payload.new as Record<string, unknown>;
        const matches = group ? row.group_id === peerId : !row.group_id && ((row.sender_id === userId && row.receiver_id === peerId) || (row.sender_id === peerId && row.receiver_id === userId));
        if (matches) setMessages(previous => mergeMessages(previous, [row as unknown as T]));
      }).subscribe();
    return () => { generation.current += 1; void supabase.removeChannel(channel); };
  }, [userId, peerId, group, load]);
  return { messages, setMessages, loading, loadingOlder, error, hasOlder, reload: () => load(), loadOlder: () => load(true) };
}