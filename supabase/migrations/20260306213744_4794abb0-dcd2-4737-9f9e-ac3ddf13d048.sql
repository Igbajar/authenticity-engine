
ALTER TABLE public.subscription_tiers
  ADD COLUMN IF NOT EXISTS price_hourly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_daily numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_weekly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_bi_annually numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly';
