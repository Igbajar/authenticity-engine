import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "OriginalityAI has transformed how we handle academic integrity. The AI detection is unmatched, and our professors save hours every week.",
    author: "Dr. Sarah Chen",
    role: "Dean of Academic Affairs",
    institution: "Stanford University",
    avatar: "SC"
  },
  {
    quote: "We evaluated every major plagiarism checker on the market. OriginalityAI caught paraphrased content that others completely missed.",
    author: "Prof. Michael Torres",
    role: "Department Head, Computer Science",
    institution: "MIT",
    avatar: "MT"
  },
  {
    quote: "The integration with our LMS was seamless. Our instructors adopted it within days, not months. Game-changer for online education.",
    author: "Dr. Emma Williams",
    role: "Director of E-Learning",
    institution: "University of Oxford",
    avatar: "EW"
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            Testimonials
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-foreground">
            Trusted by Leading Institutions
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl border border-border p-8 shadow-sm hover:shadow-md transition-shadow animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Quote className="w-10 h-10 text-accent/30 mb-6" />
              <p className="text-foreground leading-relaxed mb-8">
                "{testimonial.quote}"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-medium text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  <p className="text-sm text-accent">{testimonial.institution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
