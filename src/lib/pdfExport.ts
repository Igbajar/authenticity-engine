import jsPDF from "jspdf";

interface ScanData {
  documentName: string;
  scanDate: string;
  wordCount: number;
  similarityScore: number;
  aiScore: number;
  processingTime: number;
}

interface MatchData {
  sourceTitle: string;
  sourceUrl: string;
  similarityPercentage: number;
  matchedText: string;
}

interface ReportData {
  overallAssessment?: string;
  writingStyle?: string;
  aiIndicators?: string[];
  originalityIndicators?: string[];
  suggestions?: string[];
}

export const generatePDFReport = (
  scan: ScanData,
  matches: MatchData[],
  report: ReportData | null
): void => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  const addPage = () => {
    pdf.addPage();
    yPos = 20;
  };

  const checkNewPage = (height: number) => {
    if (yPos + height > 280) {
      addPage();
    }
  };

  const addText = (text: string, x: number, y: number, options?: { maxWidth?: number; fontSize?: number; fontStyle?: "normal" | "bold" | "italic" }) => {
    const fontSize = options?.fontSize || 10;
    const fontStyle = options?.fontStyle || "normal";
    pdf.setFontSize(fontSize);
    pdf.setFont("helvetica", fontStyle);
    
    if (options?.maxWidth) {
      const lines = pdf.splitTextToSize(text, options.maxWidth);
      pdf.text(lines, x, y);
      return lines.length * (fontSize * 0.4);
    } else {
      pdf.text(text, x, y);
      return fontSize * 0.4;
    }
  };

  // Header
  pdf.setFillColor(36, 94, 79); // Accent color
  pdf.rect(0, 0, pageWidth, 40, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text("OriginalityAI", margin, 25);
  
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text("Plagiarism & AI Detection Report", margin, 33);
  
  yPos = 55;
  pdf.setTextColor(0, 0, 0);

  // Document Info
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Document Information", margin, yPos);
  yPos += 10;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Document: ${scan.documentName}`, margin, yPos);
  yPos += 6;
  pdf.text(`Scan Date: ${scan.scanDate}`, margin, yPos);
  yPos += 6;
  pdf.text(`Word Count: ${scan.wordCount.toLocaleString()}`, margin, yPos);
  yPos += 6;
  pdf.text(`Processing Time: ${scan.processingTime}ms`, margin, yPos);
  yPos += 15;

  // Scores Section
  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(margin, yPos, contentWidth, 35, 3, 3, "F");
  yPos += 10;

  // Similarity Score
  const scoreColor = (score: number): [number, number, number] => {
    if (score <= 15) return [34, 197, 94]; // Green
    if (score <= 40) return [234, 179, 8]; // Yellow
    return [239, 68, 68]; // Red
  };

  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Similarity Score", margin + 10, yPos);
  
  const simColor = scoreColor(scan.similarityScore);
  pdf.setTextColor(simColor[0], simColor[1], simColor[2]);
  pdf.setFontSize(20);
  pdf.text(`${scan.similarityScore}%`, margin + 10, yPos + 12);
  
  // AI Score
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("AI Detection Score", margin + 80, yPos);
  
  const aiColor = scoreColor(scan.aiScore);
  pdf.setTextColor(aiColor[0], aiColor[1], aiColor[2]);
  pdf.setFontSize(20);
  pdf.text(`${scan.aiScore}%`, margin + 80, yPos + 12);

  pdf.setTextColor(0, 0, 0);
  yPos += 35;

  // Analysis Section
  if (report?.overallAssessment) {
    checkNewPage(40);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Analysis Summary", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const assessmentHeight = addText(report.overallAssessment, margin, yPos, { maxWidth: contentWidth });
    yPos += assessmentHeight + 10;
  }

  // AI Indicators
  if (report?.aiIndicators && report.aiIndicators.length > 0) {
    checkNewPage(30);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("AI Indicators", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    report.aiIndicators.forEach((indicator) => {
      checkNewPage(10);
      const indicatorHeight = addText(`• ${indicator}`, margin + 5, yPos, { maxWidth: contentWidth - 10 });
      yPos += indicatorHeight + 3;
    });
    yPos += 5;
  }

  // Originality Indicators
  if (report?.originalityIndicators && report.originalityIndicators.length > 0) {
    checkNewPage(30);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Originality Indicators", margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    report.originalityIndicators.forEach((indicator) => {
      checkNewPage(10);
      const indicatorHeight = addText(`• ${indicator}`, margin + 5, yPos, { maxWidth: contentWidth - 10 });
      yPos += indicatorHeight + 3;
    });
    yPos += 5;
  }

  // Source Matches
  if (matches.length > 0) {
    checkNewPage(30);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Source Matches (${matches.length})`, margin, yPos);
    yPos += 10;

    matches.forEach((match, index) => {
      checkNewPage(35);
      
      // Match header
      pdf.setFillColor(250, 250, 250);
      pdf.roundedRect(margin, yPos - 3, contentWidth, 30, 2, 2, "F");
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      const matchColor = scoreColor(match.similarityPercentage);
      pdf.setTextColor(matchColor[0], matchColor[1], matchColor[2]);
      pdf.text(`${match.similarityPercentage}% match`, margin + 5, yPos + 3);
      
      pdf.setTextColor(100, 100, 100);
      pdf.setFont("helvetica", "normal");
      pdf.text(match.sourceTitle || "Unknown Source", margin + 40, yPos + 3);
      
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(match.sourceUrl.substring(0, 60) + (match.sourceUrl.length > 60 ? "..." : ""), margin + 5, yPos + 10);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      const matchedTextTruncated = match.matchedText.substring(0, 150) + (match.matchedText.length > 150 ? "..." : "");
      addText(`"${matchedTextTruncated}"`, margin + 5, yPos + 18, { maxWidth: contentWidth - 10 });
      
      yPos += 35;
    });
  } else {
    checkNewPage(20);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Source Matches", margin, yPos);
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(34, 197, 94);
    pdf.text("No significant matches found - document appears original!", margin, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 15;
  }

  // Suggestions
  if (report?.suggestions && report.suggestions.length > 0) {
    checkNewPage(30);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Recommendations", margin, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    report.suggestions.forEach((suggestion, index) => {
      checkNewPage(15);
      const sugHeight = addText(`${index + 1}. ${suggestion}`, margin + 5, yPos, { maxWidth: contentWidth - 10 });
      yPos += sugHeight + 5;
    });
  }

  // Footer
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Generated by OriginalityAI • Page ${i} of ${pageCount}`,
      pageWidth / 2,
      290,
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `plagiarism-report-${scan.documentName.replace(/[^a-z0-9]/gi, "-")}.pdf`;
  pdf.save(fileName);
};
