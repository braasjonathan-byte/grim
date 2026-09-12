import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ToolLayoutOrder {
  /** Ordning på grupper (grupp-id) */
  groups: string[];
  /** Ordning på kort inom varje grupp */
  items: Record<string, string[]>;
}

const EMPTY: ToolLayoutOrder = { groups: [], items: {} };

const parse = (value: unknown): ToolLayoutOrder => {
  if (Array.isArray(value)) return { groups: value.filter((v) => typeof v === "string"), items: {} };
  if (value && typeof value === "object") {
    const v = value as { groups?: unknown; items?: unknown };
    return {
      groups: Array.isArray(v.groups) ? v.groups.filter((x): x is string => typeof x === "string") : [],
      items:
        v.items && typeof v.items === "object" && !Array.isArray(v.items)
          ? Object.fromEntries(
              Object.entries(v.items as Record<string, unknown>).map(([k, arr]) => [
                k,
                Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [],
              ])
            )
          : {},
    };
  }
  return EMPTY;
};

/** Delad layout för Verktyg-fliken. Admins kan spara, alla läser samma ordning. */
export const useToolLayout = () => {
  const [order, setOrder] = useState<ToolLayoutOrder>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const rowId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tool_layout")
        .select("id, section_order")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        rowId.current = data.id;
        setOrder(parse(data.section_order));
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: ToolLayoutOrder) => {
    setOrder(next);
    const payload = { section_order: next as unknown as never, updated_at: new Date().toISOString() };
    if (rowId.current) {
      const { error } = await supabase.from("tool_layout").update(payload).eq("id", rowId.current);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("tool_layout").insert(payload).select("id").single();
      if (error) throw error;
      rowId.current = data.id;
    }
  }, []);

  return { order, loaded, save };
};

/** Sorterar listan efter sparad ordning; okända poster hamnar sist i sin ursprungliga ordning. */
export const applyOrder = <T extends { id: string }>(list: T[], ids: string[]): T[] => {
  if (!ids.length) return list;
  const index = new Map(ids.map((id, i) => [id, i]));
  return [...list].sort((a, b) => (index.get(a.id) ?? 999) - (index.get(b.id) ?? 999));
};

export const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
