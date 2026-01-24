import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, Upload, ArrowLeft, Loader2, X, 
  CheckCircle2, AlertTriangle, ArrowLeftRight, Eye
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  name: string;
  content: string | null;
  created_at: string;
}

interface MatchingSection {
  textA: string;
  textB: string;
  startA: number;
  endA: number;
  startB: number;
  endB: number;
  similarity: number;
}

interface ComparisonResult {
  id: string;
  similarity_score: number | null;
  matching_sections: MatchingSection[];
  status: string;
}

const Compare = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentA, setDocumentA] = useState<Document | null>(null);
  const [documentB, setDocumentB] = useState<Document | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMatch, setActiveMatch] = useState<number | null>(null);

  // Upload states
  const [uploadingA, setUploadingA] = useState(false);
  const [uploadingB, setUploadingB] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, content, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, side: "A" | "B") => {
    if (side === "A") setUploadingA(true);
    else setUploadingB(true);

    try {
      const content = await readFileContent(file);
      
      const { data, error } = await supabase
        .from("documents")
        .insert({
          user_id: user!.id,
          name: file.name,
          content,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;

      if (side === "A") setDocumentA(data);
      else setDocumentB(data);

      setDocuments(prev => [data, ...prev]);

      toast({
        title: "Document uploaded",
        description: `${file.name} has been uploaded successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Could not upload the document",
        variant: "destructive",
      });
    } finally {
      if (side === "A") setUploadingA(false);
      else setUploadingB(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  const compareDocuments = async () => {
    if (!documentA || !documentB || !user) return;

    setIsComparing(true);

    try {
      // Create comparison record
      const { data: comparisonData, error: compError } = await supabase
        .from("document_comparisons")
        .insert({
          user_id: user.id,
          document_a_id: documentA.id,
          document_b_id: documentB.id,
          status: "processing",
        })
        .select()
        .single();

      if (compError) throw compError;

      // Call edge function for comparison
      const { data: result, error: funcError } = await supabase.functions.invoke("compare-documents", {
        body: {
          comparisonId: comparisonData.id,
          contentA: documentA.content,
          contentB: documentB.content,
        },
      });

      if (funcError) throw funcError;

      // Fetch updated comparison
      const { data: updatedComparison } = await supabase
        .from("document_comparisons")
        .select("*")
        .eq("id", comparisonData.id)
        .single();

      if (updatedComparison) {
        setComparisonResult({
          id: updatedComparison.id,
          similarity_score: updatedComparison.similarity_score,
          matching_sections: (updatedComparison.matching_sections as unknown as MatchingSection[]) || [],
          status: updatedComparison.status,
        });
      }

      toast({
        title: "Comparison complete",
        description: "Documents have been analyzed for similarities",
      });
    } catch (error) {
      console.error("Comparison error:", error);
      toast({
        title: "Comparison failed",
        description: error instanceof Error ? error.message : "Could not compare documents",
        variant: "destructive",
      });
    } finally {
      setIsComparing(false);
    }
  };

  const highlightText = (text: string, sections: MatchingSection[], side: "A" | "B") => {
    if (!sections.length) return text;

    const sortedSections = [...sections].sort((a, b) => 
      side === "A" ? a.startA - b.startA : a.startB - b.startB
    );

    let lastEnd = 0;
    const parts: JSX.Element[] = [];

    sortedSections.forEach((section, index) => {
      const start = side === "A" ? section.startA : section.startB;
      const end = side === "A" ? section.endA : section.endB;

      if (start > lastEnd) {
        parts.push(<span key={`text-${index}`}>{text.slice(lastEnd, start)}</span>);
      }

      parts.push(
        <mark
          key={`match-${index}`}
          className={`cursor-pointer transition-all ${
            activeMatch === index
              ? "bg-warning/50 ring-2 ring-warning"
              : "bg-warning/30 hover:bg-warning/40"
          }`}
          onClick={() => setActiveMatch(activeMatch === index ? null : index)}
        >
          {text.slice(start, end)}
        </mark>
      );

      lastEnd = end;
    });

    if (lastEnd < text.length) {
      parts.push(<span key="text-end">{text.slice(lastEnd)}</span>);
    }

    return parts;
  };

  const getScoreColor = (score: number) => {
    if (score <= 20) return "text-success";
    if (score <= 50) return "text-warning";
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
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="font-serif text-xl text-foreground">Document Comparison</h1>
          <div className="w-32" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!comparisonResult ? (
          <>
            {/* Document Selection */}
            <div className="text-center mb-8">
              <h2 className="font-serif text-3xl text-foreground mb-2">Compare Documents</h2>
              <p className="text-muted-foreground">
                Select or upload two documents to compare side-by-side
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Document A */}
              <DocumentSelector
                label="Document A"
                document={documentA}
                documents={documents}
                uploading={uploadingA}
                onSelect={setDocumentA}
                onUpload={(file) => handleFileUpload(file, "A")}
                onClear={() => setDocumentA(null)}
              />

              {/* Document B */}
              <DocumentSelector
                label="Document B"
                document={documentB}
                documents={documents}
                uploading={uploadingB}
                onSelect={setDocumentB}
                onUpload={(file) => handleFileUpload(file, "B")}
                onClear={() => setDocumentB(null)}
              />
            </div>

            {/* Compare Button */}
            <div className="flex justify-center">
              <Button
                variant="hero"
                size="xl"
                onClick={compareDocuments}
                disabled={!documentA || !documentB || isComparing}
                className="min-w-[200px]"
              >
                {isComparing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-5 h-5 mr-2" />
                    Compare Documents
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-serif text-3xl text-foreground mb-2">Comparison Results</h2>
                <p className="text-muted-foreground">
                  Found {comparisonResult.matching_sections.length} matching sections
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`text-center px-6 py-3 rounded-xl border border-border bg-card`}>
                  <div className={`font-serif text-3xl ${getScoreColor(comparisonResult.similarity_score || 0)}`}>
                    {comparisonResult.similarity_score?.toFixed(1) || 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">Similarity</div>
                </div>
                <Button variant="outline" onClick={() => setComparisonResult(null)}>
                  New Comparison
                </Button>
              </div>
            </div>

            {/* Matching Sections List */}
            {comparisonResult.matching_sections.length > 0 && (
              <div className="mb-6 p-4 rounded-xl border border-border bg-card">
                <h3 className="font-medium text-foreground mb-3">Matching Sections</h3>
                <div className="flex flex-wrap gap-2">
                  {comparisonResult.matching_sections.map((section, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveMatch(activeMatch === index ? null : index)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        activeMatch === index
                          ? "bg-warning text-warning-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Match {index + 1} ({section.similarity}%)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Side-by-side View */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" />
                    <span className="font-medium text-foreground">{documentA?.name}</span>
                  </div>
                </div>
                <div className="p-6 max-h-[600px] overflow-y-auto">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {documentA?.content && highlightText(
                      documentA.content,
                      comparisonResult.matching_sections,
                      "A"
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-accent" />
                    <span className="font-medium text-foreground">{documentB?.name}</span>
                  </div>
                </div>
                <div className="p-6 max-h-[600px] overflow-y-auto">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {documentB?.content && highlightText(
                      documentB.content,
                      comparisonResult.matching_sections,
                      "B"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

// Document Selector Component
interface DocumentSelectorProps {
  label: string;
  document: Document | null;
  documents: Document[];
  uploading: boolean;
  onSelect: (doc: Document) => void;
  onUpload: (file: File) => void;
  onClear: () => void;
}

const DocumentSelector = ({
  label,
  document,
  documents,
  uploading,
  onSelect,
  onUpload,
  onClear,
}: DocumentSelectorProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showList, setShowList] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/50">
        <span className="font-medium text-foreground">{label}</span>
      </div>

      <div className="p-6">
        {document ? (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-success/10 border border-success/30">
            <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{document.name}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(document.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={onClear}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragging ? "border-accent bg-accent/5" : "border-border"
            }`}
          >
            {uploading ? (
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-accent" />
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Drop a file here or choose from your documents
                </p>
                <div className="flex gap-2 justify-center">
                  <label>
                    <Button variant="secondary" size="sm" asChild>
                      <span>Upload File</span>
                    </Button>
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.doc,.docx,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload(file);
                      }}
                    />
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowList(!showList)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Browse
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Document List */}
        {showList && !document && (
          <div className="mt-4 max-h-48 overflow-y-auto border border-border rounded-xl">
            {documents.length > 0 ? (
              <div className="divide-y divide-border">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      onSelect(doc);
                      setShowList(false);
                    }}
                    className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 text-left transition-colors"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{doc.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No documents found. Upload one first.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Compare;