import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSettings {
  app_name: string;
}

interface AppSettingsContextType {
  settings: AppSettings;
  loading: boolean;
  updateSetting: (key: string, value: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  app_name: 'R-Check',
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');

      if (error) throw error;

      if (data) {
        const settingsMap = data.reduce((acc, item) => {
          acc[item.key as keyof AppSettings] = item.value;
          return acc;
        }, {} as AppSettings);

        setSettings({ ...defaultSettings, ...settingsMap });
      }
    } catch (error) {
      console.error('Error fetching app settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) throw error;
    
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <AppSettingsContext.Provider value={{ settings, loading, updateSetting, refetch: fetchSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};
