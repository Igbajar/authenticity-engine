import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (!reference) {
      setStatus("error");
      setMessage("No payment reference found.");
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-paystack-payment", {
          body: { reference },
        });

        if (error || !data?.success) {
          setStatus("error");
          setMessage(data?.error || error?.message || "Payment verification failed.");
        } else {
          setStatus("success");
          setMessage(data.message || "Subscription activated!");
        }
      } catch {
        setStatus("error");
        setMessage("An unexpected error occurred.");
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        {status === "verifying" && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Verifying Payment</h1>
            <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Payment Failed</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => navigate("/subscribe")} variant="outline">Try Again</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
