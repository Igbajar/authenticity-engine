import { 
  Brain, 
  Globe, 
  FileSearch, 
  Layers, 
  Shield, 
  Zap,
  BarChart3,
  Languages,
  BookOpen,
  Lock
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Content Detection",
    description: "Identify AI-generated text from ChatGPT, Claude, Gemini, and other LLMs with industry-leading accuracy."
  },
  {
    icon: Globe,
    title: "100B+ Source Database",
    description: "Compare against the world's largest database of academic papers, journals, books, and web content."
  },
  {
    icon: FileSearch,
    title: "Deep Paraphrase Detection",
    description: "Advanced semantic analysis catches cleverly reworded and paraphrased content that other tools miss."
  },
  {
    icon: Layers,
    title: "Multi-Format Support",
    description: "Analyze PDFs, Word docs, Google Docs, code files, and 40+ other formats seamlessly."
  },
  {
    icon: BarChart3,
    title: "Detailed Reports",
    description: "Get comprehensive similarity reports with source highlighting, citation suggestions, and exportable PDFs."
  },
  {
    icon: Languages,
    title: "100+ Languages",
    description: "Full plagiarism detection across all major languages with native language processing."
  },
  {
    icon: BookOpen,
    title: "Citation Assistant",
    description: "Automatic citation generation in APA, MLA, Chicago, Harvard, and other formats."
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "SOC 2 Type II certified with end-to-end encryption. Documents are never stored or shared."
  },
  {
    icon: Zap,
    title: "Real-Time API",
    description: "Integrate plagiarism checking into your LMS, CMS, or application with our robust API."
  },
  {
    icon: Shield,
    title: "LMS Integration",
    description: "Native integration with Canvas, Blackboard, Moodle, Brightspace, and other learning platforms."
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-foreground mb-6">
            Everything You Need for
            <br />
            <span className="text-gradient-accent">Academic Integrity</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Built for universities, researchers, publishers, and anyone who values original work.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-accent/30 hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-serif text-xl text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
