import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MatchingSection {
  textA: string;
  textB: string;
  startA: number;
  endA: number;
  startB: number;
  endB: number;
  similarity: number;
}

// Simple text similarity using Jaccard index
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(Boolean));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(Boolean));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? (intersection.size / union.size) * 100 : 0;
}

// Find matching sections between two documents
function findMatchingSections(contentA: string, contentB: string): MatchingSection[] {
  const matches: MatchingSection[] = [];
  const minSectionLength = 20; // Minimum words to consider a match
  const similarityThreshold = 60; // Minimum similarity percentage

  // Split into sentences for comparison
  const sentencesA = contentA.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);
  const sentencesB = contentB.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);

  let posA = 0;
  for (const sentenceA of sentencesA) {
    const startA = contentA.indexOf(sentenceA, posA);
    if (startA === -1) continue;
    posA = startA + sentenceA.length;

    let posB = 0;
    for (const sentenceB of sentencesB) {
      const similarity = calculateSimilarity(sentenceA, sentenceB);
      
      if (similarity >= similarityThreshold) {
        const startB = contentB.indexOf(sentenceB, posB);
        if (startB === -1) continue;
        posB = startB + sentenceB.length;

        matches.push({
          textA: sentenceA,
          textB: sentenceB,
          startA,
          endA: startA + sentenceA.length,
          startB,
          endB: startB + sentenceB.length,
          similarity: Math.round(similarity),
        });
      }
    }
  }

  // Sort by similarity and take top matches to avoid too many overlapping results
  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { comparisonId, contentA, contentB } = await req.json();

    console.log("Starting document comparison:", comparisonId);

    if (!comparisonId || !contentA || !contentB) {
      throw new Error("Missing required fields: comparisonId, contentA, contentB");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate overall similarity
    const overallSimilarity = calculateSimilarity(contentA, contentB);
    console.log("Overall similarity:", overallSimilarity);

    // Find matching sections
    const matchingSections = findMatchingSections(contentA, contentB);
    console.log("Found matching sections:", matchingSections.length);

    // Update comparison record
    const { error: updateError } = await supabase
      .from("document_comparisons")
      .update({
        similarity_score: Math.round(overallSimilarity * 10) / 10,
        matching_sections: matchingSections,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", comparisonId);

    if (updateError) {
      console.error("Failed to update comparison:", updateError);
      throw updateError;
    }

    console.log("Document comparison completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        similarity_score: overallSimilarity,
        matching_sections_count: matchingSections.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Comparison error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Comparison failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});