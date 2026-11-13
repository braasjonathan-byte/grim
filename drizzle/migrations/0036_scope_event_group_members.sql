CREATE OR REPLACE FUNCTION public.is_event_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.event_group_members WHERE group_id = _group_id AND user_id = _user_id) $$;

CREATE OR REPLACE FUNCTION public.get_event_group_member_counts()
RETURNS TABLE(group_id uuid, member_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT m.group_id, count(*) FROM public.event_group_members m WHERE auth.uid() IS NOT NULL GROUP BY m.group_id $$;

REVOKE EXECUTE ON FUNCTION public.get_event_group_member_counts() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_event_group_member_counts() TO authenticated;

DROP POLICY "Members can read group members" ON public.event_group_members;
CREATE POLICY "Members can read group members" ON public.event_group_members
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_event_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));