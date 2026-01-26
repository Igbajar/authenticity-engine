import { supabase } from "@/integrations/supabase/client";

/**
 * Extract text content from various document formats using backend OCR
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type;

  // For plain text files, read directly in browser
  if (
    fileType === "text/plain" ||
    fileName.endsWith(".txt") ||
    fileType === ""
  ) {
    return extractAsPlainText(file);
  }

  // For PDF, DOCX, DOC - use backend OCR-capable parsing
  if (
    fileType === "application/pdf" ||
    fileName.endsWith(".pdf") ||
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx") ||
    fileType === "application/msword" ||
    fileName.endsWith(".doc")
  ) {
    return extractViaBackend(file);
  }

  // Fallback: try plain text extraction
  return extractAsPlainText(file);
}

/**
 * Extract text using backend OCR service
 */
async function extractViaBackend(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const { data: session } = await supabase.auth.getSession();
  
  if (!session.session?.access_token) {
    throw new Error("Authentication required");
  }

  // Get the Supabase URL from the client
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/parse-document`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to parse document");
  }

  const result = await response.json();
  
  if (!result.success || !result.text) {
    throw new Error("Could not extract text from document");
  }

  return result.text;
}

/**
 * Extract content as plain text
 */
async function extractAsPlainText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      let content = e.target?.result as string;
      
      // Check if the content looks like binary data
      if (containsBinaryData(content)) {
        reject(new Error("This file appears to be binary and cannot be read as text. Please use a supported format (TXT, DOCX, PDF)."));
        return;
      }
      
      // Clean the text
      const cleanedText = cleanText(content);
      resolve(cleanedText);
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Clean extracted text by removing problematic characters
 */
function cleanText(text: string): string {
  return text
    // Remove null bytes and control characters
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    // Normalize whitespace
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove excessive newlines
    .replace(/\n{3,}/g, "\n\n")
    // Trim
    .trim();
}

/**
 * Check if content contains binary data indicators
 */
function containsBinaryData(content: string): boolean {
  // Check for common binary file signatures
  if (content.startsWith("PK")) {
    // ZIP-based format (DOCX, XLSX, etc.) read incorrectly as text
    return true;
  }
  
  if (content.startsWith("%PDF")) {
    // PDF read incorrectly as text
    return true;
  }
  
  // Check for high ratio of non-printable characters
  const nonPrintable = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g);
  if (nonPrintable && nonPrintable.length > content.length * 0.1) {
    return true;
  }
  
  return false;
}

/**
 * Get word count from text
 */
export function getWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
