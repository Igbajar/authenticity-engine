import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);

    // Enforce size limit for PDF files to avoid memory issues
    const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const isPdf = fileType === 'application/pdf' || fileName.endsWith('.pdf');

    if (isPdf && file.size > MAX_PDF_SIZE) {
      return new Response(
        JSON.stringify({ error: `PDF file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB. Please compress or split the PDF.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedText = '';

    // Handle different file types
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      // Plain text files
      extractedText = await file.text();
      console.log('Extracted plain text directly');
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      // DOCX files are ZIP archives containing XML - parse them directly
      console.log('Parsing DOCX file...');
      const arrayBuffer = await file.arrayBuffer();
      
      try {
        // Use fflate for decompression (lightweight, works in Deno)
        const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
        const uint8Array = new Uint8Array(arrayBuffer);
        const unzipped = unzipSync(uint8Array);
        
        // Find and parse document.xml (main content)
        const documentXml = unzipped['word/document.xml'];
        if (!documentXml) {
          throw new Error('Invalid DOCX: missing document.xml');
        }
        
        // Decode XML content
        const decoder = new TextDecoder();
        const xmlContent = decoder.decode(documentXml);
        
        // Extract text from XML (simple regex approach for w:t elements)
        const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        const paragraphs: string[] = [];
        let currentParagraph = '';
        
        // Split by paragraph markers
        const parts = xmlContent.split(/<w:p[^>]*>/);
        for (const part of parts) {
          const texts = part.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
          if (texts.length > 0) {
            const paragraphText = texts
              .map(t => t.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
              .join('');
            if (paragraphText.trim()) {
              paragraphs.push(paragraphText);
            }
          }
        }
        
        extractedText = paragraphs.join('\n\n');
        console.log(`Extracted ${extractedText.length} characters from DOCX`);
      } catch (e) {
        console.error('DOCX parsing error:', e);
        throw new Error('Failed to parse DOCX file');
      }
    } else if (
      fileType === 'application/pdf' || 
      fileName.endsWith('.pdf')
    ) {
      // For PDF files, use AI to extract text (handles OCR for scanned docs)
      const arrayBuffer = await file.arrayBuffer();

      // Convert to base64 safely (avoid spreading/apply which can overflow the stack)
      const base64 = base64Encode(arrayBuffer);
      
      console.log('Using AI for PDF extraction with OCR support...');
      
      // Use a vision-capable model to extract text from PDFs (including scanned/image-based)
      const extractionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are a document text extraction system. Extract ALL text content from the provided PDF document.
              
For scanned or image-based documents, perform OCR to extract the text.
For text-based documents, extract the text content preserving paragraphs and structure.

Return ONLY the extracted text, nothing else. No explanations, no formatting markers.
If you cannot extract any text, return "ERROR: Could not extract text from document".`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract all text from this PDF document named "${file.name}". Return only the raw text content.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${base64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 16000,
        }),
      });

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text();
        console.error('AI extraction error:', extractionResponse.status, errorText);
        throw new Error('Failed to extract text from PDF');
      }

      const extractionData = await extractionResponse.json();
      extractedText = extractionData.choices?.[0]?.message?.content || '';
      
      if (extractedText.startsWith('ERROR:')) {
        throw new Error(extractedText);
      }
      
      console.log(`Extracted ${extractedText.length} characters using AI OCR`);
    } else if (
      fileType === 'application/msword' ||
      fileName.endsWith('.doc')
    ) {
      // Old .doc format is not easily parseable - inform user
      return new Response(
        JSON.stringify({ 
          error: 'Old .doc format is not supported. Please convert to .docx or PDF.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Try to read as text for unknown types
      try {
        extractedText = await file.text();
        
        // Check if it looks like binary data
        const binaryPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
        if (binaryPattern.test(extractedText.substring(0, 1000))) {
          throw new Error('Binary file detected');
        }
      } catch {
        return new Response(
          JSON.stringify({ 
            error: 'Unsupported file format. Please use TXT, PDF, DOC, or DOCX files.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Clean the extracted text
    extractedText = extractedText
      .replace(/\u0000/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    console.log(`Final extraction: ${wordCount} words, ${extractedText.length} characters`);

    return new Response(
      JSON.stringify({
        success: true,
        text: extractedText,
        wordCount,
        fileName: file.name,
        fileType: file.type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Document parsing error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to parse document' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
