import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, Users, CreditCard, BarChart3, Settings,
  Search, MoreVertical, Shield, Loader2, TrendingUp,
  FileText, Brain, AlertCircle, CheckCircle2, X, Cog
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminSettings from "@/components/AdminSettings";

interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role: string;
  scans_count?: number;
  subscription_tier?: string;
}

interface SubscriptionTier {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_scans_per_month: number | null;
  max_words_per_scan: number;
  features: string[];
  is_active: boolean;
}

interface Analytics {
  totalUsers: number;
  totalScans: number;
  totalWords: number;
  avgSimilarity: number;
  avgAiScore: number;
  scansToday: number;
  newUsersThisWeek: number;
  proSubscribers: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"users" | "subscriptions" | "analytics" | "settings">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Role change modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      // Check if user has admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast({
          title: "Access denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      fetchData();
    } catch (error) {
      console.error("Admin check error:", error);
      navigate("/dashboard");
    }
  };

  const fetchData = async () => {
    try {
      // Fetch users with their profile info
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesData) {
        // Get scan counts for each user
        const usersWithCounts = await Promise.all(
          profilesData.map(async (profile) => {
            const { count } = await supabase
              .from("scans")
              .select("*", { count: "exact", head: true })
              .eq("user_id", profile.user_id);

            return {
              ...profile,
              scans_count: count || 0,
            };
          })
        );
        setUsers(usersWithCounts);
      }

      // Fetch subscription tiers
      const { data: tiersData } = await supabase
        .from("subscription_tiers")
        .select("*")
        .order("price_monthly", { ascending: true });

      if (tiersData) {
        setTiers(tiersData.map(tier => ({
          ...tier,
          features: Array.isArray(tier.features) ? tier.features as string[] : [],
        })));
      }

      // Calculate analytics
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { data: scansData } = await supabase
        .from("scans")
        .select("similarity_score, ai_detection_score, word_count, created_at")
        .eq("status", "completed");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const scansToday = scansData?.filter(s => new Date(s.created_at) >= today).length || 0;

      const { count: newUsersThisWeek } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo.toISOString());

      const { count: proSubscribers } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      setAnalytics({
        totalUsers: totalUsers || 0,
        totalScans: scansData?.length || 0,
        totalWords: scansData?.reduce((acc, s) => acc + (s.word_count || 0), 0) || 0,
        avgSimilarity: scansData?.length 
          ? scansData.reduce((acc, s) => acc + (s.similarity_score || 0), 0) / scansData.length 
          : 0,
        avgAiScore: scansData?.length 
          ? scansData.reduce((acc, s) => acc + (s.ai_detection_score || 0), 0) / scansData.length 
          : 0,
        scansToday,
        newUsersThisWeek: newUsersThisWeek || 0,
        proSubscribers: proSubscribers || 0,
      });

    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast({
        title: "Error loading data",
        description: "Could not load admin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;

    try {
      // Update or insert role
      const { error } = await supabase
        .from("user_roles")
        .upsert({
          user_id: selectedUser.user_id,
          role: newRole as "user" | "teacher" | "admin",
        }, { onConflict: "user_id,role" });

      if (error) throw error;

      toast({
        title: "Role updated",
        description: `${selectedUser.email} is now a ${newRole}`,
      });

      setRoleModalOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error("Role update error:", error);
      toast({
        title: "Update failed",
        description: "Could not update user role",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: "users", label: "Users", icon: Users },
    { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Cog },
  ] as const;

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            <h1 className="font-serif text-xl text-foreground">Admin Panel</h1>
          </div>
          <div className="w-32" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl text-foreground">User Management</h2>
                <p className="text-muted-foreground">Manage users and their roles</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Scans</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-foreground">{u.full_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.role === "admin" 
                              ? "bg-destructive/10 text-destructive" 
                              : u.role === "teacher"
                              ? "bg-accent/10 text-accent"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4 text-foreground">{u.scans_count}</td>
                        <td className="p-4 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUser(u);
                                  setNewRole(u.role);
                                  setRoleModalOpen(true);
                                }}
                              >
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem>View Profile</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                Suspend User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === "subscriptions" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl text-foreground">Subscription Tiers</h2>
              <p className="text-muted-foreground">Manage pricing and features</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-2xl border bg-card p-6 ${
                    tier.name === "Pro" ? "border-accent shadow-glow" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-xl text-foreground">{tier.name}</h3>
                    {tier.is_active ? (
                      <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <span className="font-serif text-3xl text-foreground">
                      ${tier.price_monthly}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Scans/month</span>
                      <span className="text-foreground">
                        {tier.max_scans_per_month || "Unlimited"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Words/scan</span>
                      <span className="text-foreground">
                        {tier.max_words_per_scan.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {tier.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" className="w-full mt-6">
                    Edit Tier
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && analytics && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl text-foreground">Platform Analytics</h2>
              <p className="text-muted-foreground">Overview of platform usage and metrics</p>
            </div>

            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Total Users"
                value={analytics.totalUsers}
                color="accent"
              />
              <StatCard
                icon={FileText}
                label="Total Scans"
                value={analytics.totalScans}
                color="success"
              />
              <StatCard
                icon={TrendingUp}
                label="Scans Today"
                value={analytics.scansToday}
                color="warning"
              />
              <StatCard
                icon={CreditCard}
                label="Pro Subscribers"
                value={analytics.proSubscribers}
                color="accent"
              />
            </div>

            {/* Secondary Stats */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-medium text-foreground mb-4">Average Scores</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Avg. Similarity Score</span>
                      <span className="text-foreground">{analytics.avgSimilarity.toFixed(1)}%</span>
                    </div>
                    <Progress value={analytics.avgSimilarity} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Avg. AI Detection</span>
                      <span className="text-foreground">{analytics.avgAiScore.toFixed(1)}%</span>
                    </div>
                    <Progress value={analytics.avgAiScore} className="h-2" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-medium text-foreground mb-4">Usage Stats</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Words Scanned</span>
                    <span className="text-foreground font-medium">
                      {analytics.totalWords.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Users This Week</span>
                    <span className="text-foreground font-medium">
                      {analytics.newUsersThisWeek}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Scans/User</span>
                    <span className="text-foreground font-medium">
                      {analytics.totalUsers > 0 
                        ? (analytics.totalScans / analytics.totalUsers).toFixed(1)
                        : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <AdminSettings />
        )}
      </main>

      {/* Role Change Modal */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-2">
              {["user", "teacher", "admin"].map((role) => (
                <button
                  key={role}
                  onClick={() => setNewRole(role)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    newRole === role
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <div className="font-medium text-foreground capitalize">{role}</div>
                  <div className="text-sm text-muted-foreground">
                    {role === "admin" && "Full access to admin panel and all features"}
                    {role === "teacher" && "Can manage classes and view student submissions"}
                    {role === "user" && "Standard user with personal scan access"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={handleRoleChange}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  color: "accent" | "success" | "warning";
}) => (
  <div className="rounded-xl border border-border bg-card p-6">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-xl bg-${color}/10 flex items-center justify-center`}>
        <Icon className={`w-5 h-5 text-${color}`} />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <div className="font-serif text-3xl text-foreground">{value.toLocaleString()}</div>
  </div>
);

export default Admin;