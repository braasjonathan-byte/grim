import { supabase } from "@/integrations/supabase/client";

export interface ChatGroup {
  id: string;
  name: string;
  created_by: string;
  event_group_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new chat group with the given member user_ids.
 * Creator is automatically added as admin.
 */
export async function createChatGroup(name: string, memberUserIds: string[]): Promise<ChatGroup | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data: group, error } = await supabase
    .from("chat_groups")
    .insert({ name: name.trim(), created_by: uid })
    .select()
    .single();
  if (error || !group) return null;

  const members = [
    { group_id: group.id, user_id: uid, role: "admin" },
    ...memberUserIds
      .filter((id) => id !== uid)
      .map((id) => ({ group_id: group.id, user_id: id, role: "member" })),
  ];
  await supabase.from("chat_group_members").insert(members);
  return group as ChatGroup;
}

/**
 * Ensure a chat group exists for an event group. Creates one if missing,
 * and ensures the current user is a member.
 */
export async function ensureEventGroupChat(eventGroupId: string, eventName: string): Promise<ChatGroup | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  // Try to find existing
  const { data: existing } = await supabase
    .from("chat_groups")
    .select("*")
    .eq("event_group_id", eventGroupId)
    .maybeSingle();

  let group = existing as ChatGroup | null;

  if (!group) {
    const { data: created, error } = await supabase
      .from("chat_groups")
      .insert({ name: eventName, created_by: uid, event_group_id: eventGroupId })
      .select()
      .single();
    if (error || !created) return null;
    group = created as ChatGroup;
    // Add creator as admin
    await supabase
      .from("chat_group_members")
      .insert({ group_id: group.id, user_id: uid, role: "admin" });
  }

  // Ensure current user is a member (event-group members can self-join via RLS)
  const { data: existingMember } = await supabase
    .from("chat_group_members")
    .select("id")
    .eq("group_id", group.id)
    .eq("user_id", uid)
    .maybeSingle();

  if (!existingMember) {
    await supabase
      .from("chat_group_members")
      .insert({ group_id: group.id, user_id: uid, role: "member" });
  }

  return group;
}
