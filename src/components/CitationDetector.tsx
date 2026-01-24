import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, Download, Copy, CheckCircle2, 
  AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Citation {
  id: string;
  citation_text: string;
  citation_type: string;
  author: string | null;
  title: string | null;
  year: string | null;
  source: string | null;
  url: string | null;
  is_valid: boolean;
}

interface Bibliography {
  id: string;
  format: string;
  entries: CitationEntry[];
  generated_text: string | null;
}

interface CitationEntry {
  id: string;
  formatted: string;
  author?: string;
  title?: string;
  year?: string;
  source?: string;
}

interface CitationDetectorProps {
  scanId: string;
  documentContent: string;
}

const CitationDetector = ({ scanId, documentContent }: CitationDetectorProps) => {
  const { toast } = useToast();

  const [citations, setCitations] = useState<Citation[]>([]);
  const [bibliography, setBibliography] = useState<Bibliography | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>("apa");
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCitationsAndBibliography();
  }, [scanId]);

  const fetchCitationsAndBibliography = async () => {
    try {
      // Fetch citations
      const { data: citationsData } = await supabase
        .from("citations")
        .select("*")
        .eq("scan_id", scanId)
        .order("position_start", { ascending: true });

      if (citationsData) {
        setCitations(citationsData);
      }

      // Fetch bibliography
      const { data: bibData } = await supabase
        .from("bibliographies")
        .select("*")
        .eq("scan_id", scanId)
        .maybeSingle();

      if (bibData) {
        setBibliography({
          ...bibData,
          entries: Array.isArray(bibData.entries) ? (bibData.entries as unknown as CitationEntry[]) : [],
        });
        setSelectedFormat(bibData.format);
      }
    } catch (error) {
      console.error("Error fetching citations:", error);
    } finally {
      setLoading(false);
    }
  };

  const detectCitations = async () => {
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("detect-citations", {
        body: {
          scanId,
          content: documentContent,
        },
      });

      if (error) throw error;

      await fetchCitationsAndBibliography();

      toast({
        title: "Citations detected",
        description: `Found ${data.citationsCount} citations in your document`,
      });
    } catch (error) {
      console.error("Citation detection error:", error);
      toast({
        title: "Detection failed",
        description: "Could not detect citations",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateBibliography = async () => {
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-bibliography", {
        body: {
          scanId,
          format: selectedFormat,
          citations,
        },
      });

      if (error) throw error;

      await fetchCitationsAndBibliography();

      toast({
        title: "Bibliography generated",
        description: `Created ${selectedFormat.toUpperCase()} format bibliography`,
      });
    } catch (error) {
      console.error("Bibliography generation error:", error);
      toast({
        title: "Generation failed",
        description: "Could not generate bibliography",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyBibliography = () => {
    if (bibliography?.generated_text) {
      navigator.clipboard.writeText(bibliography.generated_text);
      toast({
        title: "Copied",
        description: "Bibliography copied to clipboard",
      });
    }
  };

  const downloadBibliography = () => {
    if (!bibliography?.generated_text) return;

    const blob = new Blob([bibliography.generated_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bibliography-${selectedFormat}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Bibliography saved to file",
    });
  };

  const toggleCitation = (citationId: string) => {
    const newExpanded = new Set(expandedCitations);
    if (newExpanded.has(citationId)) {
      newExpanded.delete(citationId);
    } else {
      newExpanded.add(citationId);
    }
    setExpandedCitations(newExpanded);
  };

  const getCitationTypeColor = (type: string) => {
    switch (type) {
      case "apa": return "bg-blue-500/10 text-blue-600";
      case "mla": return "bg-purple-500/10 text-purple-600";
      case "chicago": return "bg-orange-500/10 text-orange-600";
      case "harvard": return "bg-green-500/10 text-green-600";
      case "ieee": return "bg-cyan-500/10 text-cyan-600";
      default: return "bg-muted text-muted-foreground";
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
    <div className="space-y-6">
      {/* Detection Section */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Citation Detection</h3>
              <p className="text-sm text-muted-foreground">
                {citations.length > 0 
                  ? `Found ${citations.length} citations` 
                  : "Detect and analyze citations in your document"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={detectCitations}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {citations.length > 0 ? "Re-detect" : "Detect Citations"}
          </Button>
        </div>

        {/* Citations List */}
        {citations.length > 0 && (
          <div className="space-y-2 mt-4">
            {citations.map((citation) => (
              <div
                key={citation.id}
                className="border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleCitation(citation.id)}
                  className="w-full p-4 flex items-start justify-between text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {citation.is_valid ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getCitationTypeColor(citation.citation_type)}`}>
                        {citation.citation_type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">
                      "{citation.citation_text}"
                    </p>
                  </div>
                  {expandedCitations.has(citation.id) ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
                  )}
                </button>

                {expandedCitations.has(citation.id) && (
                  <div className="p-4 pt-0 border-t border-border bg-muted/30">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {citation.author && (
                        <div>
                          <span className="text-muted-foreground">Author:</span>
                          <span className="text-foreground ml-2">{citation.author}</span>
                        </div>
                      )}
                      {citation.title && (
                        <div>
                          <span className="text-muted-foreground">Title:</span>
                          <span className="text-foreground ml-2">{citation.title}</span>
                        </div>
                      )}
                      {citation.year && (
                        <div>
                          <span className="text-muted-foreground">Year:</span>
                          <span className="text-foreground ml-2">{citation.year}</span>
                        </div>
                      )}
                      {citation.source && (
                        <div>
                          <span className="text-muted-foreground">Source:</span>
                          <span className="text-foreground ml-2">{citation.source}</span>
                        </div>
                      )}
                    </div>
                    {citation.url && (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent hover:underline mt-2 inline-block"
                      >
                        View Source →
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bibliography Section */}
      {citations.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground">Bibliography Generator</h3>
            <div className="flex items-center gap-2">
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apa">APA</SelectItem>
                  <SelectItem value="mla">MLA</SelectItem>
                  <SelectItem value="chicago">Chicago</SelectItem>
                  <SelectItem value="harvard">Harvard</SelectItem>
                  <SelectItem value="ieee">IEEE</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="hero"
                onClick={generateBibliography}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Generate
              </Button>
            </div>
          </div>

          {bibliography?.generated_text && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {bibliography.format.toUpperCase()} Format
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={copyBibliography}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={downloadBibliography}>
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {bibliography.generated_text}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CitationDetector;