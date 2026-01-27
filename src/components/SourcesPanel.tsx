import { useState } from "react";
import { ExternalLink, Globe, ChevronDown, ChevronUp, Copy, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Source {
  id: string;
  url: string;
  title: string | null;
  matchedText: string;
  similarity: number;
}

interface SourcesPanelProps {
  sources: Source[];
}

const SourcesPanel = ({ sources }: SourcesPanelProps) => {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleSource = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "URL copied",
      description: "Source URL has been copied to clipboard",
    });
  };

  const getScoreColor = (score: number) => {
    if (score <= 20) return "bg-muted text-muted-foreground";
    if (score <= 50) return "bg-warning/10 text-warning";
    return "bg-destructive/10 text-destructive";
  };

  const getDomain = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  // Group sources by domain
  const groupedSources = sources.reduce((acc, source) => {
    const domain = getDomain(source.url);
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(source);
    return acc;
  }, {} as Record<string, Source[]>);

  // Sort domains by total match percentage
  const sortedDomains = Object.entries(groupedSources).sort(([, a], [, b]) => {
    const totalA = a.reduce((sum, s) => sum + s.similarity, 0);
    const totalB = b.reduce((sum, s) => sum + s.similarity, 0);
    return totalB - totalA;
  });

  if (sources.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">Web Sources</h3>
        </div>
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
          <p className="text-muted-foreground">No web sources detected</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your document appears to be original
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-accent" />
            <div>
              <h3 className="font-medium text-foreground">Web Sources Found</h3>
              <p className="text-sm text-muted-foreground">
                {sources.length} source{sources.length !== 1 ? "s" : ""} from{" "}
                {Object.keys(groupedSources).length} website{Object.keys(groupedSources).length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-accent border-accent/30">
            {sources.length} matches
          </Badge>
        </div>
      </div>

      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {sortedDomains.map(([domain, domainSources]) => {
          const maxSimilarity = Math.max(...domainSources.map((s) => s.similarity));
          const isExpanded = domainSources.some((s) => expandedSources.has(s.id));

          return (
            <div key={domain} className="p-4">
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button
                    onClick={() => domainSources.forEach((s) => toggleSource(s.id))}
                    className="w-full flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {domain}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {domainSources.length} match{domainSources.length !== 1 ? "es" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <Badge className={getScoreColor(maxSimilarity)}>
                        {Math.round(maxSimilarity)}% max
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-4 space-y-3 pl-11">
                    {domainSources.map((source) => (
                      <div
                        key={source.id}
                        className="p-3 bg-muted/50 rounded-lg border border-border/50"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-accent hover:underline flex items-center gap-1"
                            >
                              {source.title || "View Source"}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {source.url}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="secondary"
                              className={getScoreColor(source.similarity)}
                            >
                              {Math.round(source.similarity)}%
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyUrl(source.url)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {source.matchedText && (
                          <p className="text-xs text-muted-foreground line-clamp-2 italic">
                            "{source.matchedText}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SourcesPanel;