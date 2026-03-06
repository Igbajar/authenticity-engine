import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BILLING_PERIOD_DAYS: Record<string, number> = {
  hourly: 0,
  daily: 1,
  weekly: 7,
  monthly: 30,
  bi_annually: 182,
  yearly: 365,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!paystackSecretKey) {
      const { data: settingRow } = await adminClient
        .from("app_settings")
        .select("value")
        .eq("key", "paystack_secret_key")
        .maybeSingle();
      if (settingRow?.value) paystackSecretKey = settingRow.value;
    }

    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: "Payment system not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ error: "Payment reference is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return new Response(
        JSON.stringify({ error: "Payment verification failed", details: verifyData.data?.gateway_response }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata = verifyData.data.metadata;
    const userId = metadata.user_id;
    const tierId = metadata.tier_id;
    const tierName = metadata.tier_name || "Unknown";
    const billingPeriod = metadata.billing_period || "monthly";
    const couponCode = metadata.coupon_code;

    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate end date based on billing period
    const endDate = new Date();
    const days = BILLING_PERIOD_DAYS[billingPeriod] || 30;
    if (billingPeriod === "hourly") {
      endDate.setHours(endDate.getHours() + 1);
    } else {
      endDate.setDate(endDate.getDate() + days);
    }

    // Deactivate existing subscriptions
    await adminClient
      .from("user_subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "active");

    // Create new subscription
    await adminClient.from("user_subscriptions").insert({
      user_id: user.id,
      tier_id: tierId,
      status: "active",
      is_trial: false,
      billing_period: billingPeriod,
      billing_period_end: endDate.toISOString(),
      stripe_subscription_id: `paystack_${reference}`,
    });

    // Record coupon redemption if used
    if (couponCode) {
      const { data: coupon } = await adminClient
        .from("coupons")
        .select("id, times_redeemed")
        .eq("code", couponCode.toUpperCase())
        .maybeSingle();

      if (coupon) {
        await adminClient.from("coupon_redemptions").insert({
          coupon_id: coupon.id,
          user_id: user.id,
        });
        await adminClient
          .from("coupons")
          .update({ times_redeemed: coupon.times_redeemed + 1 })
          .eq("id", coupon.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, plan: tierName, message: `Successfully subscribed to ${tierName}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Verify payment error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
