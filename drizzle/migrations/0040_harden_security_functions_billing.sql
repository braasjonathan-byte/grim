-- Billing customer id can only be written by the server
CREATE OR REPLACE FUNCTION public.protect_stripe_customer_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), 'service_role') <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.stripe_customer_id := NULL;
    ELSE
      NEW.stripe_customer_id := OLD.stripe_customer_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_stripe_customer_id ON public.user_emails;
CREATE TRIGGER protect_stripe_customer_id BEFORE INSERT OR UPDATE ON public.user_emails
FOR EACH ROW EXECUTE FUNCTION public.protect_stripe_customer_id();

-- Avatar items only via purchase_avatar_item
DROP POLICY IF EXISTS "Users can insert own items" ON public.avatar_owned_items;

-- Helper functions only answer about the caller (or server contexts)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (_user_id = auth.uid() OR coalesce(auth.role(), 'service_role') = 'service_role')
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.are_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IN (_a, _b) OR coalesce(auth.role(), 'service_role') = 'service_role')
    AND EXISTS (SELECT 1 FROM public.friendships WHERE status = 'blocked'
      AND ((user_id = _a AND friend_id = _b) OR (user_id = _b AND friend_id = _a)));
$$;
CREATE OR REPLACE FUNCTION public.is_challenge_participant(_challenge_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (_user_id = auth.uid() OR coalesce(auth.role(), 'service_role') = 'service_role')
    AND EXISTS (SELECT 1 FROM public.friend_challenge_participants p WHERE p.challenge_id = _challenge_id AND p.user_id = _user_id);
$$;
CREATE OR REPLACE FUNCTION public.is_chat_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (_user_id = auth.uid() OR coalesce(auth.role(), 'service_role') = 'service_role')
    AND EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = _group_id AND user_id = _user_id AND role = 'admin');
$$;
CREATE OR REPLACE FUNCTION public.is_chat_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (_user_id = auth.uid() OR coalesce(auth.role(), 'service_role') = 'service_role')
    AND EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

-- Member counts only for groups the caller belongs to, created, or administers
CREATE OR REPLACE FUNCTION public.get_event_group_member_counts()
RETURNS TABLE(group_id uuid, member_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.group_id, count(*) FROM public.event_group_members m
  WHERE auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.event_group_members me WHERE me.group_id = m.group_id AND me.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_groups g WHERE g.id = m.group_id AND g.created_by = auth.uid()))
  GROUP BY m.group_id
$$;

-- Server-only nudge lookup
REVOKE EXECUTE ON FUNCTION public.get_inactive_users_for_nudge(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_inactive_users_for_nudge(timestamptz) TO service_role;