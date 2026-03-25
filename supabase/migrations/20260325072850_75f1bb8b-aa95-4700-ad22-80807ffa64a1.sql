
-- Social posts table
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text,
  caption text,
  visibility text NOT NULL DEFAULT 'public',
  group_id uuid,
  workout_week integer,
  workout_day text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- Event groups (auto-created for popular events, or manual)
CREATE TABLE public.event_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_date date,
  event_end_date date,
  event_type text NOT NULL DEFAULT 'annat',
  popular_event_id uuid REFERENCES public.popular_events(id),
  created_by uuid,
  is_auto boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.event_groups ENABLE ROW LEVEL SECURITY;

-- Event group members
CREATE TABLE public.event_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.event_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.event_group_members ENABLE ROW LEVEL SECURITY;

-- Social post likes
CREATE TABLE public.social_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;

-- RLS for social_posts
CREATE POLICY "Users can read public posts" ON public.social_posts FOR SELECT TO authenticated USING (
  visibility = 'public' OR
  user_id = auth.uid() OR
  (visibility = 'group' AND group_id IN (SELECT group_id FROM public.event_group_members WHERE user_id = auth.uid())) OR
  (EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.user_id = auth.uid() AND f.friend_id = social_posts.user_id) OR (f.friend_id = auth.uid() AND f.user_id = social_posts.user_id))))
);
CREATE POLICY "Users can insert own posts" ON public.social_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.social_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Deny anon social_posts" ON public.social_posts FOR ALL TO anon USING (false) WITH CHECK (false);

-- RLS for event_groups
CREATE POLICY "Authenticated can read groups" ON public.event_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create groups" ON public.event_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by OR is_auto = true);
CREATE POLICY "Admins can manage groups" ON public.event_groups FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Deny anon event_groups" ON public.event_groups FOR ALL TO anon USING (false) WITH CHECK (false);

-- RLS for event_group_members
CREATE POLICY "Members can read group members" ON public.event_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON public.event_group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.event_group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Deny anon group_members" ON public.event_group_members FOR ALL TO anon USING (false) WITH CHECK (false);

-- RLS for social_post_likes
CREATE POLICY "Authenticated can read likes" ON public.social_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like posts" ON public.social_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.social_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Deny anon likes" ON public.social_post_likes FOR ALL TO anon USING (false) WITH CHECK (false);

-- Storage bucket for social images
INSERT INTO storage.buckets (id, name, public) VALUES ('social-images', 'social-images', true);

-- Storage policies for social-images
CREATE POLICY "Authenticated can upload social images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'social-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can read social images" ON storage.objects FOR SELECT USING (bucket_id = 'social-images');
CREATE POLICY "Users can delete own social images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'social-images' AND (storage.foldername(name))[1] = auth.uid()::text);
