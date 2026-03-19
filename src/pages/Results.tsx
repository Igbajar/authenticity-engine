import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Download, ArrowLeft, AlertCircle, CheckCircle2, 
  Brain, ExternalLink, Copy, Loader2, ChevronDown, ChevronUp, BookOpen, FileDown, Sparkles
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CitationDetector from "@/components/CitationDetector";
import SourcesPanel from "@/components/SourcesPanel";
import InternalComparisonPanel from "@/components/InternalComparisonPanel";
import HighlightedDocument from "@/components/HighlightedDocument";
import { generatePDFReport } from "@/lib/pdfExport";

interface ScanResult {
  id: string;
  similarity_score: number | null;
  ai_detection_score: number | null;
  word_count: number | null;
  processing_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
  status: string;
  documents: {
    name: string;
    content: string | null;
  } | null;
}

interface SimilarityMatch {
  id: string;
  source_url: string;
  source_title: string | null;
  matched_text: string;
  similarity_percentage: number;
}

interface ReportData {
  analysis?: {
    overallAssessment?: string;
    writingStyle?: string;
    aiIndicators?: string[];
    originalityIndicators?: string[];
  };
  suggestions?: string[];
}

interface ScanReport {
  report_data: ReportData;
}

const Results = () => {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { settings } = useAppSettings();
  const { toast } = useToast();
  
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [matches, setMatches] = useState<SimilarityMatch[]>([]);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const [humanizing, setHumanizing] = useState(false);
  const [humanizedText, setHumanizedText] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user && scanId) {
      fetchResults();
    }
  }, [user, authLoading, scanId]);

  const fetchResults = async () => {
    try {
      // Fetch scan with document info
      const { data: scanData, error: scanError } = await supabase
        .from("scans")
        .select(`
          *,
          documents (
            name,
            content
          )
        `)
        .eq("id", scanId)
        .single();

      if (scanError) throw scanError;
      setScan(scanData);

      // Fetch similarity matches
      const { data: matchesData, error: matchesError } = await supabase
        .from("similarity_matches")
        .select("*")
        .eq("scan_id", scanId)
        .order("similarity_percentage", { ascending: false });

      if (!matchesError && matchesData) {
        setMatches(matchesData);
      }

      // Fetch report
      const { data: reportData, error: reportError } = await supabase
        .from("scan_reports")
        .select("report_data")
        .eq("scan_id", scanId)
        .maybeSingle();

      if (!reportError && reportData) {
        setReport({ report_data: reportData.report_data as ReportData });
      }

    } catch (error) {
      console.error("Error fetching results:", error);
      toast({
        title: "Error loading results",
        description: "Could not load scan results",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMatch = (matchId: string) => {
    const newExpanded = new Set(expandedMatches);
    if (newExpanded.has(matchId)) {
      newExpanded.delete(matchId);
    } else {
      newExpanded.add(matchId);
    }
    setExpandedMatches(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Text has been copied",
    });
  };

  const handleHumanize = async () => {
    if (!scan?.documents?.content) return;
    setHumanizing(true);
    setHumanizedText(null);
    try {
      const { data, error } = await supabase.functions.invoke("humanize-document", {
        body: { content: scan.documents.content },
      });
      if (error) throw error;
      if (data?.humanizedText) {
        setHumanizedText(data.humanizedText);
        toast({ title: "Document humanized", description: "Your rewritten text is ready below" });
      } else {
        throw new Error(data?.error || "Failed to humanize");
      }
    } catch (err: any) {
      toast({ title: "Humanize failed", description: err.message || "Please try again", variant: "destructive" });
    } finally {
      setHumanizing(false);
    }
  };

  const copyHumanizedText = () => {
    if (!humanizedText) return;
    navigator.clipboard.writeText(humanizedText);
    toast({ title: "Copied!", description: "Humanized text copied to clipboard" });
  };

  const downloadTextReport = () => {
    if (!scan) return;

    const reportContent = `
${settings.app_name.toUpperCase()} - PLAGIARISM REPORT
====================================

Document: ${scan.documents?.name || "Unknown"}
Date: ${new Date(scan.created_at).toLocaleDateString()}
Word Count: ${scan.word_count || 0}

SUMMARY
-------
Overall Similarity Score: ${scan.similarity_score || 0}%
AI Detection Score: ${scan.ai_detection_score || 0}%
Processing Time: ${scan.processing_time_ms || 0}ms

ANALYSIS
--------
${report?.report_data?.analysis?.overallAssessment || "No analysis available"}

MATCHED SOURCES
---------------
${matches.map((m, i) => `
${i + 1}. ${m.source_title || "Unknown Source"}
   URL: ${m.source_url}
   Similarity: ${m.similarity_percentage}%
   Matched Text: "${m.matched_text.substring(0, 100)}..."
`).join("\n")}

SUGGESTIONS
-----------
${report?.report_data?.suggestions?.map((s, i) => `${i + 1}. ${s}`).join("\n") || "No suggestions available"}

---
Generated by ${settings.app_name}
    `;

    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plagiarism-report-${scan.documents?.name || "document"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Report downloaded",
      description: "Text report has been saved",
    });
  };

  const downloadPDFReport = () => {
    if (!scan) return;

    try {
      generatePDFReport(
        {
          documentName: scan.documents?.name || "Document",
          scanDate: new Date(scan.created_at).toLocaleDateString(),
          wordCount: scan.word_count || 0,
          similarityScore: scan.similarity_score || 0,
          aiScore: scan.ai_detection_score || 0,
          processingTime: scan.processing_time_ms || 0,
        },
        matches.map(m => ({
          sourceTitle: m.source_title || "Unknown Source",
          sourceUrl: m.source_url,
          similarityPercentage: m.similarity_percentage,
          matchedText: m.matched_text,
        })),
        report?.report_data ? {
          overallAssessment: report.report_data.analysis?.overallAssessment,
          writingStyle: report.report_data.analysis?.writingStyle,
          aiIndicators: report.report_data.analysis?.aiIndicators,
          originalityIndicators: report.report_data.analysis?.originalityIndicators,
          suggestions: report.report_data.suggestions,
        } : null
      );

      toast({
        title: "PDF downloaded",
        description: "Your PDF report has been saved",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error generating PDF",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 15) return "text-success";
    if (score <= 40) return "text-warning";
    return "text-destructive";
  };

  const getScoreBg = (score: number) => {
    if (score <= 15) return "bg-success/10";
    if (score <= 40) return "bg-warning/10";
    return "bg-destructive/10";
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="font-serif text-2xl text-foreground mb-2">Scan not found</h2>
          <p className="text-muted-foreground mb-6">This scan may have been deleted or doesn't exist</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const similarityScore = scan.similarity_score || 0;
  const aiScore = scan.ai_detection_score || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadTextReport}>
              <Download className="w-4 h-4 mr-2" />
              Text
            </Button>
            <Button variant="hero" onClick={downloadPDFReport}>
              <FileDown className="w-4 h-4 mr-2" />
              PDF Report
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Document Info */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="font-serif text-2xl text-foreground">{scan.documents?.name || "Document"}</h1>
              <p className="text-sm text-muted-foreground">
                Scanned on {new Date(scan.created_at).toLocaleDateString()} • {scan.word_count} words
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Scores & Analysis */}
          <div className="lg:col-span-1 space-y-6">
            {/* Similarity Score */}
            <div className={`rounded-2xl border border-border p-6 ${getScoreBg(similarityScore)}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-muted-foreground">Similarity Score</span>
                {similarityScore <= 15 ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <AlertCircle className={`w-5 h-5 ${similarityScore <= 40 ? "text-warning" : "text-destructive"}`} />
                )}
              </div>
              <div className={`font-serif text-5xl ${getScoreColor(similarityScore)}`}>
                {similarityScore}%
              </div>
              <Progress value={similarityScore} className="h-2 mt-4" />
              <p className="text-sm text-muted-foreground mt-2">
                {similarityScore <= 15 ? "Excellent originality" : 
                 similarityScore <= 40 ? "Some potential matches found" : 
                 "High similarity detected"}
              </p>
            </div>

            {/* AI Detection Score */}
            <div className={`rounded-2xl border border-border p-6 ${getScoreBg(aiScore)}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-muted-foreground">AI Detection</span>
                <Brain className="w-5 h-5 text-accent" />
              </div>
              <div className={`font-serif text-5xl ${getScoreColor(aiScore)}`}>
                {aiScore}%
              </div>
              <Progress value={aiScore} className="h-2 mt-4" />
              <p className="text-sm text-muted-foreground mt-2">
                {aiScore <= 15 ? "Likely human-written" : 
                 aiScore <= 40 ? "Possibly AI-assisted" : 
                 "Likely AI-generated"}
              </p>
              {aiScore > 40 && scan?.documents?.content && (
                <Button
                  variant="hero"
                  size="sm"
                  className="w-full mt-4"
                  onClick={handleHumanize}
                  disabled={humanizing}
                >
                  {humanizing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Humanizing...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Humanize Document</>
                  )}
                </Button>
              )}
            </div>

            {/* Humanized Text Output */}
            {humanizedText && (
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <h3 className="font-medium text-foreground">Humanized Version</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyHumanizedText}>
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </Button>
                </div>
                <div className="max-h-80 overflow-y-auto text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {humanizedText}
                </div>
              </div>
            )}

            {/* Analysis Summary */}
            {report?.report_data?.analysis && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-medium text-foreground mb-4">Analysis Summary</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {report.report_data.analysis.overallAssessment}
                </p>
                
                {report.report_data.analysis.aiIndicators && report.report_data.analysis.aiIndicators.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-foreground mb-2">AI Indicators</h4>
                    <ul className="space-y-1">
                      {report.report_data.analysis.aiIndicators.slice(0, 3).map((indicator, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.report_data.analysis.originalityIndicators && report.report_data.analysis.originalityIndicators.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Originality Indicators</h4>
                    <ul className="space-y-1">
                      {report.report_data.analysis.originalityIndicators.slice(0, 3).map((indicator, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Suggestions */}
            {report?.report_data?.suggestions && report.report_data.suggestions.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-medium text-foreground mb-4">Suggestions</h3>
                <ul className="space-y-3">
                  {report.report_data.suggestions.map((suggestion, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0 text-xs">
                        {i + 1}
                      </span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Citation Detection Tab */}
            {scan.documents?.content && (
              <div className="rounded-2xl border border-border bg-card">
                <div className="p-6 border-b border-border flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="font-medium text-foreground">Citations & Bibliography</h3>
                    <p className="text-sm text-muted-foreground">Detect citations and generate formatted bibliography</p>
                  </div>
                </div>
                <div className="p-6">
                  <CitationDetector scanId={scanId!} documentContent={scan.documents.content} />
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Matches & Document */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sources Panel - New consolidated web sources view */}
            <SourcesPanel
              sources={matches.map((m) => ({
                id: m.id,
                url: m.source_url,
                title: m.source_title,
                matchedText: m.matched_text,
                similarity: m.similarity_percentage,
              }))}
            />

            {/* Internal Comparison Panel */}
            <InternalComparisonPanel
              matches={[]}
              currentDocumentName={scan.documents?.name || "Document"}
            />

            {/* Document Preview with Highlighted Matches */}
            {scan.documents?.content && (
              <div className="rounded-2xl border border-border bg-card">
                <div className="p-6 border-b border-border">
                  <h3 className="font-medium text-foreground">Document Content</h3>
                  <p className="text-sm text-muted-foreground">Original text with highlighted matches</p>
                </div>
                <div 
                  ref={contentRef}
                  className="p-6 max-h-96 overflow-y-auto"
                >
                  <HighlightedDocument 
                    content={scan.documents.content}
                    matches={matches.map(m => ({
                      matched_text: m.matched_text,
                      similarity_percentage: m.similarity_percentage,
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Results;
