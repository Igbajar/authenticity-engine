import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BILLING_PERIOD_PRICE_COLUMN: Record<string, string> = {
  hourly: "price_hourly",
  daily: "price_daily",
  weekly: "price_weekly",
  monthly: "price_monthly",
  bi_annually: "price_bi_annually",
  yearly: "price_yearly",
};

const BILLING_PERIOD_DAYS: Record<string, number> = {
  hourly: 0, // special: hours
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
    // Try edge function secret first, then fall back to app_settings
    let paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!paystackSecretKey) {
      // Check app_settings for paystack_secret_key
      const { data: settingRow } = await adminClient
        .from("app_settings")
        .select("value")
        .eq("key", "paystack_secret_key")
        .maybeSingle();

      if (settingRow?.value) {
        paystackSecretKey = settingRow.value;
      }
    }

    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: "Payment system not configured. Please ask an admin to set the Paystack API key in Settings." }),
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

    const { tier_id, billing_period, coupon_code, callback_url } = await req.json();

    if (!tier_id || !billing_period || !callback_url) {
      return new Response(JSON.stringify({ error: "Tier, billing period, and callback URL are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceColumn = BILLING_PERIOD_PRICE_COLUMN[billing_period];
    if (!priceColumn) {
      return new Response(JSON.stringify({ error: "Invalid billing period" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tier from DB
    const { data: tier, error: tierError } = await adminClient
      .from("subscription_tiers")
      .select("id, name, " + priceColumn)
      .eq("id", tier_id)
      .eq("is_active", true)
      .maybeSingle();

    if (tierError || !tier) {
      return new Response(JSON.stringify({ error: "Invalid or inactive tier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let amountNaira = Number((tier as Record<string, unknown>)[priceColumn]) || 0;
    if (amountNaira <= 0) {
      return new Response(JSON.stringify({ error: `This tier has no pricing set for ${billing_period} billing` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply coupon if provided
    let discountPercent = 0;
    if (coupon_code && coupon_code.trim()) {
      const { data: coupon } = await adminClient
        .from("coupons")
        .select("*")
        .eq("code", coupon_code.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (coupon) {
        const couponType = coupon.coupon_type as string;
        const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
        const isMaxed = coupon.max_redemptions !== null && coupon.times_redeemed >= coupon.max_redemptions;

        const { data: existing } = await adminClient
          .from("coupon_redemptions")
          .select("id")
          .eq("coupon_id", coupon.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!isExpired && !isMaxed && !existing && couponType === "discount") {
          discountPercent = coupon.value;
          amountNaira = Math.round(amountNaira * (1 - discountPercent / 100));
        }
      }
    }

    // Paystack uses kobo (smallest unit for NGN): 1 Naira = 100 kobo
    const amountKobo = Math.round(amountNaira * 100);

    // Initialize Paystack transaction
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        currency: "NGN",
        callback_url: callback_url,
        metadata: {
          user_id: user.id,
          tier_id: tier_id,
          tier_name: tier.name,
          billing_period: billing_period,
          coupon_code: coupon_code || null,
          discount_percent: discountPercent,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("Paystack error:", paystackData);
      return new Response(
        JSON.stringify({ error: paystackData.message || "Payment initialization failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Create checkout error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
