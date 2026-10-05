ALTER TABLE public.friend_challenge_participants ADD COLUMN status text NOT NULL DEFAULT 'accepted';
ALTER TABLE public.friend_challenge_participants ADD COLUMN invited_by uuid;
GRANT UPDATE ON public.friend_challenge_participants TO authenticated;
CREATE POLICY "Self can accept invite" ON public.friend_challenge_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND status IN ('accepted','pending'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_challenge_participants;