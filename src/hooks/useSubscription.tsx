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
   is_trial?: boolean;
   trial_ends_at?: string | null;
   days_remaining?: number;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [fetchCount, setFetchCount] = useState(0);

  const refetch = () => setFetchCount((c) => c + 1);

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
             is_trial,
             trial_ends_at,
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
           
           // Check if trial is still valid
           const isTrial = data.is_trial ?? false;
           const trialEndsAt = data.trial_ends_at;
           let isValidSubscription = true;
           let daysRemaining: number | undefined;
           
           if (isTrial && trialEndsAt) {
             const trialEnd = new Date(trialEndsAt);
             const now = new Date();
             isValidSubscription = trialEnd > now;
             daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
           }
           
          setSubscription({
            id: data.id,
            status: data.status,
            tier_id: data.tier_id,
            tier_name: tierData?.name,
            scans_used_this_month: data.scans_used_this_month,
            max_scans_per_month: tierData?.max_scans_per_month ?? null,
            billing_period_end: data.billing_period_end,
             is_trial: isTrial,
             trial_ends_at: trialEndsAt,
             days_remaining: daysRemaining,
          });
           setIsSubscribed(isValidSubscription);
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
