import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Coupon code is required" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Look up coupon
    const { data: coupon, error: couponErr } = await adminClient
      .from("coupons")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (couponErr || !coupon) {
      return new Response(JSON.stringify({ error: "Invalid or expired coupon code" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This coupon has expired" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    // Check max redemptions
    if (coupon.max_redemptions !== null && coupon.times_redeemed >= coupon.max_redemptions) {
      return new Response(JSON.stringify({ error: "This coupon has reached its redemption limit" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    // Check if user already redeemed
    const { data: existing } = await adminClient
      .from("coupon_redemptions")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "You have already redeemed this coupon" }), {
        status: 200, headers: jsonHeaders,
      });
    }

    // Apply coupon based on type
    let message = "";
    const couponType = coupon.coupon_type as string;

    if (couponType === "trial_extension") {
      const { data: sub } = await adminClient
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (sub) {
        const currentEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
        currentEnd.setDate(currentEnd.getDate() + coupon.value);
        await adminClient
          .from("user_subscriptions")
          .update({
            is_trial: true,
            trial_ends_at: currentEnd.toISOString(),
            billing_period_end: currentEnd.toISOString(),
          })
          .eq("id", sub.id);
        message = `Trial extended by ${coupon.value} days`;
      } else {
        const { data: freeTier } = await adminClient
          .from("subscription_tiers")
          .select("id")
          .eq("is_active", true)
          .order("price_monthly", { ascending: true })
          .limit(1)
          .single();

        if (freeTier) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + coupon.value);
          await adminClient.from("user_subscriptions").insert({
            user_id: user.id,
            tier_id: freeTier.id,
            status: "active",
            is_trial: true,
            trial_ends_at: trialEnd.toISOString(),
            billing_period_end: trialEnd.toISOString(),
          });
        }
        message = `${coupon.value}-day trial activated`;
      }
    } else if (couponType === "free_subscription") {
      const tierId = coupon.tier_id;
      if (!tierId) {
        return new Response(JSON.stringify({ error: "Coupon configuration error" }), {
          status: 200, headers: jsonHeaders,
        });
      }

      await adminClient
        .from("user_subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", user.id)
        .eq("status", "active");

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + coupon.value);

      await adminClient.from("user_subscriptions").insert({
        user_id: user.id,
        tier_id: tierId,
        status: "active",
        is_trial: false,
        billing_period_end: endDate.toISOString(),
      });
      message = `Free subscription granted for ${coupon.value} days`;
    } else if (couponType === "extra_scans") {
      const { data: sub } = await adminClient
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (sub) {
        const currentUsed = sub.scans_used_this_month || 0;
        const newUsed = Math.max(0, currentUsed - coupon.value);
        await adminClient
          .from("user_subscriptions")
          .update({ scans_used_this_month: newUsed })
          .eq("id", sub.id);
        message = `${coupon.value} extra scans added`;
      } else {
        return new Response(JSON.stringify({ error: "You need an active subscription to add scans" }), {
          status: 200, headers: jsonHeaders,
        });
      }
    } else if (couponType === "discount") {
      message = `${coupon.value}% discount applied. Use at checkout.`;
    }

    // Record redemption
    await adminClient.from("coupon_redemptions").insert({
      coupon_id: coupon.id,
      user_id: user.id,
    });

    // Increment times_redeemed
    await adminClient
      .from("coupons")
      .update({ times_redeemed: coupon.times_redeemed + 1 })
      .eq("id", coupon.id);

    return new Response(
      JSON.stringify({ success: true, message, coupon_type: couponType }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (err) {
    console.error("Redeem coupon error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 200, headers: jsonHeaders,
    });
  }
});
