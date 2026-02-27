
-- Chat messages table supporting text and shared workouts
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text,
  message_type text NOT NULL DEFAULT 'text',
  shared_workout jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received (only if friends)
CREATE POLICY "Users can read own messages"
ON public.chat_messages FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Users can send messages only to friends
CREATE POLICY "Users can send messages to friends"
ON public.chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = chat_messages.receiver_id)
      OR (f.friend_id = auth.uid() AND f.user_id = chat_messages.receiver_id)
    )
  )
);

-- Users can update messages they received (for marking as read)
CREATE POLICY "Users can mark received messages as read"
ON public.chat_messages FOR UPDATE
USING (auth.uid() = receiver_id);

-- Users can delete own messages
CREATE POLICY "Users can delete own messages"
ON public.chat_messages FOR DELETE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Indexes for performance
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver ON public.chat_messages(receiver_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
