import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, DollarSign } from "lucide-react";

interface TierPricing {
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
  is_active: boolean;
}

const BILLING_PERIODS = [
  { key: "price_hourly", label: "Hourly" },
  { key: "price_daily", label: "Daily" },
  { key: "price_weekly", label: "Weekly" },
  { key: "price_monthly", label: "Monthly" },
  { key: "price_bi_annually", label: "Bi-Annually (6 months)" },
  { key: "price_yearly", label: "Yearly" },
] as const;

const AdminTierPricingEditor = () => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<TierPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_tiers")
        .select("id, name, description, price_hourly, price_daily, price_weekly, price_monthly, price_bi_annually, price_yearly, max_scans_per_month, max_words_per_scan, is_active")
        .order("price_monthly", { ascending: true });

      if (error) throw error;
      setTiers((data as TierPricing[]) ?? []);
    } catch (err) {
      console.error("Failed to fetch tiers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (tierId: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setTiers((prev) =>
      prev.map((t) => (t.id === tierId ? { ...t, [field]: numValue } : t))
    );
  };

  const handleSaveTier = async (tier: TierPricing) => {
    setSaving(tier.id);
    try {
      const { error } = await supabase
        .from("subscription_tiers")
        .update({
          price_hourly: tier.price_hourly,
          price_daily: tier.price_daily,
          price_weekly: tier.price_weekly,
          price_monthly: tier.price_monthly,
          price_bi_annually: tier.price_bi_annually,
          price_yearly: tier.price_yearly,
        })
        .eq("id", tier.id);

      if (error) throw error;

      toast({
        title: "Prices updated",
        description: `${tier.name} tier pricing saved successfully`,
      });
    } catch (err) {
      console.error("Failed to save tier:", err);
      toast({
        title: "Failed to save",
        description: "Could not update tier pricing",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-foreground">Subscription Tier Pricing</h2>
        <p className="text-muted-foreground">Configure pricing in Naira (₦) for each billing period</p>
      </div>

      {tiers.map((tier) => (
        <div
          key={tier.id}
          className="rounded-2xl border border-border bg-card p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-accent" />
              <div>
                <h3 className="font-medium text-foreground text-lg">{tier.name}</h3>
                {tier.description && (
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                )}
              </div>
            </div>
            {tier.is_active ? (
              <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full">Active</span>
            ) : (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">Inactive</span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {BILLING_PERIODS.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label} (₦)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={tier[key]}
                    onChange={(e) => handlePriceChange(tier.id, key, e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => handleSaveTier(tier)}
              disabled={saving === tier.id}
              size="sm"
            >
              {saving === tier.id ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</>
              ) : (
                <><Save className="w-4 h-4 mr-1.5" />Save {tier.name} Prices</>
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminTierPricingEditor;
