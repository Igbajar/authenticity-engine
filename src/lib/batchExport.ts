import jsPDF from "jspdf";

interface BatchFileResult {
  fileName: string;
  similarityScore: number;
  aiScore: number;
  status: "complete" | "error";
  error?: string;
}

interface InternalMatch {
  docAName: string;
  docBName: string;
  similarity: number;
}

export const exportBatchCSV = (
  results: BatchFileResult[],
  internalMatches: InternalMatch[]
): void => {
  const lines: string[] = [];

  // Header
  lines.push("Document Name,Status,Similarity Score (%),AI Detection Score (%)");

  results.forEach((r) => {
    const name = `"${r.fileName.replace(/"/g, '""')}"`;
    lines.push(
      `${name},${r.status},${r.status === "complete" ? r.similarityScore : "N/A"},${r.status === "complete" ? r.aiScore : "N/A"}`
    );
  });

  if (internalMatches.length > 0) {
    lines.push("");
    lines.push("Internal Comparison");
    lines.push("Document A,Document B,Similarity (%)");
    internalMatches.forEach((m) => {
      lines.push(
        `"${m.docAName.replace(/"/g, '""')}","${m.docBName.replace(/"/g, '""')}",${m.similarity}`
      );
    });
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `batch-scan-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportBatchPDF = (
  results: BatchFileResult[],
  internalMatches: InternalMatch[]
): void => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  const checkNewPage = (height: number) => {
    if (yPos + height > 275) {
      pdf.addPage();
      yPos = 20;
    }
  };

  const scoreColor = (score: number): [number, number, number] => {
    if (score <= 15) return [34, 197, 94];
    if (score <= 40) return [234, 179, 8];
    return [239, 68, 68];
  };

  // Header bar
  pdf.setFillColor(36, 94, 79);
  pdf.rect(0, 0, pageWidth, 40, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont("helvetica", "bold");
  pdf.text("OriginalityAI", margin, 25);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text("Batch Scan Report", margin, 33);

  yPos = 55;
  pdf.setTextColor(0, 0, 0);

  // Summary
  const completed = results.filter((r) => r.status === "complete");
  const failed = results.filter((r) => r.status === "error");
  const avgSim = completed.length
    ? Math.round(completed.reduce((s, r) => s + r.similarityScore, 0) / completed.length)
    : 0;
  const avgAi = completed.length
    ? Math.round(completed.reduce((s, r) => s + r.aiScore, 0) / completed.length)
    : 0;

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Summary", margin, yPos);
  yPos += 8;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
  yPos += 6;
  pdf.text(`Total Documents: ${results.length}  |  Completed: ${completed.length}  |  Failed: ${failed.length}`, margin, yPos);
  yPos += 6;
  pdf.text(`Average Similarity: ${avgSim}%  |  Average AI Score: ${avgAi}%`, margin, yPos);
  yPos += 15;

  // Results table
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Document Results", margin, yPos);
  yPos += 10;

  // Table header
  pdf.setFillColor(245, 245, 245);
  pdf.rect(margin, yPos - 4, contentWidth, 10, "F");
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(80, 80, 80);
  pdf.text("Document", margin + 3, yPos + 2);
  pdf.text("Similarity", margin + contentWidth - 55, yPos + 2);
  pdf.text("AI Score", margin + contentWidth - 22, yPos + 2);
  yPos += 12;

  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  results.forEach((r) => {
    checkNewPage(10);
    const truncName = r.fileName.length > 50 ? r.fileName.substring(0, 47) + "..." : r.fileName;
    pdf.text(truncName, margin + 3, yPos);

    if (r.status === "complete") {
      const simC = scoreColor(r.similarityScore);
      pdf.setTextColor(simC[0], simC[1], simC[2]);
      pdf.text(`${r.similarityScore}%`, margin + contentWidth - 55, yPos);

      const aiC = scoreColor(r.aiScore);
      pdf.setTextColor(aiC[0], aiC[1], aiC[2]);
      pdf.text(`${r.aiScore}%`, margin + contentWidth - 22, yPos);
      pdf.setTextColor(0, 0, 0);
    } else {
      pdf.setTextColor(239, 68, 68);
      pdf.text("Error", margin + contentWidth - 55, yPos);
      pdf.setTextColor(0, 0, 0);
    }
    yPos += 8;
  });

  // Internal matches
  if (internalMatches.length > 0) {
    yPos += 10;
    checkNewPage(30);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Internal Document Comparison", margin, yPos);
    yPos += 10;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    internalMatches.forEach((m) => {
      checkNewPage(10);
      const simC = scoreColor(m.similarity);
      pdf.setTextColor(simC[0], simC[1], simC[2]);
      pdf.text(`${m.similarity}%`, margin + 3, yPos);
      pdf.setTextColor(0, 0, 0);
      const pairText = `${m.docAName.substring(0, 30)} ↔ ${m.docBName.substring(0, 30)}`;
      pdf.text(pairText, margin + 20, yPos);
      yPos += 8;
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

  pdf.save(`batch-scan-report-${new Date().toISOString().slice(0, 10)}.pdf`);
};
