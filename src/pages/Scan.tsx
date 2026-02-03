import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Link, X, Loader2, CheckCircle2, Brain, Search, FileCheck, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { extractTextFromFile } from "@/lib/documentParser";
import ScanProgressRealtime from "@/components/ScanProgressRealtime";

const scanStages = [
  { id: "upload", label: "Uploading document", icon: Upload },
  { id: "sources", label: "Checking sources", icon: Search },
  { id: "ai", label: "Detecting AI content", icon: Brain },
  { id: "report", label: "Generating report", icon: FileCheck },
];

const Scan = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlContent, setUrlContent] = useState<{ content: string; title: string } | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "paste" | "url">("upload");
  const [isScanning, setIsScanning] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);

  const { user } = useAuth();
  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [useRealtimeProgress, setUseRealtimeProgress] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    // Use the document parser to properly extract text from DOCX, PDF, etc.
    return extractTextFromFile(file);
  };

  const simulateStageProgress = (stageIndex: number): Promise<void> => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setTimeout(resolve, 300);
        }
        setStageProgress(progress);
      }, 200);
    });
  };

  const fetchUrlContent = async () => {
    if (!urlInput.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a URL to fetch",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingUrl(true);
    try {
      const response = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url: urlInput },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch URL");
      }

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to scrape content");
      }

      const content = response.data.content;
      const title = response.data.title;

      if (!content || content.trim().length < 50) {
        throw new Error("Could not extract enough content from this URL");
      }

      setUrlContent({ content, title });
      toast({
        title: "Content fetched",
        description: `Extracted content from "${title}"`,
      });
    } catch (error) {
      console.error("Error fetching URL:", error);
      toast({
        title: "Error fetching URL",
        description: error instanceof Error ? error.message : "Failed to fetch content from URL",
        variant: "destructive",
      });
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleScan = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to scan documents",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    let content = "";
    let fileName = "Pasted Text";

    if (activeTab === "upload" && file) {
      try {
        content = await readFileContent(file);
        fileName = file.name;
      } catch {
        toast({
          title: "Error reading file",
          description: "Could not read the file content. Please try a text-based file.",
          variant: "destructive",
        });
        return;
      }
    } else if (activeTab === "paste") {
      content = textInput;
    } else if (activeTab === "url" && urlContent) {
      content = urlContent.content;
      fileName = urlContent.title;
    }

    if (content.split(/\s+/).filter(Boolean).length < 50) {
      toast({
        title: "Content too short",
        description: "Please provide at least 50 words for analysis",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    setCurrentStage(0);
    setStageProgress(0);
    setScanComplete(false);

    try {
      // Stage 0: Upload document
      await simulateStageProgress(0);
      setCurrentStage(1);
      setStageProgress(0);

      // Create document record
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          name: fileName,
          content: content,
          file_type: file?.type || "text/plain",
          file_size: file?.size || content.length,
        })
        .select()
        .single();

      if (docError) throw docError;

      // Create scan record
      const { data: scanData, error: scanError } = await supabase
        .from("scans")
        .insert({
          document_id: docData.id,
          user_id: user.id,
          status: "pending",
          word_count: content.split(/\s+/).filter(Boolean).length,
        })
        .select()
        .single();

      if (scanError) throw scanError;

      setScanId(scanData.id);

      // Stage 1: Checking sources
      await simulateStageProgress(1);
      setCurrentStage(2);
      setStageProgress(0);

      // Stage 2: AI Detection - Call the edge function
      const { data: session } = await supabase.auth.getSession();
      
      const analyzeResponse = await supabase.functions.invoke("analyze-document", {
        body: {
          content,
          documentId: docData.id,
          scanId: scanData.id,
        },
      });

      if (analyzeResponse.error) {
        throw new Error(analyzeResponse.error.message || "Analysis failed");
      }

      await simulateStageProgress(2);
      setCurrentStage(3);
      setStageProgress(0);

      // Stage 3: Generating report
      await simulateStageProgress(3);

      setScanComplete(true);

      toast({
        title: "Scan complete!",
        description: "Your document has been analyzed successfully.",
      });

      // Navigate to results after a brief delay
      setTimeout(() => {
        navigate(`/results/${scanData.id}`);
      }, 1500);

    } catch (error) {
      console.error("Scan error:", error);
      toast({
        title: "Scan failed",
        description: error instanceof Error ? error.message : "An error occurred during scanning",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  };

  const tabs = [
    { id: "upload", label: "Upload File", icon: Upload },
    { id: "paste", label: "Paste Text", icon: FileText },
    { id: "url", label: "From URL", icon: Link },
  ] as const;

  const overallProgress = isScanning 
    ? ((currentStage * 100 + stageProgress) / scanStages.length)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="font-serif text-xl text-foreground">{settings.app_name}</span>
          </button>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-4">
              {isScanning ? "Analyzing Document" : "New Scan"}
            </h1>
            <p className="text-muted-foreground text-lg">
              {isScanning 
                ? "Please wait while we analyze your document for plagiarism and AI content" 
                : "Upload a document or paste text to check for plagiarism and AI-generated content"}
            </p>
          </div>

          {/* Scanning Progress */}
          {isScanning ? (
            <div className="bg-card rounded-2xl border border-border shadow-lg p-8">
              {/* Overall Progress */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-foreground">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">{Math.round(overallProgress)}%</span>
                </div>
                <Progress value={overallProgress} className="h-3" />
              </div>

              {/* Stages */}
              <div className="space-y-4">
                {scanStages.map((stage, index) => {
                  const isActive = index === currentStage;
                  const isComplete = index < currentStage || scanComplete;
                  const isPending = index > currentStage;

                  return (
                    <div
                      key={stage.id}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                        isActive 
                          ? "bg-accent/10 border border-accent/30" 
                          : isComplete 
                          ? "bg-success/10 border border-success/30" 
                          : "bg-muted/30 border border-transparent"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isComplete 
                          ? "bg-success text-white" 
                          : isActive 
                          ? "bg-accent text-white" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isComplete ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : isActive ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <stage.icon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          isComplete ? "text-success" : isActive ? "text-accent" : "text-muted-foreground"
                        }`}>
                          {stage.label}
                        </p>
                        {isActive && (
                          <Progress value={stageProgress} className="h-1.5 mt-2" />
                        )}
                      </div>
                      {isComplete && (
                        <span className="text-sm text-success">Complete</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {scanComplete && (
                <div className="mt-8 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                  <h3 className="font-serif text-2xl text-foreground mb-2">Analysis Complete!</h3>
                  <p className="text-muted-foreground">Redirecting to your results...</p>
                </div>
              )}
            </div>
          ) : (
            /* Upload Card */
            <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-accent/10 text-accent border-b-2 border-accent -mb-[1px]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-8">
                {activeTab === "upload" && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                      isDragging
                        ? "border-accent bg-accent/5"
                        : file
                        ? "border-success bg-success/5"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-success" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-foreground">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={() => setFile(null)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                          <Upload className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-foreground font-medium mb-2">
                          Drop your document here
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Supports TXT, DOC, DOCX, PDF up to 10MB
                        </p>
                        <label>
                          <Button variant="secondary" size="sm" asChild>
                            <span>Browse Files</span>
                          </Button>
                          <input
                            type="file"
                            className="hidden"
                            accept=".txt,.doc,.docx,.pdf"
                            onChange={handleFileSelect}
                          />
                        </label>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "paste" && (
                  <div>
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Paste your text here to check for plagiarism and AI-generated content..."
                      className="w-full h-64 p-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                    />
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-sm text-muted-foreground">
                        {textInput.split(/\s+/).filter(Boolean).length} words
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Minimum 50 words required
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "url" && (
                  <div>
                    {urlContent ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/30 rounded-xl">
                          <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-success" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{urlContent.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {urlContent.content.split(/\s+/).filter(Boolean).length} words extracted
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setUrlContent(null);
                              setUrlInput("");
                            }}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-xl max-h-48 overflow-y-auto">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                            {urlContent.content.substring(0, 500)}...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-3">
                          <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://example.com/article"
                            className="flex-1 h-12 px-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                            disabled={isFetchingUrl}
                          />
                          <Button 
                            variant="secondary" 
                            onClick={fetchUrlContent}
                            disabled={isFetchingUrl || !urlInput.trim()}
                          >
                            {isFetchingUrl ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Fetching...
                              </>
                            ) : (
                              "Fetch"
                            )}
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                          Enter a URL to a web page or article to analyze its content
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Scan Button */}
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="hero"
                    size="xl"
                    onClick={handleScan}
                    disabled={isScanning || (!file && !textInput.trim() && !urlContent)}
                    className="min-w-[200px]"
                  >
                    Start Analysis
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Scan;
