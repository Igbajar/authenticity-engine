import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DetectedCitation {
  text: string;
  type: string;
  author?: string;
  title?: string;
  year?: string;
  source?: string;
  url?: string;
  isValid: boolean;
  startPosition: number;
  endPosition: number;
}

// Citation patterns for different formats
const citationPatterns = {
  // APA: (Author, Year) or Author (Year)
  apa: /(?:\(([A-Z][a-zA-Z]+(?:\s+(?:&|and)\s+[A-Z][a-zA-Z]+)*),?\s*(\d{4})\))|(?:([A-Z][a-zA-Z]+(?:\s+(?:&|and)\s+[A-Z][a-zA-Z]+)*)\s*\((\d{4})\))/g,
  
  // MLA: (Author Page) or "Quote" (Author Page)
  mla: /\(([A-Z][a-zA-Z]+)\s+(\d+(?:-\d+)?)\)/g,
  
  // Chicago: Footnote style or (Author Year, Page)
  chicago: /\(([A-Z][a-zA-Z]+)\s+(\d{4}),?\s*(\d+(?:-\d+)?)\)/g,
  
  // Harvard: (Author Year) similar to APA
  harvard: /\(([A-Z][a-zA-Z]+(?:\s+(?:&|and)\s+[A-Z][a-zA-Z]+)*)\s+(\d{4})\)/g,
  
  // IEEE: [Number]
  ieee: /\[(\d+)\]/g,
  
  // URL citations
  url: /https?:\/\/[^\s<>"\)]+/g,
  
  // DOI
  doi: /(?:doi:|DOI:?\s*)?(10\.\d{4,}(?:\.\d+)*\/[^\s]+)/gi,
};

function detectCitations(content: string): DetectedCitation[] {
  const citations: DetectedCitation[] = [];
  const seen = new Set<string>();

  // Detect APA citations
  let match;
  while ((match = citationPatterns.apa.exec(content)) !== null) {
    const author = match[1] || match[3];
    const year = match[2] || match[4];
    const text = match[0];
    
    if (!seen.has(text)) {
      seen.add(text);
      citations.push({
        text,
        type: "apa",
        author,
        year,
        isValid: true,
        startPosition: match.index,
        endPosition: match.index + text.length,
      });
    }
  }

  // Detect MLA citations
  citationPatterns.mla.lastIndex = 0;
  while ((match = citationPatterns.mla.exec(content)) !== null) {
    const text = match[0];
    if (!seen.has(text)) {
      seen.add(text);
      citations.push({
        text,
        type: "mla",
        author: match[1],
        isValid: true,
        startPosition: match.index,
        endPosition: match.index + text.length,
      });
    }
  }

  // Detect Chicago citations
  citationPatterns.chicago.lastIndex = 0;
  while ((match = citationPatterns.chicago.exec(content)) !== null) {
    const text = match[0];
    if (!seen.has(text)) {
      seen.add(text);
      citations.push({
        text,
        type: "chicago",
        author: match[1],
        year: match[2],
        isValid: true,
        startPosition: match.index,
        endPosition: match.index + text.length,
      });
    }
  }

  // Detect IEEE citations
  citationPatterns.ieee.lastIndex = 0;
  while ((match = citationPatterns.ieee.exec(content)) !== null) {
    const text = match[0];
    if (!seen.has(text)) {
      seen.add(text);
      citations.push({
        text,
        type: "ieee",
        isValid: true,
        startPosition: match.index,
        endPosition: match.index + text.length,
      });
    }
  }

  // Detect URL citations
  citationPatterns.url.lastIndex = 0;
  while ((match = citationPatterns.url.exec(content)) !== null) {
    const text = match[0];
    if (!seen.has(text)) {
      seen.add(text);
      citations.push({
        text,
        type: "unknown",
        url: text,
        isValid: true,
        startPosition: match.index,
        endPosition: match.index + text.length,
      });
    }
  }

  // Detect DOI citations
  citationPatterns.doi.lastIndex = 0;
  while ((match = citationPatterns.doi.exec(content)) !== null) {
    const text = match[0];
    if (!seen.has(text)) {
      seen.add(text);
      citations.push({
        text,
        type: "unknown",
        url: `https://doi.org/${match[1]}`,
        isValid: true,
        startPosition: match.index,
        endPosition: match.index + text.length,
      });
    }
  }

  return citations.sort((a, b) => a.startPosition - b.startPosition);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scanId, content } = await req.json();

    console.log("Detecting citations for scan:", scanId);

    if (!scanId || !content) {
      throw new Error("Missing required fields: scanId, content");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Detect citations
    const detectedCitations = detectCitations(content);
    console.log("Detected citations:", detectedCitations.length);

    // Delete existing citations for this scan
    await supabase.from("citations").delete().eq("scan_id", scanId);

    // Insert new citations
    if (detectedCitations.length > 0) {
      const citationsToInsert = detectedCitations.map(c => ({
        scan_id: scanId,
        citation_text: c.text,
        citation_type: c.type,
        author: c.author || null,
        title: c.title || null,
        year: c.year || null,
        source: c.source || null,
        url: c.url || null,
        is_valid: c.isValid,
        position_start: c.startPosition,
        position_end: c.endPosition,
      }));

      const { error: insertError } = await supabase
        .from("citations")
        .insert(citationsToInsert);

      if (insertError) {
        console.error("Failed to insert citations:", insertError);
        throw insertError;
      }
    }

    console.log("Citation detection completed");

    return new Response(
      JSON.stringify({
        success: true,
        citationsCount: detectedCitations.length,
        citations: detectedCitations,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Citation detection error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Detection failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});