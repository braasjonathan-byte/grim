
-- Support messages table for Grim support chat
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_from_admin boolean NOT NULL DEFAULT false,
  admin_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own support messages
CREATE POLICY "Users can read own support messages"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own messages (not admin messages)
CREATE POLICY "Users can insert own support messages"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_from_admin = false);

-- Users can mark messages as read
CREATE POLICY "Users can update read status"
  ON public.support_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all support messages
CREATE POLICY "Admins can read all support messages"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can insert replies (as Grim)
CREATE POLICY "Admins can insert replies"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND is_from_admin = true);

-- Admins can update messages
CREATE POLICY "Admins can update support messages"
  ON public.support_messages FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Deny anon
CREATE POLICY "Deny anon support messages"
  ON public.support_messages FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Enable realtime for support messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
