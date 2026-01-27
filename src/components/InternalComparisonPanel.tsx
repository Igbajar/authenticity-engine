import { useState } from "react";
import { GitCompare, FileText, ChevronDown, ChevronUp, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface InternalMatch {
  documentId: string;
  documentName: string;
  scanId: string;
  similarityScore: number;
  matchingPhrases: number;
}

interface InternalComparisonPanelProps {
  matches: InternalMatch[];
  currentDocumentName: string;
}

const InternalComparisonPanel = ({ matches, currentDocumentName }: InternalComparisonPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const getScoreColor = (score: number) => {
    if (score <= 20) return "text-success";
    if (score <= 50) return "text-warning";
    return "text-destructive";
  };

  const getScoreBg = (score: number) => {
    if (score <= 20) return "bg-success/10";
    if (score <= 50) return "bg-warning/10";
    return "bg-destructive/10";
  };

  const significantMatches = matches.filter(m => m.similarityScore >= 10);

  if (significantMatches.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitCompare className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">Internal Comparison</h3>
        </div>
        <div className="text-center py-6">
          <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No similar documents found in your library</p>
        </div>
      </div>
    );
  }

  const highestMatch = Math.max(...significantMatches.map(m => m.similarityScore));

  return (
    <div className="rounded-2xl border border-border bg-card">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-6 flex items-center justify-between text-left border-b border-border">
            <div className="flex items-center gap-3">
              <GitCompare className="w-5 h-5 text-accent" />
              <div>
                <h3 className="font-medium text-foreground">Internal Comparison</h3>
                <p className="text-sm text-muted-foreground">
                  {significantMatches.length} similar document{significantMatches.length !== 1 ? "s" : ""} found
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {highestMatch > 30 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {Math.round(highestMatch)}% max
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground px-2">
              Comparing "{currentDocumentName}" against other documents in your library
            </p>
            
            {significantMatches
              .sort((a, b) => b.similarityScore - a.similarityScore)
              .map((match) => (
                <div
                  key={match.documentId}
                  className={`p-4 rounded-xl border ${getScoreBg(match.similarityScore)} border-border/50`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {match.documentName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {match.matchingPhrases} matching phrase{match.matchingPhrases !== 1 ? "s" : ""}
                        </p>
                        <div className="mt-2">
                          <Progress value={match.similarityScore} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-2xl font-bold ${getScoreColor(match.similarityScore)}`}>
                        {Math.round(match.similarityScore)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/results/${match.scanId}`)}
                      >
                        View <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default InternalComparisonPanel;