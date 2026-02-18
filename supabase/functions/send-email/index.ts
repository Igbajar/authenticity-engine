import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read SMTP config from app_settings using service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_secure']);

    if (settingsError) {
      console.error('[send-email] Failed to read SMTP settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to read SMTP configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const smtp: Record<string, string> = {};
    for (const row of settingsData ?? []) {
      smtp[row.key] = row.value;
    }

    if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_password) {
      console.warn('[send-email] SMTP not configured. Would have sent to:', to);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'SMTP is not configured yet. Please set SMTP settings in the admin panel.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const port = parseInt(smtp.smtp_port || '587', 10);
    const secure = smtp.smtp_secure === 'true' || port === 465;

    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port,
      secure,
      auth: {
        user: smtp.smtp_user,
        pass: smtp.smtp_password,
      },
    });

    const info = await transporter.sendMail({
      from: smtp.smtp_from || smtp.smtp_user,
      to,
      subject,
      html,
    });

    console.log(`[send-email] Email sent successfully to ${to}, messageId: ${info.messageId}`);

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-email] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
