import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crown, Calendar, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SubData {
  status: string;
  is_trial: boolean | null;
  trial_ends_at: string | null;
  billing_period_end: string | null;
  scans_used_this_month: number | null;
  tier: {
    name: string;
    max_scans_per_month: number | null;
    price_monthly: number;
  } | null;
}

const SubscriptionStatusCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select(`
          status,
          is_trial,
          trial_ends_at,
          billing_period_end,
          scans_used_this_month,
          subscription_tiers (
            name,
            max_scans_per_month,
            price_monthly
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (data) {
        const tier = data.subscription_tiers as unknown as SubData["tier"];
        setSub({ ...data, tier });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
        <div className="h-5 w-32 bg-muted rounded mb-3" />
        <div className="h-8 w-20 bg-muted rounded" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground mb-3">No active subscription</p>
        <Button size="sm" onClick={() => navigate("/subscribe")}>
          <Crown className="w-4 h-4 mr-2" />
          Subscribe
        </Button>
      </div>
    );
  }

  const isTrial = sub.is_trial;
  const daysLeft = sub.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : sub.billing_period_end
    ? Math.max(0, Math.ceil((new Date(sub.billing_period_end).getTime() - Date.now()) / 86400000))
    : null;

  const scansUsed = sub.scans_used_this_month ?? 0;
  const scansMax = sub.tier?.max_scans_per_month;
  const scansPercent = scansMax ? Math.min(100, (scansUsed / scansMax) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-accent" />
          <h3 className="font-serif text-lg text-foreground">Subscription</h3>
        </div>
        {isTrial && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-warning/10 text-warning font-medium">
            Trial
          </span>
        )}
        {!isTrial && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">
            Active
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-serif text-foreground">{sub.tier?.name ?? "Unknown"}</p>
        {sub.tier?.price_monthly ? (
          <p className="text-sm text-muted-foreground">${sub.tier.price_monthly}/month</p>
        ) : (
          <p className="text-sm text-muted-foreground">Free tier</p>
        )}
      </div>

      {/* Scans usage */}
      {scansMax !== null && scansMax !== undefined && (
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Scans this month
            </span>
            <span className="text-foreground font-medium">
              {scansUsed} / {scansMax}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${scansPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Days remaining */}
      {daysLeft !== null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {isTrial
              ? `Trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
              : `Renews in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
          </span>
        </div>
      )}

      {isTrial && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => navigate("/subscribe")}
        >
          Upgrade Plan
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );
};

export default SubscriptionStatusCard;
