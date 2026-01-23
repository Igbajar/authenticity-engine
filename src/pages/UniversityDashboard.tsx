import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  FileText, Plus, Search, Users, Building2, BookOpen,
  Upload, BarChart3, TrendingUp, Brain, ArrowLeft,
  Loader2, MoreVertical, Trash2, Eye
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClassData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  _count?: {
    students: number;
    documents: number;
  };
}

interface StudentScan {
  id: string;
  similarity_score: number | null;
  ai_detection_score: number | null;
  created_at: string;
  documents: {
    name: string;
  } | null;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

const UniversityDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<"overview" | "classes" | "students" | "batch">("overview");
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [recentScans, setRecentScans] = useState<StudentScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Batch upload state
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalScans: 0,
    avgSimilarity: 0,
  });

  // New class form
  const [showNewClassForm, setShowNewClassForm] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch classes where user is teacher
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Fetch recent scans from teacher's classes
      const classIds = (classesData || []).map(c => c.id);
      
      if (classIds.length > 0) {
        const { data: scansData, error: scansError } = await supabase
          .from("scans")
          .select(`
            id,
            similarity_score,
            ai_detection_score,
            created_at,
            documents (
              name,
              class_id
            )
          `)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!scansError && scansData) {
          // Filter scans that belong to teacher's classes
          const filteredScans = scansData.filter(scan => 
            scan.documents?.class_id && classIds.includes(scan.documents.class_id)
          );
          setRecentScans(filteredScans.slice(0, 10) as StudentScan[]);
        }
      }

      // Calculate stats
      const { count: studentCount } = await supabase
        .from("class_memberships")
        .select("*", { count: "exact", head: true })
        .in("class_id", classIds);

      setStats({
        totalStudents: studentCount || 0,
        totalClasses: classesData?.length || 0,
        totalScans: recentScans.length,
        avgSimilarity: recentScans.length > 0 
          ? Math.round(recentScans.reduce((acc, s) => acc + (s.similarity_score || 0), 0) / recentScans.length)
          : 0,
      });

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error loading data",
        description: "Could not load university dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createClass = async () => {
    if (!newClassName.trim()) {
      toast({
        title: "Class name required",
        description: "Please enter a name for the class",
        variant: "destructive",
      });
      return;
    }

    try {
      // First, get or create a university for the teacher
      let universityId: string;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("university_id")
        .eq("user_id", user!.id)
        .single();

      if (profile?.university_id) {
        universityId = profile.university_id;
      } else {
        // Create a default university
        const { data: newUniversity, error: uniError } = await supabase
          .from("universities")
          .insert({
            name: "My Institution",
          })
          .select()
          .single();

        if (uniError) throw uniError;
        universityId = newUniversity.id;

        // Update profile with university
        await supabase
          .from("profiles")
          .update({ university_id: universityId, role: "teacher" })
          .eq("user_id", user!.id);
      }

      const { data, error } = await supabase
        .from("classes")
        .insert({
          name: newClassName,
          description: newClassDescription || null,
          university_id: universityId,
          teacher_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      setClasses([data, ...classes]);
      setShowNewClassForm(false);
      setNewClassName("");
      setNewClassDescription("");

      toast({
        title: "Class created",
        description: `${newClassName} has been created successfully`,
      });

    } catch (error) {
      console.error("Error creating class:", error);
      toast({
        title: "Error creating class",
        description: "Could not create the class",
        variant: "destructive",
      });
    }
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setBatchFiles(files);
  };

  const processBatchUpload = async () => {
    if (batchFiles.length === 0) return;

    setBatchProcessing(true);
    toast({
      title: "Processing batch upload",
      description: `Uploading ${batchFiles.length} documents...`,
    });

    // In a real implementation, this would upload and scan each file
    setTimeout(() => {
      setBatchProcessing(false);
      setBatchFiles([]);
      toast({
        title: "Batch upload complete",
        description: `${batchFiles.length} documents have been queued for scanning`,
      });
    }, 3000);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score <= 15) return "text-success";
    if (score <= 40) return "text-warning";
    return "text-destructive";
  };

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
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/dashboard")} 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-serif text-xl text-foreground">University Dashboard</span>
            </div>
          </div>
          
          <Button variant="hero" onClick={() => setShowNewClassForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Class
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card/30">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "classes", label: "Classes", icon: BookOpen },
              { id: "students", label: "Students", icon: Users },
              { id: "batch", label: "Batch Upload", icon: Upload },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                  activeTab === tab.id
                    ? "text-accent border-accent"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* New Class Form Modal */}
        {showNewClassForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md mx-4">
              <h3 className="font-serif text-xl text-foreground mb-4">Create New Class</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Class Name</label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g., Introduction to Computer Science"
                    className="w-full h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Description (optional)</label>
                  <textarea
                    value={newClassDescription}
                    onChange={(e) => setNewClassDescription(e.target.value)}
                    placeholder="Brief description of the class"
                    className="w-full h-24 p-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowNewClassForm(false)}>
                  Cancel
                </Button>
                <Button variant="hero" onClick={createClass}>
                  Create Class
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-accent" />
                  </div>
                  <span className="text-sm text-muted-foreground">Classes</span>
                </div>
                <div className="font-serif text-3xl text-foreground">{stats.totalClasses}</div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-success" />
                  </div>
                  <span className="text-sm text-muted-foreground">Students</span>
                </div>
                <div className="font-serif text-3xl text-foreground">{stats.totalStudents}</div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-warning" />
                  </div>
                  <span className="text-sm text-muted-foreground">Total Scans</span>
                </div>
                <div className="font-serif text-3xl text-foreground">{stats.totalScans}</div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-destructive" />
                  </div>
                  <span className="text-sm text-muted-foreground">Avg. Similarity</span>
                </div>
                <div className={`font-serif text-3xl ${getScoreColor(stats.avgSimilarity)}`}>
                  {stats.avgSimilarity}%
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-border bg-card">
              <div className="p-6 border-b border-border">
                <h3 className="font-serif text-xl text-foreground">Recent Submissions</h3>
                <p className="text-sm text-muted-foreground">Latest scans from your classes</p>
              </div>
              
              {recentScans.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentScans.map((scan) => (
                    <div key={scan.id} className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {scan.documents?.name || "Document"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(scan.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
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
                          <p className="text-xs text-muted-foreground">AI</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">No recent submissions</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === "classes" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search classes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            {classes.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes
                  .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((classItem) => (
                    <div key={classItem.id} className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-accent" />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <h4 className="font-medium text-foreground mb-1">{classItem.name}</h4>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {classItem.description || "No description"}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {classItem._count?.students || 0} students
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {classItem._count?.documents || 0} docs
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-xl text-foreground mb-2">No classes yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first class to start managing student submissions
                </p>
                <Button variant="hero" onClick={() => setShowNewClassForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Class
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Students Tab */}
        {activeTab === "students" && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-serif text-xl text-foreground mb-2">Student Management</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Invite students to your classes by sharing a class code or sending email invitations.
              Once enrolled, you can view their submissions and plagiarism scores.
            </p>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Invite Students
            </Button>
          </div>
        )}

        {/* Batch Upload Tab */}
        {activeTab === "batch" && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-serif text-2xl text-foreground mb-2">Batch Upload</h3>
                <p className="text-muted-foreground">
                  Upload multiple documents at once to scan for plagiarism
                </p>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                {batchFiles.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-left space-y-2">
                      {batchFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm text-foreground flex-1 truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-3">
                      <Button variant="outline" onClick={() => setBatchFiles([])}>
                        Clear
                      </Button>
                      <Button 
                        variant="hero" 
                        onClick={processBatchUpload}
                        disabled={batchProcessing}
                      >
                        {batchProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4 mr-2" />
                            Scan All Documents
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium mb-2">
                      Drop files here or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supports PDF, DOCX, TXT files (max 10MB each)
                    </p>
                    <label>
                      <Button variant="secondary" size="sm" asChild>
                        <span>Select Files</span>
                      </Button>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={handleBatchUpload}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default UniversityDashboard;
