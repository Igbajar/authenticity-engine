import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Citation {
  id: string;
  citation_text: string;
  citation_type: string;
  author: string | null;
  title: string | null;
  year: string | null;
  source: string | null;
  url: string | null;
}

interface BibliographyEntry {
  id: string;
  formatted: string;
  author?: string;
  title?: string;
  year?: string;
  source?: string;
}

// Format citation based on style
function formatCitation(citation: Citation, format: string): string {
  const author = citation.author || "Unknown Author";
  const title = citation.title || "Untitled";
  const year = citation.year || "n.d.";
  const source = citation.source || "";
  const url = citation.url || "";

  switch (format) {
    case "apa":
      // APA 7th: Author, A. A. (Year). Title of work. Source. URL
      return `${author}. (${year}). ${title}${source ? `. ${source}` : ""}${url ? `. ${url}` : ""}`;

    case "mla":
      // MLA 9th: Author. "Title." Source, Year.
      return `${author}. "${title}."${source ? ` ${source},` : ""} ${year}${url ? `. ${url}` : ""}.`;

    case "chicago":
      // Chicago: Author. Title. Source, Year. URL.
      return `${author}. ${title}${source ? `. ${source}` : ""}, ${year}${url ? `. ${url}` : ""}.`;

    case "harvard":
      // Harvard: Author (Year) Title. Source. URL
      return `${author} (${year}) ${title}${source ? `. ${source}` : ""}${url ? `. Available at: ${url}` : ""}.`;

    case "ieee":
      // IEEE: [#] Author, "Title," Source, Year. URL
      return `${author}, "${title},"${source ? ` ${source},` : ""} ${year}${url ? `. [Online]. Available: ${url}` : ""}.`;

    default:
      return `${author}. ${title}. ${year}.`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scanId, format, citations } = await req.json();

    console.log("Generating bibliography for scan:", scanId, "format:", format);

    if (!scanId || !format) {
      throw new Error("Missing required fields: scanId, format");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get citations if not provided
    let citationsToFormat = citations;
    if (!citationsToFormat || citationsToFormat.length === 0) {
      const { data: fetchedCitations } = await supabase
        .from("citations")
        .select("*")
        .eq("scan_id", scanId);

      citationsToFormat = fetchedCitations || [];
    }

    console.log("Citations to format:", citationsToFormat.length);

    // Generate bibliography entries
    const entries: BibliographyEntry[] = citationsToFormat.map((citation: Citation, index: number) => ({
      id: citation.id || String(index + 1),
      formatted: formatCitation(citation, format),
      author: citation.author || undefined,
      title: citation.title || undefined,
      year: citation.year || undefined,
      source: citation.source || undefined,
    }));

    // Sort alphabetically by author for most formats (IEEE uses numbers)
    if (format !== "ieee") {
      entries.sort((a, b) => (a.author || "").localeCompare(b.author || ""));
    }

    // Generate formatted bibliography text
    let generatedText = "";

    switch (format) {
      case "apa":
        generatedText = "References\n\n" + entries.map(e => e.formatted).join("\n\n");
        break;
      case "mla":
        generatedText = "Works Cited\n\n" + entries.map(e => e.formatted).join("\n\n");
        break;
      case "chicago":
        generatedText = "Bibliography\n\n" + entries.map(e => e.formatted).join("\n\n");
        break;
      case "harvard":
        generatedText = "Reference List\n\n" + entries.map(e => e.formatted).join("\n\n");
        break;
      case "ieee":
        generatedText = "References\n\n" + entries.map((e, i) => `[${i + 1}] ${e.formatted}`).join("\n\n");
        break;
      default:
        generatedText = entries.map(e => e.formatted).join("\n\n");
    }

    // Upsert bibliography
    const { error: upsertError } = await supabase
      .from("bibliographies")
      .upsert({
        scan_id: scanId,
        format,
        entries,
        generated_text: generatedText,
        updated_at: new Date().toISOString(),
      }, { onConflict: "scan_id" });

    if (upsertError) {
      console.error("Failed to save bibliography:", upsertError);
      throw upsertError;
    }

    console.log("Bibliography generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        format,
        entriesCount: entries.length,
        generatedText,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Bibliography generation error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Generation failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});