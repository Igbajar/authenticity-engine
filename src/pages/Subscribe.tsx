import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check, Lock, Shield, Zap, Clock, Loader2, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CouponRedeemInput from "@/components/CouponRedeemInput";

type BillingPeriod = "hourly" | "daily" | "weekly" | "monthly" | "bi_annually" | "yearly";

interface TierData {
  id: string;
  name: string;
  description: string | null;
  price_hourly: number;
  price_daily: number;
  price_weekly: number;
  price_monthly: number;
  price_bi_annually: number;
  price_yearly: number;
  max_scans_per_month: number | null;
  max_words_per_scan: number | null;
  features: string[];
  is_active: boolean;
}

const PERIOD_LABELS: Record<BillingPeriod, string> = {
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  bi_annually: "6 Months",
  yearly: "Yearly",
};

const PERIOD_PRICE_KEY: Record<BillingPeriod, keyof TierData> = {
  hourly: "price_hourly",
  daily: "price_daily",
  weekly: "price_weekly",
  monthly: "price_monthly",
  bi_annually: "price_bi_annually",
  yearly: "price_yearly",
};

const Subscribe = () => {
  const { settings } = useAppSettings();
  const { subscription } = useSubscription();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const { data, error } = await supabase
          .from("subscription_tiers")
          .select("id, name, description, price_hourly, price_daily, price_weekly, price_monthly, price_bi_annually, price_yearly, max_scans_per_month, max_words_per_scan, features, is_active")
          .eq("is_active", true)
          .order("price_monthly", { ascending: true });

        if (error) throw error;
        setTiers(
          (data ?? []).map((t: any) => ({
            ...t,
            features: Array.isArray(t.features) ? t.features : [],
          }))
        );
      } catch (err) {
        console.error("Failed to fetch tiers:", err);
      } finally {
        setTiersLoading(false);
      }
    };
    fetchTiers();
  }, []);

  const getPrice = (tier: TierData): number => {
    return (tier[PERIOD_PRICE_KEY[billingPeriod]] as number) || 0;
  };

  const formatNaira = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  const handleSubscribe = async (tier: TierData) => {
    if (tier.name === "University") {
      toast({ title: "Contact Sales", description: "Please reach out to our team for University pricing." });
      return;
    }

    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to subscribe.", variant: "destructive" });
      return;
    }

    const price = getPrice(tier);
    if (price <= 0) {
      toast({ title: "Not available", description: `This tier is not available for ${PERIOD_LABELS[billingPeriod]} billing.`, variant: "destructive" });
      return;
    }

    setLoadingPlan(tier.id);
    try {
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const { data, error } = await supabase.functions.invoke("create-paystack-checkout", {
        body: {
          tier_id: tier.id,
          billing_period: billingPeriod,
          coupon_code: couponCode.trim() || null,
          callback_url: callbackUrl,
        },
      });

      if (error || !data?.authorization_url) {
        toast({
          title: "Payment Error",
          description: data?.error || error?.message || "Could not initialize payment.",
          variant: "destructive",
        });
        return;
      }

      window.location.href = data.authorization_url;
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Trial Banner */}
        {subscription?.is_trial && subscription.days_remaining !== undefined && (
          <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-accent" />
              <div>
                <p className="font-medium text-foreground">Free Trial Active</p>
                <p className="text-sm text-muted-foreground">
                  {subscription.days_remaining > 0
                    ? `${subscription.days_remaining} days remaining`
                    : "Trial expired"}
                </p>
              </div>
            </div>
            {subscription.days_remaining <= 3 && (
              <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded-full">
                Expiring soon
              </span>
            )}
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-full mb-6">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-medium">Subscription Required</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Subscribe to {settings.app_name}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose a plan to unlock full access to plagiarism detection, AI analysis, and citation tools.
          </p>
        </div>

        {/* Billing Period Selector */}
        <div className="max-w-3xl mx-auto mb-8">
          <p className="text-sm text-muted-foreground text-center mb-3">Select billing period:</p>
          <RadioGroup
            value={billingPeriod}
            onValueChange={(v) => setBillingPeriod(v as BillingPeriod)}
            className="flex flex-wrap justify-center gap-2"
          >
            {(Object.entries(PERIOD_LABELS) as [BillingPeriod, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center">
                <RadioGroupItem value={key} id={`period-${key}`} className="sr-only peer" />
                <Label
                  htmlFor={`period-${key}`}
                  className="px-4 py-2 rounded-lg border border-border bg-card text-sm cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary hover:bg-muted/50"
                >
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Coupon Code Input */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Have a coupon code? Enter it below for a discount:</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
            <Button
              variant="outline"
              disabled={!couponCode.trim()}
              onClick={() => {
                if (couponCode.trim()) {
                  toast({ title: "Coupon applied", description: `Code "${couponCode}" will be applied at checkout.` });
                }
              }}
            >
              Apply
            </Button>
          </div>
        </div>

        {/* Plans */}
        {tiersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            {tiers.map((tier, index) => {
              const price = getPrice(tier);
              const isPopular = index === 1;
              const isUniversity = tier.name === "University";

              return (
                <Card
                  key={tier.id}
                  className={`relative ${
                    isPopular ? "border-primary shadow-lg scale-105" : "border-border"
                  }`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      Most Popular
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-2xl font-serif">{tier.name}</CardTitle>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-foreground">
                        {isUniversity ? "Custom" : formatNaira(price)}
                      </span>
                      {!isUniversity && (
                        <span className="text-muted-foreground">/{PERIOD_LABELS[billingPeriod].toLowerCase()}</span>
                      )}
                    </div>
                    <CardDescription className="mt-2">
                      {tier.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          {tier.max_scans_per_month ? `${tier.max_scans_per_month} scans/month` : "Unlimited scans"}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          Up to {(tier.max_words_per_scan ?? 25000).toLocaleString()} words/scan
                        </span>
                      </li>
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={isPopular ? "default" : "outline"}
                      disabled={loadingPlan !== null}
                      onClick={() => handleSubscribe(tier)}
                    >
                      {loadingPlan === tier.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                      ) : isUniversity ? (
                        "Contact Sales"
                      ) : (
                        "Subscribe Now"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Coupon Redemption (for trial/extra scans) */}
        <div className="max-w-md mx-auto mb-12">
          <CouponRedeemInput />
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-8 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm">Secure payments via Paystack</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-sm">Instant access</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-primary" />
            <span className="text-sm">Cancel anytime</span>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;
