import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: "Payment system not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ error: "Payment reference is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
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
    const planName = metadata.plan_name;
    const couponCode = metadata.coupon_code;

    // Verify the user matches
    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Find the matching subscription tier
    const { data: tier } = await adminClient
      .from("subscription_tiers")
      .select("id, name")
      .eq("name", planName)
      .eq("is_active", true)
      .maybeSingle();

    if (!tier) {
      return new Response(JSON.stringify({ error: "Subscription tier not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deactivate existing subscriptions
    await adminClient
      .from("user_subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "active");

    // Create new subscription (30 days)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    await adminClient.from("user_subscriptions").insert({
      user_id: user.id,
      tier_id: tier.id,
      status: "active",
      is_trial: false,
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
      JSON.stringify({ success: true, plan: planName, message: `Successfully subscribed to ${planName}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Verify payment error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
