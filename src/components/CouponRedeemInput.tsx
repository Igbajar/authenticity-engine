import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tag, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CouponRedeemInput = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("redeem-coupon", {
        body: { code: code.trim().toUpperCase() },
      });

      if (error) {
        toast({
          title: "Redemption failed",
          description: error.message || "Could not redeem coupon",
          variant: "destructive",
        });
      } else if (data?.error) {
        toast({
          title: "Invalid coupon",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setResult(data.message);
        setCode("");
        toast({ title: "Coupon redeemed!", description: data.message });
      }
    } catch {
      toast({
        title: "Error",
        description: "Could not process coupon",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium text-foreground">Have a coupon code?</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          maxLength={20}
          className="flex-1 h-10 px-3 rounded-lg bg-muted/50 border border-border text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
          onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
        />
        <Button onClick={handleRedeem} disabled={loading || !code.trim()} size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {result && (
        <div className="flex items-center gap-2 mt-2 text-sm text-success">
          <CheckCircle2 className="w-4 h-4" />
          {result}
        </div>
      )}
    </div>
  );
};

export default CouponRedeemInput;
