
-- Add protein_bars balance to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS protein_bars integer NOT NULL DEFAULT 0;

-- Avatar configuration per user
CREATE TABLE public.avatar_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  body_height text NOT NULL DEFAULT 'medium',
  body_fat text NOT NULL DEFAULT 'medium',
  muscle_mass text NOT NULL DEFAULT 'medium',
  skin_color text NOT NULL DEFAULT '#C68642',
  hair_style text NOT NULL DEFAULT 'short',
  hair_color text NOT NULL DEFAULT '#3B2F2F',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avatar_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own avatar config" ON public.avatar_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own avatar config" ON public.avatar_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own avatar config" ON public.avatar_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Friends can read avatar config" ON public.avatar_config FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND ((f.user_id = auth.uid() AND f.friend_id = avatar_config.user_id) OR (f.friend_id = auth.uid() AND f.user_id = avatar_config.user_id))
  )
);
CREATE POLICY "Admins can read all avatar configs" ON public.avatar_config FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Shop items (admin-managed catalog)
CREATE TABLE public.avatar_shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('shoes', 'pants', 'shirt', 'hat')),
  price integer NOT NULL DEFAULT 1,
  style_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avatar_shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active shop items" ON public.avatar_shop_items FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage shop items" ON public.avatar_shop_items FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Owned items (user inventory)
CREATE TABLE public.avatar_owned_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.avatar_shop_items(id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE public.avatar_owned_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own items" ON public.avatar_owned_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own items" ON public.avatar_owned_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Friends can read items" ON public.avatar_owned_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND ((f.user_id = auth.uid() AND f.friend_id = avatar_owned_items.user_id) OR (f.friend_id = auth.uid() AND f.user_id = avatar_owned_items.user_id))
  )
);
CREATE POLICY "Admins can read all owned items" ON public.avatar_owned_items FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Equipped items (what the avatar is wearing)
CREATE TABLE public.avatar_equipped_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.avatar_shop_items(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('shoes', 'pants', 'shirt', 'hat')),
  UNIQUE(user_id, slot)
);

ALTER TABLE public.avatar_equipped_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own equipped" ON public.avatar_equipped_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own equipped" ON public.avatar_equipped_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own equipped" ON public.avatar_equipped_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own equipped" ON public.avatar_equipped_items FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Friends can read equipped" ON public.avatar_equipped_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
    AND ((f.user_id = auth.uid() AND f.friend_id = avatar_equipped_items.user_id) OR (f.friend_id = auth.uid() AND f.user_id = avatar_equipped_items.user_id))
  )
);
CREATE POLICY "Admins can read all equipped" ON public.avatar_equipped_items FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Function to purchase an item (atomic: check balance, deduct, add to inventory)
CREATE OR REPLACE FUNCTION public.purchase_avatar_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price integer;
  v_balance integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  -- Check if already owned
  IF EXISTS (SELECT 1 FROM avatar_owned_items WHERE user_id = auth.uid() AND item_id = p_item_id) THEN
    RETURN false;
  END IF;

  -- Get price
  SELECT price INTO v_price FROM avatar_shop_items WHERE id = p_item_id AND is_active = true;
  IF v_price IS NULL THEN RETURN false; END IF;

  -- Get balance
  SELECT protein_bars INTO v_balance FROM profiles WHERE user_id = auth.uid();
  IF v_balance < v_price THEN RETURN false; END IF;

  -- Deduct and add
  UPDATE profiles SET protein_bars = protein_bars - v_price WHERE user_id = auth.uid();
  INSERT INTO avatar_owned_items (user_id, item_id) VALUES (auth.uid(), p_item_id);

  RETURN true;
END;
$$;

-- Function to award protein bar on workout completion
CREATE OR REPLACE FUNCTION public.award_protein_bar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.done = true AND (OLD.done IS NULL OR OLD.done = false) THEN
    -- Only award if the workout plan has actual exercises
    IF EXISTS (
      SELECT 1 FROM workout_plans wp
      WHERE wp.user_id = NEW.user_id AND wp.week = NEW.week AND wp.day = NEW.day
      AND wp.details IS NOT NULL AND TRIM(wp.details) != ''
    ) THEN
      UPDATE profiles SET protein_bars = protein_bars + 1 WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER award_protein_bar_on_completion
  AFTER INSERT OR UPDATE ON public.workout_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_protein_bar();

-- Triggers for updated_at
CREATE TRIGGER update_avatar_config_updated_at BEFORE UPDATE ON public.avatar_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_avatar_shop_items_updated_at BEFORE UPDATE ON public.avatar_shop_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
