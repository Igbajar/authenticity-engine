import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Settings, Mail, Eye, EyeOff, Bell, CheckCircle2, XCircle, History, RefreshCw } from "lucide-react";

interface SmtpConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
  smtp_secure: string;
}

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const SMTP_KEYS: (keyof SmtpConfig)[] = [
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'smtp_secure',
];

const EXTRA_KEYS = ['smtp_last_tested', 'trial_emails_enabled'];

const AdminSettings = () => {
  const { settings, updateSetting, loading } = useAppSettings();
  const { toast } = useToast();
  const [appName, setAppName] = useState(settings.app_name);
  const [saving, setSaving] = useState(false);

  const [smtp, setSmtp] = useState<SmtpConfig>({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from: '',
    smtp_secure: 'false',
  });
  const [smtpLastTested, setSmtpLastTested] = useState<string | null>(null);
  const [trialEmailsEnabled, setTrialEmailsEnabled] = useState(true);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [trialToggleSaving, setTrialToggleSaving] = useState(false);

  // Email logs state
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    setAppName(settings.app_name);
  }, [settings.app_name]);

  useEffect(() => {
    fetchSmtpSettings();
    fetchEmailLogs();
  }, []);

  const fetchSmtpSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [...SMTP_KEYS, ...EXTRA_KEYS]);

      if (error) throw error;

      if (data) {
        const map: Record<string, string> = {};
        data.forEach(row => { map[row.key] = row.value; });

        setSmtp(prev => ({
          ...prev,
          ...Object.fromEntries(SMTP_KEYS.filter(k => map[k]).map(k => [k, map[k]])),
        }));
        setSmtpLastTested(map['smtp_last_tested'] || null);
        setTrialEmailsEnabled(map['trial_emails_enabled'] !== 'false');
      }
    } catch (err) {
      console.error('Failed to fetch SMTP settings:', err);
    } finally {
      setSmtpLoading(false);
    }
  };

  const fetchEmailLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmailLogs((data as EmailLog[]) ?? []);
    } catch (err) {
      console.error('Failed to fetch email logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const isSmtpConfigured = !!(smtp.smtp_host && smtp.smtp_user && smtp.smtp_password);

  const handleSaveAppName = async () => {
    setSaving(true);
    try {
      await updateSetting("app_name", appName);
      toast({ title: "Settings saved", description: "App name has been updated successfully" });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Error saving settings", description: "Failed to update app name", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    try {
      await Promise.all(
        SMTP_KEYS.map((key) =>
          supabase
            .from('app_settings')
            .upsert({ key, value: smtp[key], updated_at: new Date().toISOString() }, { onConflict: 'key' })
        )
      );
      toast({ title: "SMTP settings saved", description: "Your email configuration has been updated." });
    } catch (err) {
      console.error('Failed to save SMTP settings:', err);
      toast({ title: "Failed to save SMTP settings", variant: "destructive" });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    toast({ title: "Sending test email…", description: "Check your inbox in a moment." });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No user email found');

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: user.email,
          subject: '✅ SMTP Test — R-Check',
          html: `<p>Your SMTP configuration is working correctly!</p>`,
        },
      });

      if (error) throw error;

      const now = new Date().toISOString();
      await supabase
        .from('app_settings')
        .upsert({ key: 'smtp_last_tested', value: now, updated_at: now }, { onConflict: 'key' });
      setSmtpLastTested(now);

      toast({ title: "Test email sent!", description: `Check ${user.email}` });
      // Refresh logs after test
      setTimeout(fetchEmailLogs, 2000);
    } catch (err) {
      console.error('SMTP test failed:', err);
      toast({ title: "Test failed", description: String(err), variant: "destructive" });
    }
  };

  const handleToggleTrialEmails = async (enabled: boolean) => {
    setTrialToggleSaving(true);
    try {
      const now = new Date().toISOString();
      await supabase
        .from('app_settings')
        .upsert({ key: 'trial_emails_enabled', value: String(enabled), updated_at: now }, { onConflict: 'key' });
      setTrialEmailsEnabled(enabled);
      toast({
        title: enabled ? "Trial emails enabled" : "Trial emails disabled",
        description: enabled
          ? "Users will receive trial expiry reminders."
          : "Trial expiry email notifications are now paused.",
      });
    } catch (err) {
      console.error('Failed to toggle trial emails:', err);
      toast({ title: "Failed to update setting", variant: "destructive" });
    } finally {
      setTrialToggleSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/20">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'skipped':
        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 hover:bg-yellow-600/20">Skipped</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-foreground">App Settings</h2>
        <p className="text-muted-foreground">Configure application-wide settings</p>
      </div>

      {/* General Settings */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Settings className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">General Settings</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appName">Application Name</Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Enter app name"
              className="max-w-md"
            />
            <p className="text-sm text-muted-foreground">
              This name will be displayed across the entire application
            </p>
          </div>

          <Button onClick={handleSaveAppName} disabled={saving || appName === settings.app_name}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Save Changes</>
            )}
          </Button>
        </div>
      </div>

      {/* SMTP Settings */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-accent" />
            <h3 className="font-medium text-foreground">SMTP Email Configuration</h3>
          </div>
          {!smtpLoading && (
            <div className="flex items-center gap-2">
              {isSmtpConfigured ? (
                <Badge variant="default" className="flex items-center gap-1 bg-green-600 hover:bg-green-600 text-white">
                  <CheckCircle2 className="w-3 h-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Not Configured
                </Badge>
              )}
              {smtpLastTested && (
                <span className="text-xs text-muted-foreground">
                  Last tested: {new Date(smtpLastTested).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>

        {smtpLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading SMTP settings…</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input id="smtp_host" value={smtp.smtp_host} onChange={(e) => setSmtp(s => ({ ...s, smtp_host: e.target.value }))} placeholder="smtp.example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">Port</Label>
                <Input id="smtp_port" value={smtp.smtp_port} onChange={(e) => setSmtp(s => ({ ...s, smtp_port: e.target.value }))} placeholder="587" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_user">Username</Label>
                <Input id="smtp_user" value={smtp.smtp_user} onChange={(e) => setSmtp(s => ({ ...s, smtp_user: e.target.value }))} placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_password">Password</Label>
                <div className="relative">
                  <Input id="smtp_password" type={showPassword ? 'text' : 'password'} value={smtp.smtp_password} onChange={(e) => setSmtp(s => ({ ...s, smtp_password: e.target.value }))} placeholder="••••••••" className="pr-10" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_from">From Address</Label>
                <Input id="smtp_from" value={smtp.smtp_from} onChange={(e) => setSmtp(s => ({ ...s, smtp_from: e.target.value }))} placeholder="noreply@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_secure">Security</Label>
                <select id="smtp_secure" value={smtp.smtp_secure} onChange={(e) => setSmtp(s => ({ ...s, smtp_secure: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="false">STARTTLS (port 587)</option>
                  <option value="true">SSL/TLS (port 465)</option>
                </select>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              SMTP credentials are stored securely and used for sending trial expiry and system emails.
            </p>

            <div className="flex gap-3 flex-wrap">
              <Button onClick={handleSaveSmtp} disabled={smtpSaving}>
                {smtpSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save SMTP Settings</>}
              </Button>
              <Button variant="outline" onClick={handleTestSmtp} disabled={smtpSaving || !smtp.smtp_host}>
                <Mail className="w-4 h-4 mr-2" />Send Test Email
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Trial Email Notifications */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Bell className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">Email Notifications</h3>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="trialEmails" className="text-sm font-medium">Trial Expiry Reminders</Label>
            <p className="text-sm text-muted-foreground">
              Send automated emails to users 3 days and 1 day before their free trial expires.
            </p>
          </div>
          <Switch
            id="trialEmails"
            checked={trialEmailsEnabled}
            onCheckedChange={handleToggleTrialEmails}
            disabled={trialToggleSaving || smtpLoading}
          />
        </div>
      </div>

      {/* Email Logs */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-accent" />
            <h3 className="font-medium text-foreground">Email Log</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchEmailLogs} disabled={logsLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${logsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {logsLoading && emailLogs.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading email logs…</span>
          </div>
        ) : emailLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No emails sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{log.recipient}</TableCell>
                    <TableCell className="text-sm max-w-[250px] truncate">{log.subject}</TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">{log.error_message || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
