import { useMemo } from "react";

interface Match {
  matched_text: string;
  similarity_percentage: number;
}

interface HighlightedDocumentProps {
  content: string;
  matches: Match[];
}

const HighlightedDocument = ({ content, matches }: HighlightedDocumentProps) => {
  const highlightedContent = useMemo(() => {
    if (!matches.length) return content;

    // Create a map of text ranges to highlight
    const highlightRanges: { start: number; end: number; percentage: number }[] = [];

    matches.forEach((match) => {
      const matchText = match.matched_text.toLowerCase().trim();
      if (matchText.length < 10) return; // Skip very short matches
      
      const contentLower = content.toLowerCase();
      let startIndex = 0;
      
      // Find all occurrences of the matched text
      while (startIndex < content.length) {
        const index = contentLower.indexOf(matchText, startIndex);
        if (index === -1) break;
        
        highlightRanges.push({
          start: index,
          end: index + matchText.length,
          percentage: match.similarity_percentage,
        });
        
        startIndex = index + matchText.length;
      }
    });

    if (!highlightRanges.length) return content;

    // Sort ranges by start position
    highlightRanges.sort((a, b) => a.start - b.start);

    // Merge overlapping ranges
    const mergedRanges: typeof highlightRanges = [];
    highlightRanges.forEach((range) => {
      if (mergedRanges.length === 0) {
        mergedRanges.push(range);
        return;
      }
      
      const last = mergedRanges[mergedRanges.length - 1];
      if (range.start <= last.end) {
        last.end = Math.max(last.end, range.end);
        last.percentage = Math.max(last.percentage, range.percentage);
      } else {
        mergedRanges.push(range);
      }
    });

    // Build the highlighted content
    const parts: JSX.Element[] = [];
    let lastEnd = 0;

    mergedRanges.forEach((range, index) => {
      // Add text before the highlight
      if (range.start > lastEnd) {
        parts.push(
          <span key={`text-${index}`}>{content.slice(lastEnd, range.start)}</span>
        );
      }

      // Get color based on percentage
      const getHighlightColor = (percentage: number) => {
        if (percentage >= 80) return "bg-destructive/30 border-destructive/50";
        if (percentage >= 50) return "bg-warning/30 border-warning/50";
        return "bg-accent/20 border-accent/40";
      };

      // Add highlighted text
      parts.push(
        <mark
          key={`highlight-${index}`}
          className={`${getHighlightColor(range.percentage)} border-b-2 rounded-sm px-0.5 transition-colors hover:opacity-80`}
          title={`${Math.round(range.percentage)}% similarity`}
        >
          {content.slice(range.start, range.end)}
        </mark>
      );

      lastEnd = range.end;
    });

    // Add remaining text
    if (lastEnd < content.length) {
      parts.push(
        <span key="text-end">{content.slice(lastEnd)}</span>
      );
    }

    return parts;
  }, [content, matches]);

  return (
    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {highlightedContent}
    </div>
  );
};

export default HighlightedDocument;
