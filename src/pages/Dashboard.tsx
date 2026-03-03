import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  FileText, Plus, Search, Clock, TrendingUp, 
  AlertCircle, CheckCircle2, Brain, LogOut, Settings,
  BarChart3, Users, Building2, Loader2, ArrowLeftRight, Shield, Files, Trash2
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CouponRedeemInput from "@/components/CouponRedeemInput";
import SubscriptionStatusCard from "@/components/SubscriptionStatusCard";

interface Scan {
  id: string;
  similarity_score: number | null;
  ai_detection_score: number | null;
  word_count: number | null;
  status: string;
  created_at: string;
  documents: {
    name: string;
  } | null;
}

interface Profile {
  full_name: string | null;
  role: string;
  avatar_url: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [scans, setScans] = useState<Scan[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [stats, setStats] = useState({
    totalScans: 0,
    avgSimilarity: 0,
    avgAiScore: 0,
    totalWords: 0,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, role, avatar_url")
        .eq("user_id", user!.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch scans with documents
      const { data: scansData, error: scansError } = await supabase
        .from("scans")
        .select(`
          id,
          similarity_score,
          ai_detection_score,
          word_count,
          status,
          created_at,
          documents (
            name
          )
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (scansError) throw scansError;
      
      setScans(scansData || []);

      // Calculate stats
      const completedScans = (scansData || []).filter(s => s.status === "completed");
      const totalScans = completedScans.length;
      const avgSimilarity = totalScans > 0 
        ? completedScans.reduce((acc, s) => acc + (s.similarity_score || 0), 0) / totalScans 
        : 0;
      const avgAiScore = totalScans > 0 
        ? completedScans.reduce((acc, s) => acc + (s.ai_detection_score || 0), 0) / totalScans 
        : 0;
      const totalWords = completedScans.reduce((acc, s) => acc + (s.word_count || 0), 0);

      setStats({
        totalScans: scansData?.length || 0,
        avgSimilarity: Math.round(avgSimilarity * 10) / 10,
        avgAiScore: Math.round(avgAiScore * 10) / 10,
        totalWords,
      });

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error loading data",
        description: "Could not load your dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      // Delete related data first, then scans, then documents
      const scanIds = scans.map(s => s.id);
      if (scanIds.length > 0) {
        await supabase.from("similarity_matches").delete().in("scan_id", scanIds);
        await supabase.from("citations").delete().in("scan_id", scanIds);
        await supabase.from("bibliographies").delete().in("scan_id", scanIds);
        await supabase.from("scan_reports").delete().in("scan_id", scanIds);
        await supabase.from("scans").delete().eq("user_id", user!.id);
      }
      await supabase.from("documents").delete().eq("user_id", user!.id);
      
      setScans([]);
      setStats({ totalScans: 0, avgSimilarity: 0, avgAiScore: 0, totalWords: 0 });
      setShowClearDialog(false);
      toast({ title: "History cleared", description: "All your scan history has been removed." });
    } catch (error) {
      console.error("Error clearing history:", error);
      toast({ title: "Error", description: "Could not clear history. Please try again.", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score <= 15) return "text-success";
    if (score <= 40) return "text-warning";
    return "text-destructive";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-accent animate-spin" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const filteredScans = scans.filter(scan => 
    scan.documents?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
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
          <button onClick={() => navigate("/")} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="font-serif text-xl text-foreground">OriginalityAI</span>
          </button>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/compare")}>
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Compare
            </Button>
            {(profile?.role === "teacher" || profile?.role === "admin") && (
              <Button variant="outline" onClick={() => navigate("/university")}>
                <Building2 className="w-4 h-4 mr-2" />
                University
              </Button>
            )}
            {profile?.role === "admin" && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                <Shield className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-foreground mb-2">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}!
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your plagiarism checks
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Total Scans</span>
            </div>
            <div className="font-serif text-3xl text-foreground">{stats.totalScans}</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
              <span className="text-sm text-muted-foreground">Avg. Similarity</span>
            </div>
            <div className={`font-serif text-3xl ${getScoreColor(stats.avgSimilarity)}`}>
              {stats.avgSimilarity}%
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Avg. AI Detection</span>
            </div>
            <div className={`font-serif text-3xl ${getScoreColor(stats.avgAiScore)}`}>
              {stats.avgAiScore}%
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">Words Scanned</span>
            </div>
            <div className="font-serif text-3xl text-foreground">
              {stats.totalWords.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Subscription & Coupon */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8 max-w-2xl">
          <SubscriptionStatusCard />
          <CouponRedeemInput />
        </div>

        {/* Scans Section */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-foreground">Your Scans</h2>
              <p className="text-sm text-muted-foreground">View and manage your plagiarism checks</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search scans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <Button variant="outline" onClick={() => navigate("/batch-scan")}>
                <Files className="w-4 h-4 mr-2" />
                Batch Scan
              </Button>
              {scans.length > 0 && (
                <Button variant="outline" onClick={() => setShowClearDialog(true)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear History
                </Button>
              )}
              <Button variant="hero" onClick={() => navigate("/scan")}>
                <Plus className="w-4 h-4 mr-2" />
                New Scan
              </Button>
            </div>
          </div>

          {filteredScans.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredScans.map((scan) => (
                <button
                  key={scan.id}
                  onClick={() => scan.status === "completed" && navigate(`/results/${scan.id}`)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  disabled={scan.status !== "completed"}
                >
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {scan.documents?.name || "Untitled Document"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(scan.created_at).toLocaleDateString()} • {scan.word_count || 0} words
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    {scan.status === "completed" ? (
                      <>
                        <div className="text-center">
                          <p className={`font-medium ${getScoreColor(scan.similarity_score)}`}>
                            {scan.similarity_score ?? "-"}%
                          </p>
                          <p className="text-xs text-muted-foreground">Similarity</p>
                        </div>
                        <div className="text-center">
                          <p className={`font-medium ${getScoreColor(scan.ai_detection_score)}`}>
                            {scan.ai_detection_score ?? "-"}%
                          </p>
                          <p className="text-xs text-muted-foreground">AI Detection</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        {getStatusIcon(scan.status)}
                        <span className="text-sm text-muted-foreground capitalize">{scan.status}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-xl text-foreground mb-2">No scans yet</h3>
              <p className="text-muted-foreground mb-6">
                Upload your first document to check for plagiarism
              </p>
              <Button variant="hero" onClick={() => navigate("/scan")}>
                <Plus className="w-4 h-4 mr-2" />
                Start Your First Scan
              </Button>
            </div>
          )}
        </div>
      </main>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all scan history?</DialogTitle>
            <DialogDescription>
              This will permanently delete all your scans, documents, and associated results. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleClearHistory} disabled={clearing}>
              {clearing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {clearing ? "Clearing..." : "Clear All History"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
};

export default Dashboard;
