import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Loader2, Tag, Copy, ToggleLeft, ToggleRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Coupon {
  id: string;
  code: string;
  coupon_type: string;
  description: string | null;
  value: number;
  tier_id: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface Tier {
  id: string;
  name: string;
}

const couponTypeLabels: Record<string, string> = {
  trial_extension: "Trial Extension",
  discount: "Discount (%)",
  free_subscription: "Free Subscription",
  extra_scans: "Extra Scans",
};

const AdminCouponManager = () => {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [couponType, setCouponType] = useState("trial_extension");
  const [value, setValue] = useState(7);
  const [description, setDescription] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState<number | "">("");
  const [tierId, setTierId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    fetchCoupons();
    fetchTiers();
  }, []);

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setCoupons(data as Coupon[]);
    setLoading(false);
  };

  const fetchTiers = async () => {
    const { data } = await supabase
      .from("subscription_tiers")
      .select("id, name")
      .eq("is_active", true);
    if (data) setTiers(data);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    setCode(result);
  };

  const handleCreate = async () => {
    if (!code.trim()) {
      toast({ title: "Code required", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { error } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(),
      coupon_type: couponType as "trial_extension" | "discount" | "free_subscription" | "extra_scans",
      value,
      description: description || null,
      max_redemptions: maxRedemptions === "" ? null : maxRedemptions,
      tier_id: tierId || null,
      expires_at: expiresAt || null,
    });

    if (error) {
      toast({
        title: "Error creating coupon",
        description: error.message.includes("duplicate")
          ? "A coupon with this code already exists"
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Coupon created" });
      setCreateOpen(false);
      resetForm();
      fetchCoupons();
    }
    setSaving(false);
  };

  const toggleActive = async (coupon: Coupon) => {
    await supabase
      .from("coupons")
      .update({ is_active: !coupon.is_active })
      .eq("id", coupon.id);
    fetchCoupons();
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    fetchCoupons();
  };

  const resetForm = () => {
    setCode("");
    setCouponType("trial_extension");
    setValue(7);
    setDescription("");
    setMaxRedemptions("");
    setTierId("");
    setExpiresAt("");
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    toast({ title: "Code copied" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-xl text-foreground">Coupon Management</h3>
          <p className="text-sm text-muted-foreground">Create and manage promo codes</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            generateCode();
            setCreateOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {/* Coupons list */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {coupons.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Tag className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p>No coupons created yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Value</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Used</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <button
                        onClick={() => copyCode(c.code)}
                        className="flex items-center gap-1.5 font-mono text-sm text-foreground hover:text-accent"
                      >
                        {c.code}
                        <Copy className="w-3 h-3" />
                      </button>
                      {c.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {couponTypeLabels[c.coupon_type] || c.coupon_type}
                    </td>
                    <td className="p-3 text-sm text-foreground font-medium">{c.value}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {c.times_redeemed}{c.max_redemptions !== null ? `/${c.max_redemptions}` : ""}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          c.is_active
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleActive(c)}>
                          {c.is_active ? (
                            <ToggleRight className="w-4 h-4 text-success" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCoupon(c.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Code</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="flex-1 h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground"
                  placeholder="PROMO2024"
                />
                <Button variant="outline" size="sm" onClick={generateCode}>
                  Generate
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Type</label>
              <select
                value={couponType}
                onChange={(e) => setCouponType(e.target.value)}
                className="w-full h-10 px-3 mt-1 rounded-lg bg-muted/50 border border-border text-foreground"
              >
                <option value="trial_extension">Trial Extension (days)</option>
                <option value="discount">Discount (%)</option>
                <option value="free_subscription">Free Subscription (days)</option>
                <option value="extra_scans">Extra Scans</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Value ({couponType === "discount" ? "%" : couponType === "extra_scans" ? "scans" : "days"})
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(parseInt(e.target.value) || 0)}
                min={1}
                className="w-full h-10 px-3 mt-1 rounded-lg bg-muted/50 border border-border text-foreground"
              />
            </div>

            {couponType === "free_subscription" && (
              <div>
                <label className="text-sm font-medium text-foreground">Tier</label>
                <select
                  value={tierId}
                  onChange={(e) => setTierId(e.target.value)}
                  className="w-full h-10 px-3 mt-1 rounded-lg bg-muted/50 border border-border text-foreground"
                >
                  <option value="">Select a tier</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-10 px-3 mt-1 rounded-lg bg-muted/50 border border-border text-foreground"
                placeholder="Welcome promo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Max Uses</label>
                <input
                  type="number"
                  value={maxRedemptions}
                  onChange={(e) =>
                    setMaxRedemptions(e.target.value === "" ? "" : parseInt(e.target.value))
                  }
                  min={1}
                  placeholder="Unlimited"
                  className="w-full h-10 px-3 mt-1 rounded-lg bg-muted/50 border border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Expires</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full h-10 px-3 mt-1 rounded-lg bg-muted/50 border border-border text-foreground"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCouponManager;
