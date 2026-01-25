import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, FileText, X, Loader2, CheckCircle2, Brain, Search, 
  FileCheck, AlertCircle, ArrowLeft, Files, Trash2 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileWithStatus {
  file: File;
  id: string;
  status: "pending" | "uploading" | "analyzing" | "complete" | "error";
  progress: number;
  scanId?: string;
  error?: string;
  results?: {
    similarityScore: number;
    aiScore: number;
  };
}

const scanStages = [
  { id: "upload", label: "Uploading", icon: Upload },
  { id: "sources", label: "Checking sources", icon: Search },
  { id: "ai", label: "AI Detection", icon: Brain },
  { id: "report", label: "Complete", icon: FileCheck },
];

const BatchScan = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const validTypes = ['.txt', '.doc', '.docx', '.pdf'];
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return validTypes.includes(extension) && file.size <= 10 * 1024 * 1024;
    });

    if (validFiles.length !== newFiles.length) {
      toast({
        title: "Some files skipped",
        description: "Only TXT, DOC, DOCX, PDF files under 10MB are allowed",
        variant: "destructive",
      });
    }

    const filesWithStatus: FileWithStatus[] = validFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      status: "pending",
      progress: 0,
    }));

    setFiles(prev => [...prev, ...filesWithStatus]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  const updateFileStatus = (id: string, updates: Partial<FileWithStatus>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const processFile = async (fileWithStatus: FileWithStatus): Promise<void> => {
    const { file, id } = fileWithStatus;

    try {
      // Stage 1: Uploading
      updateFileStatus(id, { status: "uploading", progress: 10 });

      let content: string;
      try {
        content = await readFileContent(file);
      } catch {
        throw new Error("Could not read file content");
      }

      const wordCount = content.split(/\s+/).filter(Boolean).length;
      if (wordCount < 50) {
        throw new Error("Document must have at least 50 words");
      }

      updateFileStatus(id, { progress: 25 });

      // Create document record
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user!.id,
          name: file.name,
          content: content,
          file_type: file.type || "text/plain",
          file_size: file.size,
        })
        .select()
        .single();

      if (docError) throw docError;

      updateFileStatus(id, { progress: 35 });

      // Create scan record
      const { data: scanData, error: scanError } = await supabase
        .from("scans")
        .insert({
          document_id: docData.id,
          user_id: user!.id,
          status: "pending",
          word_count: wordCount,
        })
        .select()
        .single();

      if (scanError) throw scanError;

      updateFileStatus(id, { status: "analyzing", progress: 50, scanId: scanData.id });

      // Stage 2: Analyze
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

      updateFileStatus(id, { progress: 85 });

      // Get results from the updated scan
      const { data: scanResult } = await supabase
        .from("scans")
        .select("similarity_score, ai_detection_score")
        .eq("id", scanData.id)
        .single();

      updateFileStatus(id, { 
        status: "complete", 
        progress: 100,
        results: {
          similarityScore: scanResult?.similarity_score || 0,
          aiScore: scanResult?.ai_detection_score || 0,
        }
      });

    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      updateFileStatus(id, { 
        status: "error", 
        progress: 0,
        error: error instanceof Error ? error.message : "Processing failed"
      });
    }
  };

  const startBatchScan = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to scan documents",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please add files to scan",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setCurrentFileIndex(0);

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i);
      await processFile(files[i]);
    }

    setIsProcessing(false);

    const successCount = files.filter(f => f.status === "complete").length;
    const errorCount = files.filter(f => f.status === "error").length;

    toast({
      title: "Batch scan complete",
      description: `${successCount} successful, ${errorCount} failed`,
    });
  };

  const getStatusIcon = (status: FileWithStatus["status"]) => {
    switch (status) {
      case "pending":
        return <FileText className="w-5 h-5 text-muted-foreground" />;
      case "uploading":
        return <Upload className="w-5 h-5 text-accent animate-pulse" />;
      case "analyzing":
        return <Brain className="w-5 h-5 text-accent animate-pulse" />;
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 15) return "text-success";
    if (score <= 30) return "text-warning";
    return "text-destructive";
  };

  const completedCount = files.filter(f => f.status === "complete").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const overallProgress = files.length > 0 
    ? (files.reduce((acc, f) => acc + f.progress, 0) / files.length) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
                <Files className="w-5 h-5 text-white" />
              </div>
              <span className="font-serif text-xl text-foreground">Batch Scan</span>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-4">
              Batch Document Scan
            </h1>
            <p className="text-muted-foreground text-lg">
              Upload multiple documents and analyze them all at once
            </p>
          </div>

          {/* Upload Area */}
          {!isProcessing && files.length === 0 && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-serif text-2xl text-foreground mb-2">
                Drop your documents here
              </h3>
              <p className="text-muted-foreground mb-6">
                Supports TXT, DOC, DOCX, PDF files up to 10MB each
              </p>
              <label>
                <Button variant="hero" size="lg" asChild>
                  <span>Select Files</span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".txt,.doc,.docx,.pdf"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
              {/* Overall Progress */}
              {isProcessing && (
                <div className="p-6 border-b border-border bg-accent/5">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-accent" />
                      <span className="font-medium text-foreground">
                        Processing {currentFileIndex + 1} of {files.length}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(overallProgress)}% complete
                    </span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>
              )}

              {/* Summary */}
              {!isProcessing && files.some(f => f.status !== "pending") && (
                <div className="p-6 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <span className="text-sm font-medium">{completedCount} Complete</span>
                    </div>
                    {errorCount > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-destructive" />
                        <span className="text-sm font-medium">{errorCount} Failed</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* File List Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">
                  {files.length} document{files.length !== 1 ? "s" : ""}
                </span>
                {!isProcessing && (
                  <div className="flex items-center gap-2">
                    <label>
                      <Button variant="ghost" size="sm" asChild>
                        <span>Add More</span>
                      </Button>
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept=".txt,.doc,.docx,.pdf"
                        onChange={handleFileSelect}
                      />
                    </label>
                    <Button variant="ghost" size="sm" onClick={clearAllFiles}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear All
                    </Button>
                  </div>
                )}
              </div>

              {/* Files */}
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {files.map((fileWithStatus) => (
                  <div
                    key={fileWithStatus.id}
                    className={`p-4 flex items-center gap-4 transition-colors ${
                      fileWithStatus.status === "complete" ? "bg-success/5" :
                      fileWithStatus.status === "error" ? "bg-destructive/5" :
                      fileWithStatus.status !== "pending" ? "bg-accent/5" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      {getStatusIcon(fileWithStatus.status)}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {fileWithStatus.file.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {(fileWithStatus.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        {fileWithStatus.status === "error" && (
                          <span className="text-xs text-destructive">
                            {fileWithStatus.error}
                          </span>
                        )}
                        {(fileWithStatus.status === "uploading" || fileWithStatus.status === "analyzing") && (
                          <span className="text-xs text-accent capitalize">
                            {fileWithStatus.status}...
                          </span>
                        )}
                      </div>
                      {/* Progress Bar */}
                      {(fileWithStatus.status === "uploading" || fileWithStatus.status === "analyzing") && (
                        <Progress value={fileWithStatus.progress} className="h-1 mt-2" />
                      )}
                    </div>

                    {/* Results or Actions */}
                    {fileWithStatus.status === "complete" && fileWithStatus.results && (
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Similarity</p>
                          <p className={`font-medium ${getScoreColor(fileWithStatus.results.similarityScore)}`}>
                            {fileWithStatus.results.similarityScore}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">AI</p>
                          <p className={`font-medium ${getScoreColor(fileWithStatus.results.aiScore)}`}>
                            {fileWithStatus.results.aiScore}%
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/results/${fileWithStatus.scanId}`)}
                        >
                          View
                        </Button>
                      </div>
                    )}

                    {fileWithStatus.status === "pending" && !isProcessing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(fileWithStatus.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              {!isProcessing && files.some(f => f.status === "pending") && (
                <div className="p-6 border-t border-border bg-muted/30">
                  <div className="flex justify-center">
                    <Button
                      variant="hero"
                      size="xl"
                      onClick={startBatchScan}
                      className="min-w-[200px]"
                    >
                      <Brain className="w-5 h-5 mr-2" />
                      Scan All Documents
                    </Button>
                  </div>
                </div>
              )}

              {/* Completed Actions */}
              {!isProcessing && completedCount > 0 && !files.some(f => f.status === "pending") && (
                <div className="p-6 border-t border-border bg-muted/30">
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={clearAllFiles}>
                      Scan More Documents
                    </Button>
                    <Button variant="hero" onClick={() => navigate("/dashboard")}>
                      View Dashboard
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BatchScan;