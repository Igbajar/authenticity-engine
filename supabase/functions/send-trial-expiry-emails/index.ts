import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  let emailsSent = 0;
  const errors: string[] = [];

  // Helper: send email via send-email function
  async function sendEmail(to: string, subject: string, html: string) {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`send-email failed: ${JSON.stringify(data)}`);
    return data;
  }

  // Helper: fetch users with trial expiring in a given window who haven't been notified
  async function fetchExpiringUsers(
    windowStart: Date,
    windowEnd: Date,
    notifiedField: 'notified_3_days' | 'notified_1_day'
  ) {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        id,
        user_id,
        trial_ends_at,
        profiles!inner(email, full_name)
      `)
      .eq('is_trial', true)
      .eq('status', 'active')
      .eq(notifiedField, false)
      .gte('trial_ends_at', windowStart.toISOString())
      .lte('trial_ends_at', windowEnd.toISOString());

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  try {
    // --- 3-day warning (window: 2.5 → 3.5 days from now) ---
    const threeDayUsers = await fetchExpiringUsers(
      new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000),
      new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000),
      'notified_3_days'
    );

    for (const sub of threeDayUsers) {
      const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles as { email: string; full_name: string | null };
      const email = profile?.email;
      const name = profile?.full_name || 'there';
      if (!email) continue;

      try {
        await sendEmail(
          email,
          '⏳ Your free trial expires in 3 days',
          buildEmail(name, 3)
        );
        await supabase
          .from('user_subscriptions')
          .update({ notified_3_days: true })
          .eq('id', sub.id);
        emailsSent++;
        console.log(`[trial-emails] 3-day warning sent to ${email}`);
      } catch (e) {
        errors.push(`3-day email to ${email}: ${e}`);
        console.error(`[trial-emails] Failed 3-day email to ${email}:`, e);
      }
    }

    // --- 1-day warning (window: 0.5 → 1.5 days from now) ---
    const oneDayUsers = await fetchExpiringUsers(
      new Date(now.getTime() + 0.5 * 24 * 60 * 60 * 1000),
      new Date(now.getTime() + 1.5 * 24 * 60 * 60 * 1000),
      'notified_1_day'
    );

    for (const sub of oneDayUsers) {
      const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles as { email: string; full_name: string | null };
      const email = profile?.email;
      const name = profile?.full_name || 'there';
      if (!email) continue;

      try {
        await sendEmail(
          email,
          '🚨 Last day of your free trial!',
          buildEmail(name, 1)
        );
        await supabase
          .from('user_subscriptions')
          .update({ notified_1_day: true })
          .eq('id', sub.id);
        emailsSent++;
        console.log(`[trial-emails] 1-day warning sent to ${email}`);
      } catch (e) {
        errors.push(`1-day email to ${email}: ${e}`);
        console.error(`[trial-emails] Failed 1-day email to ${email}:`, e);
      }
    }

  } catch (err) {
    errors.push(`Unexpected error: ${err}`);
    console.error('[trial-emails] Fatal error:', err);
  }

  return new Response(
    JSON.stringify({ success: true, emailsSent, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

function buildEmail(name: string, daysLeft: number): string {
  const color = daysLeft === 1 ? '#ef4444' : '#f59e0b';
  const urgencyLabel = daysLeft === 1 ? 'LAST CHANCE' : `${daysLeft} DAYS LEFT`;
  const headline = daysLeft === 1 ? 'Your Trial Ends Tomorrow' : `Your Free Trial Expires in ${daysLeft} Days`;

  const features = [
    'Plagiarism detection across the web',
    'AI-generated content detection',
    'Citation & bibliography tools',
    'Detailed PDF reports',
    'Batch document scanning',
  ];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:40px auto;background:#141414;border-radius:16px;overflow:hidden;border:1px solid #252525;">

    <!-- Header bar -->
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:40px;text-align:center;border-bottom:1px solid #252525;">
      <div style="display:inline-block;background:${color}18;border:1px solid ${color}50;border-radius:50px;padding:6px 18px;margin-bottom:20px;">
        <span style="color:${color};font-size:12px;font-weight:700;letter-spacing:1.5px;">${urgencyLabel}</span>
      </div>
      <h1 style="color:#f5f0e8;margin:0;font-size:26px;font-weight:700;line-height:1.3;">${headline}</h1>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="color:#999;font-size:16px;line-height:1.8;margin:0 0 12px;">Hi ${name},</p>
      <p style="color:#ccc;font-size:15px;line-height:1.8;margin:0 0 28px;">
        ${daysLeft === 1
          ? 'Your free trial ends <strong style="color:#ef4444;">tomorrow</strong>. After it expires, access to all scanning and detection features will be locked.'
          : `Your free trial has <strong style="color:${color};">${daysLeft} days remaining</strong>. Subscribe now to keep uninterrupted access to all features.`}
      </p>

      <!-- Features -->
      <div style="background:#0f0f0f;border:1px solid #222;border-radius:12px;padding:24px;margin-bottom:32px;">
        <p style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;font-family:sans-serif;">What you'll keep</p>
        ${features.map(f => `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <span style="color:#22c55e;font-size:14px;line-height:1;">✓</span>
          <span style="color:#bbb;font-size:14px;font-family:sans-serif;">${f}</span>
        </div>`).join('')}
      </div>

      <!-- CTA button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="https://your-app.com/subscribe"
           style="display:inline-block;background:linear-gradient(135deg,#c8902a,#a06820);color:#fff;font-weight:700;font-size:16px;padding:15px 44px;border-radius:50px;text-decoration:none;font-family:sans-serif;letter-spacing:0.3px;">
          Subscribe Now →
        </a>
      </div>

      <p style="color:#555;font-size:13px;text-align:center;margin:0;font-family:sans-serif;">
        Plans start at $19/month &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; No hidden fees
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;border-top:1px solid #222;text-align:center;">
      <p style="color:#444;font-size:12px;margin:0;font-family:sans-serif;line-height:1.6;">
        You're receiving this because you signed up for a free trial.
      </p>
    </div>

  </div>
</body>
</html>`;
}
