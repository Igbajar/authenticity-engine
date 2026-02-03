-- Create app_settings table for admin-configurable settings
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read app settings
CREATE POLICY "App settings are publicly readable"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- Only admins can update settings
CREATE POLICY "Only admins can update app settings"
  ON public.app_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can insert settings
CREATE POLICY "Only admins can insert app settings"
  ON public.app_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Insert default app name
INSERT INTO public.app_settings (key, value, description)
VALUES ('app_name', 'R-Check', 'The display name of the application');

-- Enable realtime for scans table to support real-time progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.scans;