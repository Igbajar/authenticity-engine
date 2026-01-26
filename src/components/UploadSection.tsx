import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Link, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const UploadSection = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "paste" | "url">("upload");

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleScan = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to scan documents",
      });
      navigate("/auth");
      return;
    }
    // Navigate to the scan page which has the actual scanning functionality
    navigate("/scan");
  };

  const tabs = [
    { id: "upload", label: "Upload File", icon: Upload },
    { id: "paste", label: "Paste Text", icon: FileText },
    { id: "url", label: "From URL", icon: Link },
  ] as const;

  return (
    <section id="upload" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl md:text-5xl text-foreground mb-4">
              Check Your Document
            </h2>
            <p className="text-muted-foreground text-lg">
              Upload a document, paste text, or provide a URL to start the analysis
            </p>
          </div>

          {/* Upload Card */}
          <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-accent/10 text-accent border-b-2 border-accent -mb-[1px]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-8">
              {activeTab === "upload" && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                    isDragging
                      ? "border-accent bg-accent/5"
                      : file
                      ? "border-success bg-success/5"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-success" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => setFile(null)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-foreground font-medium mb-2">
                        Drop your document here
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Supports PDF, DOCX, TXT, RTF up to 50MB
                      </p>
                      <label>
                        <Button variant="secondary" size="sm" asChild>
                          <span>Browse Files</span>
                        </Button>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.docx,.doc,.txt,.rtf"
                          onChange={handleFileSelect}
                        />
                      </label>
                    </>
                  )}
                </div>
              )}

              {activeTab === "paste" && (
                <div>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste your text here to check for plagiarism..."
                    className="w-full h-64 p-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  />
                  <div className="flex justify-between items-center mt-3">
                    <p className="text-sm text-muted-foreground">
                      {textInput.split(/\s+/).filter(Boolean).length} words
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Minimum 50 words required
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "url" && (
                <div>
                  <div className="flex gap-3">
                    <input
                      type="url"
                      placeholder="https://example.com/document.pdf"
                      className="flex-1 h-12 px-4 rounded-xl bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <Button variant="secondary">
                      Fetch
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Enter a direct link to a PDF or web page to analyze
                  </p>
                </div>
              )}

              {/* Scan Button */}
              <div className="mt-8 flex justify-center">
                <Button
                  variant="hero"
                  size="xl"
                  onClick={handleScan}
                  disabled={!file && !textInput.trim()}
                  className="min-w-[200px]"
                >
                  Start Analysis
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UploadSection;
