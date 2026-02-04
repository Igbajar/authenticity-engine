import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Subscription {
  id: string;
  status: string;
  tier_id: string;
  tier_name?: string;
  scans_used_this_month: number | null;
  max_scans_per_month: number | null;
  billing_period_end: string | null;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) {
        setSubscription(null);
        setIsSubscribed(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select(`
            id,
            status,
            tier_id,
            scans_used_this_month,
            billing_period_end,
            subscription_tiers (
              name,
              max_scans_per_month
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (error) {
          console.error('Error fetching subscription:', error);
          setSubscription(null);
          setIsSubscribed(false);
        } else if (data) {
          const tierData = data.subscription_tiers as { name: string; max_scans_per_month: number | null } | null;
          setSubscription({
            id: data.id,
            status: data.status,
            tier_id: data.tier_id,
            tier_name: tierData?.name,
            scans_used_this_month: data.scans_used_this_month,
            max_scans_per_month: tierData?.max_scans_per_month ?? null,
            billing_period_end: data.billing_period_end,
          });
          setIsSubscribed(true);
        } else {
          setSubscription(null);
          setIsSubscribed(false);
        }
      } catch (err) {
        console.error('Subscription fetch error:', err);
        setSubscription(null);
        setIsSubscribed(false);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  return { subscription, loading, isSubscribed };
};
