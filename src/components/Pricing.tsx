import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Perfect for individual researchers and students",
    features: [
      "5 documents per month",
      "Basic plagiarism detection",
      "AI content detection",
      "PDF export",
      "Email support"
    ],
    cta: "Get Started",
    variant: "secondary" as const,
    popular: false
  },
  {
    name: "Professional",
    price: "$29",
    period: "/month",
    description: "For educators and academic professionals",
    features: [
      "Unlimited documents",
      "Advanced plagiarism detection",
      "Deep paraphrase analysis",
      "100+ language support",
      "Detailed similarity reports",
      "Citation assistant",
      "Priority support"
    ],
    cta: "Start Free Trial",
    variant: "hero" as const,
    popular: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For universities and large organizations",
    features: [
      "Everything in Professional",
      "LMS integration (Canvas, Blackboard, etc.)",
      "Custom database inclusion",
      "API access",
      "Dedicated account manager",
      "SLA guarantee",
      "On-premise deployment option"
    ],
    cta: "Contact Sales",
    variant: "glass" as const,
    popular: false
  }
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Pricing
          </span>
          <h2 className="font-serif text-4xl md:text-5xl text-foreground mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose the plan that fits your needs. All plans include our core plagiarism detection technology.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 transition-all duration-300 animate-fade-in ${
                plan.popular
                  ? "bg-primary text-primary-foreground border-primary shadow-xl scale-105"
                  : "bg-card text-card-foreground border-border hover:border-accent/30 hover:shadow-lg"
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent text-accent-foreground text-sm font-medium">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="font-serif text-2xl mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className={plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className={`text-sm ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 shrink-0 mt-0.5 ${plan.popular ? "text-accent" : "text-accent"}`} />
                    <span className={`text-sm ${plan.popular ? "text-primary-foreground/90" : "text-foreground"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? "accent" : plan.variant}
                size="lg"
                className="w-full"
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
