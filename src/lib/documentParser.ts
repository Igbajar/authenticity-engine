import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Set up the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

/**
 * Extract text content from various document formats
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // Handle DOCX files
  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return extractTextFromDocx(file);
  }

  // Handle DOC files (older Word format)
  if (fileType === "application/msword" || fileName.endsWith(".doc")) {
    // DOC files are harder to parse - try as text fallback
    console.warn("DOC files are not fully supported, attempting text extraction");
    return extractAsPlainText(file);
  }

  // Handle PDF files
  if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
    return extractTextFromPdf(file);
  }

  // Handle plain text files
  if (
    fileType === "text/plain" ||
    fileName.endsWith(".txt") ||
    fileType === ""
  ) {
    return extractAsPlainText(file);
  }

  // Fallback: try to read as text
  return extractAsPlainText(file);
}

/**
 * Extract text from DOCX files using mammoth
 */
async function extractTextFromDocx(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        
        if (!result.value || result.value.trim().length === 0) {
          reject(new Error("Could not extract text from DOCX file. The document may be empty or corrupted."));
          return;
        }
        
        // Clean the text
        const cleanedText = cleanText(result.value);
        resolve(cleanedText);
      } catch (error) {
        console.error("Error extracting DOCX content:", error);
        reject(new Error("Failed to parse DOCX file. Please ensure the file is not corrupted."));
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read DOCX file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extract text from PDF files using pdf.js
 */
async function extractTextFromPdf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const typedArray = new Uint8Array(arrayBuffer);
        
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        const numPages = pdf.numPages;
        const textParts: string[] = [];
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          textParts.push(pageText);
        }
        
        const fullText = textParts.join("\n\n");
        
        if (!fullText || fullText.trim().length === 0) {
          reject(new Error("Could not extract text from PDF. The document may be scanned or image-based."));
          return;
        }
        
        // Clean the text
        const cleanedText = cleanText(fullText);
        resolve(cleanedText);
      } catch (error) {
        console.error("Error extracting PDF content:", error);
        reject(new Error("Failed to parse PDF file. Please ensure the file is not corrupted."));
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read PDF file"));
    reader.readAsArrayBuffer(file);
  });
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
