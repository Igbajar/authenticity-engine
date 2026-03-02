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
        JSON.stringify({ error: "Payment system not configured. Please contact support." }),
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

    const { plan_name, coupon_code, callback_url } = await req.json();

    if (!plan_name || !callback_url) {
      return new Response(JSON.stringify({ error: "Plan and callback URL are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine price based on plan
    const planPrices: Record<string, number> = {
      Pro: 19_00, // Amount in kobo/cents (Paystack uses smallest currency unit)
      Premium: 49_00,
    };

    let amount = planPrices[plan_name];
    if (!amount) {
      return new Response(JSON.stringify({ error: "Invalid plan selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply coupon if provided
    let discountPercent = 0;
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

        // Check if user already redeemed
        const { data: existing } = await adminClient
          .from("coupon_redemptions")
          .select("id")
          .eq("coupon_id", coupon.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!isExpired && !isMaxed && !existing && couponType === "discount") {
          discountPercent = coupon.value;
          amount = Math.round(amount * (1 - discountPercent / 100));
        }
      }
    }

    // Convert to Naira (multiply by 100 for kobo) — prices are in USD cents, convert
    // Paystack uses kobo for NGN. Adjust currency/amount as needed.
    const amountInMinorUnit = amount * 100; // $19 = 1900 cents → 190000 kobo equivalent

    // Initialize Paystack transaction
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountInMinorUnit,
        currency: "USD",
        callback_url: callback_url,
        metadata: {
          user_id: user.id,
          plan_name: plan_name,
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
