
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tour_prompted boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  event_group_id uuid REFERENCES public.event_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_group_id)
);
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_chat_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_chat_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = _group_id AND user_id = _user_id AND role = 'admin');
$$;

CREATE POLICY "Members can read groups" ON public.chat_groups FOR SELECT TO authenticated
  USING (public.is_chat_group_member(id, auth.uid()));
CREATE POLICY "Authenticated can create groups" ON public.chat_groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update group" ON public.chat_groups FOR UPDATE TO authenticated
  USING (public.is_chat_group_admin(id, auth.uid()))
  WITH CHECK (public.is_chat_group_admin(id, auth.uid()));
CREATE POLICY "Creator can delete group" ON public.chat_groups FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Members can read members" ON public.chat_group_members FOR SELECT TO authenticated
  USING (public.is_chat_group_member(group_id, auth.uid()));
CREATE POLICY "Add members" ON public.chat_group_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_chat_group_admin(group_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.chat_groups cg
      JOIN public.event_group_members egm ON egm.group_id = cg.event_group_id
      WHERE cg.id = chat_group_members.group_id
        AND egm.user_id = auth.uid()
        AND chat_group_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_groups cg
      WHERE cg.id = chat_group_members.group_id AND cg.created_by = auth.uid()
    )
  );
CREATE POLICY "Leave or admin remove" ON public.chat_group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_chat_group_admin(group_id, auth.uid()));
CREATE POLICY "Update own last_read" ON public.chat_group_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.chat_groups(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ALTER COLUMN receiver_id DROP NOT NULL;

CREATE POLICY "Group members read messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (group_id IS NOT NULL AND public.is_chat_group_member(group_id, auth.uid()));
CREATE POLICY "Group members send messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND group_id IS NOT NULL AND public.is_chat_group_member(group_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.bump_chat_group_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    UPDATE public.chat_groups SET updated_at = now() WHERE id = NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chat_messages_bump_group ON public.chat_messages;
CREATE TRIGGER chat_messages_bump_group
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_chat_group_on_message();

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_members;
