
-- Create table for multiple images per social post
CREATE TABLE public.social_post_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_post_images ENABLE ROW LEVEL SECURITY;

-- Everyone can view images on posts they can see
CREATE POLICY "Anyone can view post images"
  ON public.social_post_images
  FOR SELECT
  USING (true);

-- Only the post owner can insert images
CREATE POLICY "Post owner can insert images"
  ON public.social_post_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.social_posts
      WHERE id = post_id AND user_id = auth.uid()
    )
  );

-- Only the post owner can delete images
CREATE POLICY "Post owner can delete images"
  ON public.social_post_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.social_posts
      WHERE id = post_id AND user_id = auth.uid()
    )
  );

-- Index for fast lookup by post
CREATE INDEX idx_social_post_images_post_id ON public.social_post_images(post_id, sort_order);
