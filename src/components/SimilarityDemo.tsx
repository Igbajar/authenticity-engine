import { useState, useEffect } from "react";

const SimilarityDemo = () => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const similarityScore = 23;
  const aiScore = 8;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    const element = document.getElementById("similarity-demo");
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        const interval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= similarityScore) {
              clearInterval(interval);
              return similarityScore;
            }
            return prev + 1;
          });
        }, 30);
        return () => clearInterval(interval);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const sources = [
    { name: "Wikipedia - Climate Change", match: 8, url: "#" },
    { name: "Nature Journal Vol. 582", match: 6, url: "#" },
    { name: "Stanford Research Paper 2023", match: 5, url: "#" },
    { name: "IPCC Report 2022", match: 4, url: "#" },
  ];

  return (
    <section id="similarity-demo" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Live Demo
            </span>
            <h2 className="font-serif text-4xl md:text-5xl text-foreground mb-4">
              See It In Action
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Interactive preview of our comprehensive analysis report
            </p>
          </div>

          {/* Demo Card */}
          <div className="bg-card rounded-3xl border border-border shadow-xl overflow-hidden">
            {/* Header Bar */}
            <div className="bg-muted/50 px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-danger/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <span className="text-sm text-muted-foreground">research_paper_final.pdf</span>
              </div>
              <span className="text-xs text-muted-foreground">Analyzed 2 seconds ago</span>
            </div>

            <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* Left Panel - Scores */}
              <div className="p-8 space-y-8">
                {/* Similarity Score */}
                <div className="text-center">
                  <div className="relative w-40 h-40 mx-auto mb-4">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="10"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="hsl(var(--warning))"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${progress * 3.14} 314`}
                        className="transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-foreground">{progress}%</span>
                      <span className="text-sm text-muted-foreground">Similarity</span>
                    </div>
                  </div>
                  <p className="text-sm text-warning font-medium">Moderate Similarity</p>
                </div>

                {/* AI Score */}
                <div className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">AI Content Detected</span>
                    <span className="text-sm font-bold text-success">{aiScore}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full transition-all duration-1000"
                      style={{ width: isVisible ? `${aiScore}%` : "0%" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Low AI probability</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">2,847</p>
                    <p className="text-xs text-muted-foreground">Words</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">12</p>
                    <p className="text-xs text-muted-foreground">Sources</p>
                  </div>
                </div>
              </div>

              {/* Middle Panel - Text Preview */}
              <div className="p-8">
                <h3 className="font-serif text-lg text-foreground mb-4">Document Preview</h3>
                <div className="prose prose-sm max-w-none space-y-4 text-sm text-foreground/80">
                  <p>
                    Climate change represents one of the most significant challenges facing 
                    <span className="bg-warning/20 text-warning-foreground px-1 rounded">
                      humanity in the 21st century
                    </span>. The scientific consensus is clear: human activities, 
                    particularly the burning of fossil fuels, are driving unprecedented 
                    changes in global climate patterns.
                  </p>
                  <p>
                    <span className="bg-warning/30 text-warning-foreground px-1 rounded">
                      According to the IPCC, global temperatures have risen approximately 
                      1.1°C above pre-industrial levels
                    </span>, with significant impacts already being 
                    observed across ecosystems worldwide.
                  </p>
                  <p>
                    The Paris Agreement established a framework for international cooperation, 
                    aiming to limit warming to 
                    <span className="bg-warning/20 text-warning-foreground px-1 rounded">
                      1.5°C above pre-industrial levels
                    </span>.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-warning/30" />
                    <span className="text-xs text-muted-foreground">Matched text</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-accent/30" />
                    <span className="text-xs text-muted-foreground">AI-generated</span>
                  </div>
                </div>
              </div>

              {/* Right Panel - Sources */}
              <div className="p-8">
                <h3 className="font-serif text-lg text-foreground mb-4">Matched Sources</h3>
                <div className="space-y-3">
                  {sources.map((source, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                          {source.name}
                        </span>
                        <span className="text-sm font-bold text-warning">{source.match}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-warning/60 rounded-full"
                          style={{ width: `${(source.match / similarityScore) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 py-3 text-sm text-accent hover:text-accent/80 font-medium transition-colors">
                  View all 12 sources →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SimilarityDemo;
