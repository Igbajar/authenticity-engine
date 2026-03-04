import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, User, CreditCard, Shield, Lock, Loader2, Save,
  Crown, Clock, Mail, Calendar, LogOut, AlertTriangle
} from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const { settings } = useAppSettings();
  const { toast } = useToast();

  // Profile state
  const [fullName, setFullName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFullName(data.full_name ?? "");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq("user_id", user!.id);

      if (error) throw error;
      toast({ title: "Profile updated", description: "Your name has been saved." });
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast({ title: "Failed to update profile", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
    } catch (err: any) {
      console.error("Failed to change password:", err);
      toast({ title: "Failed to change password", description: err.message, variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "long", day: "numeric", year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-serif font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account & preferences</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>Your personal information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{user?.email ?? "—"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              {profileLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : (
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="max-w-sm"
                />
              )}
            </div>
            <Button onClick={handleSaveProfile} disabled={profileSaving || profileLoading} size="sm">
              {profileSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Profile</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Subscription Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Subscription</CardTitle>
                <CardDescription>Your current plan and usage</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {subLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading subscription…
              </div>
            ) : subscription ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{subscription.tier_name ?? "Plan"}</span>
                      {subscription.is_trial ? (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Trial
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 text-xs">
                          <Crown className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    {subscription.is_trial && subscription.days_remaining !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        {subscription.days_remaining > 0
                          ? `${subscription.days_remaining} day${subscription.days_remaining !== 1 ? "s" : ""} remaining`
                          : "Trial expired"
                        }
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/subscribe")}>
                    {subscription.is_trial ? "Upgrade" : "Change Plan"}
                  </Button>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Scans Used</p>
                    <p className="font-medium text-foreground">
                      {subscription.scans_used_this_month ?? 0} / {subscription.max_scans_per_month ?? "∞"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {subscription.is_trial ? "Trial Ends" : "Billing Period Ends"}
                    </p>
                    <p className="font-medium text-foreground">
                      {formatDate(subscription.is_trial ? subscription.trial_ends_at ?? null : subscription.billing_period_end)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-3">No active subscription</p>
                <Button onClick={() => navigate("/subscribe")}>
                  <Crown className="w-4 h-4 mr-2" /> Subscribe Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Security</CardTitle>
                <CardDescription>Update your password</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="max-w-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="max-w-sm"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={passwordSaving || !newPassword || !confirmPassword}
              size="sm"
            >
              {passwordSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</>
              ) : (
                <><Shield className="w-4 h-4 mr-2" />Update Password</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="border-destructive/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg">Account</CardTitle>
                <CardDescription>Sign out or manage your account</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
