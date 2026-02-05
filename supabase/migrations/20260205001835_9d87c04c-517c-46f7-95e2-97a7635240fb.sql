-- Add trial period fields to user_subscriptions
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- Create function to auto-create trial subscription for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_tier_id UUID;
BEGIN
  -- Get the free/basic tier (lowest price)
  SELECT id INTO free_tier_id 
  FROM public.subscription_tiers 
  WHERE is_active = true 
  ORDER BY price_monthly ASC 
  LIMIT 1;
  
  -- Create trial subscription (7 day trial)
  IF free_tier_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (
      user_id, 
      tier_id, 
      status, 
      is_trial,
      trial_ends_at,
      billing_period_start,
      billing_period_end
    ) VALUES (
      NEW.id,
      free_tier_id,
      'active',
      true,
      NOW() + INTERVAL '7 days',
      NOW(),
      NOW() + INTERVAL '7 days'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user trial
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();

-- Allow admins to insert subscriptions for any user
CREATE POLICY "Admins can insert subscriptions for users"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));