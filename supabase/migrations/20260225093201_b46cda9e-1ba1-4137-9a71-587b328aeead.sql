
-- Coupon type enum
CREATE TYPE public.coupon_type AS ENUM ('trial_extension', 'discount', 'free_subscription', 'extra_scans');

-- Coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  coupon_type coupon_type NOT NULL,
  description TEXT,
  -- trial_extension: days to add; discount: percentage (1-100); free_subscription: days of free tier; extra_scans: number of scans
  value INTEGER NOT NULL DEFAULT 0,
  -- For discount/free_subscription: which tier to apply to (null = any)
  tier_id UUID REFERENCES public.subscription_tiers(id),
  max_redemptions INTEGER, -- null = unlimited
  times_redeemed INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Redemption log
CREATE TABLE public.coupon_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id),
  user_id UUID NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);

-- RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Admins can manage coupons
CREATE POLICY "Admins can manage coupons"
  ON public.coupons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read active coupons (needed for validation)
CREATE POLICY "Users can read active coupons"
  ON public.coupons FOR SELECT
  USING (is_active = true);

-- Admins can view all redemptions
CREATE POLICY "Admins can view redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own redemptions
CREATE POLICY "Users can view own redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (user_id = auth.uid());

-- Service role inserts redemptions (via edge function)
CREATE POLICY "Service can insert redemptions"
  ON public.coupon_redemptions FOR INSERT
  WITH CHECK (true);
