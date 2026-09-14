CREATE TABLE public.friend_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  metric text NOT NULL DEFAULT 'pass',
  target numeric,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.friend_challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.friend_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_friend_challenge_participants_user ON public.friend_challenge_participants(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_challenges TO authenticated;
GRANT ALL ON public.friend_challenges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_challenge_participants TO authenticated;
GRANT ALL ON public.friend_challenge_participants TO service_role;

CREATE OR REPLACE FUNCTION public.is_challenge_participant(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friend_challenge_participants p
    WHERE p.challenge_id = _challenge_id AND p.user_id = _user_id
  );
$$;

ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and creator can read challenges"
ON public.friend_challenges FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.is_challenge_participant(id, auth.uid()));

CREATE POLICY "Users can create challenges"
ON public.friend_challenges FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update challenges"
ON public.friend_challenges FOR UPDATE TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can delete challenges"
ON public.friend_challenges FOR DELETE TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Participants can read participant rows"
ON public.friend_challenge_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_challenge_participant(challenge_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.friend_challenges c WHERE c.id = challenge_id AND c.created_by = auth.uid())
);

CREATE POLICY "Creator or self can add participants"
ON public.friend_challenge_participants FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.friend_challenges c WHERE c.id = challenge_id AND c.created_by = auth.uid())
);

CREATE POLICY "Self or creator can remove participants"
ON public.friend_challenge_participants FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.friend_challenges c WHERE c.id = challenge_id AND c.created_by = auth.uid())
);
