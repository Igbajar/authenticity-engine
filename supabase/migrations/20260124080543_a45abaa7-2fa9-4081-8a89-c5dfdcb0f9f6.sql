-- Create enum for user roles (following security best practices - separate table)
CREATE TYPE public.app_role AS ENUM ('user', 'teacher', 'admin');

-- Create user_roles table (CRITICAL: roles stored separately for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Subscription tiers table
CREATE TABLE public.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_scans_per_month INTEGER,
  max_words_per_scan INTEGER DEFAULT 25000,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on subscription_tiers
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active subscription tiers
CREATE POLICY "Anyone can view active tiers"
ON public.subscription_tiers
FOR SELECT
USING (is_active = true);

-- Only admins can manage tiers
CREATE POLICY "Admins can manage tiers"
ON public.subscription_tiers
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- User subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier_id UUID REFERENCES public.subscription_tiers(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  scans_used_this_month INTEGER DEFAULT 0,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  billing_period_end TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_subscriptions
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view their own subscription"
ON public.user_subscriptions
FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own subscription
CREATE POLICY "Users can update their own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (user_id = auth.uid());

-- System can insert subscriptions
CREATE POLICY "System can insert subscriptions"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions"
ON public.user_subscriptions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Document comparisons table
CREATE TABLE public.document_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_a_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  document_b_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  similarity_score NUMERIC(5,2),
  matching_sections JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on document_comparisons
ALTER TABLE public.document_comparisons ENABLE ROW LEVEL SECURITY;

-- Users can view their own comparisons
CREATE POLICY "Users can view their own comparisons"
ON public.document_comparisons
FOR SELECT
USING (user_id = auth.uid());

-- Users can create comparisons
CREATE POLICY "Users can create comparisons"
ON public.document_comparisons
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own comparisons
CREATE POLICY "Users can update their own comparisons"
ON public.document_comparisons
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own comparisons
CREATE POLICY "Users can delete their own comparisons"
ON public.document_comparisons
FOR DELETE
USING (user_id = auth.uid());

-- Citations table for detected citations
CREATE TABLE public.citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES public.scans(id) ON DELETE CASCADE NOT NULL,
  citation_text TEXT NOT NULL,
  citation_type TEXT NOT NULL CHECK (citation_type IN ('apa', 'mla', 'chicago', 'harvard', 'ieee', 'unknown')),
  author TEXT,
  title TEXT,
  year TEXT,
  source TEXT,
  url TEXT,
  is_valid BOOLEAN DEFAULT false,
  position_start INTEGER,
  position_end INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on citations
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

-- Users can view citations for their scans
CREATE POLICY "Users can view their scan citations"
ON public.citations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.scans
  WHERE scans.id = citations.scan_id
  AND scans.user_id = auth.uid()
));

-- System can insert citations
CREATE POLICY "System can insert citations"
ON public.citations
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.scans
  WHERE scans.id = citations.scan_id
  AND scans.user_id = auth.uid()
));

-- Bibliography table for generated bibliographies
CREATE TABLE public.bibliographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES public.scans(id) ON DELETE CASCADE NOT NULL UNIQUE,
  format TEXT NOT NULL DEFAULT 'apa' CHECK (format IN ('apa', 'mla', 'chicago', 'harvard', 'ieee')),
  entries JSONB DEFAULT '[]'::jsonb,
  generated_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bibliographies
ALTER TABLE public.bibliographies ENABLE ROW LEVEL SECURITY;

-- Users can view their bibliographies
CREATE POLICY "Users can view their bibliographies"
ON public.bibliographies
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.scans
  WHERE scans.id = bibliographies.scan_id
  AND scans.user_id = auth.uid()
));

-- System can insert bibliographies
CREATE POLICY "System can insert bibliographies"
ON public.bibliographies
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.scans
  WHERE scans.id = bibliographies.scan_id
  AND scans.user_id = auth.uid()
));

-- System can update bibliographies
CREATE POLICY "Users can update their bibliographies"
ON public.bibliographies
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.scans
  WHERE scans.id = bibliographies.scan_id
  AND scans.user_id = auth.uid()
));

-- Insert default subscription tiers
INSERT INTO public.subscription_tiers (name, description, price_monthly, price_yearly, max_scans_per_month, max_words_per_scan, features) VALUES
('Free', 'Basic plagiarism checking for individuals', 0, 0, 5, 5000, '["Basic plagiarism detection", "AI content detection", "5 scans per month"]'::jsonb),
('Pro', 'Advanced features for students and professionals', 9.99, 99.99, 50, 25000, '["Advanced plagiarism detection", "AI content detection", "Citation detection", "Bibliography generation", "50 scans per month", "Priority support"]'::jsonb),
('University', 'Enterprise solution for academic institutions', 49.99, 499.99, NULL, 50000, '["Unlimited scans", "Document comparison", "Class management", "Batch uploads", "Analytics dashboard", "API access", "Dedicated support"]'::jsonb);

-- Function to assign default role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign role on user creation
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Add trigger for updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on bibliographies
CREATE TRIGGER update_bibliographies_updated_at
  BEFORE UPDATE ON public.bibliographies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();