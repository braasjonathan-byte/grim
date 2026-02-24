
-- Fix RLS: Allow friends to see all comments on a friend's workouts
DROP POLICY IF EXISTS "Users can read relevant comments" ON public.workout_comments;

CREATE POLICY "Users can read relevant comments"
ON public.workout_comments
FOR SELECT
USING (
  auth.uid() = target_user_id
  OR auth.uid() = author_id
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = workout_comments.target_user_id)
      OR (f.friend_id = auth.uid() AND f.user_id = workout_comments.target_user_id)
    )
  )
);

-- Create workout_likes table
CREATE TABLE public.workout_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  week integer NOT NULL,
  day text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_user_id, week, day)
);

ALTER TABLE public.workout_likes ENABLE ROW LEVEL SECURITY;

-- Users can see likes on their own workouts and friends' workouts
CREATE POLICY "Users can read likes on own and friends workouts"
ON public.workout_likes
FOR SELECT
USING (
  auth.uid() = target_user_id
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = workout_likes.target_user_id)
      OR (f.friend_id = auth.uid() AND f.user_id = workout_likes.target_user_id)
    )
  )
);

-- Users can like friends' workouts
CREATE POLICY "Users can insert likes on friends workouts"
ON public.workout_likes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    auth.uid() = target_user_id
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
      AND (
        (f.user_id = auth.uid() AND f.friend_id = workout_likes.target_user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = workout_likes.target_user_id)
      )
    )
  )
);

-- Users can delete own likes
CREATE POLICY "Users can delete own likes"
ON public.workout_likes
FOR DELETE
USING (auth.uid() = user_id);
