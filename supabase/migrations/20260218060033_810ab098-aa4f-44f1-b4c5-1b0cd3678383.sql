
-- Add notification tracking to avoid duplicate emails
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS notified_3_days BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notified_1_day BOOLEAN DEFAULT false;
