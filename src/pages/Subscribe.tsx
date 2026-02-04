import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppSettings } from "@/hooks/useAppSettings";

const Subscribe = () => {
  const { settings } = useAppSettings();

  const plans = [
    {
      name: "Pro",
      price: "$19",
      period: "/month",
      description: "For individual researchers and students",
      features: [
        "100 scans per month",
        "Up to 25,000 words per scan",
        "AI detection",
        "Citation checker",
        "PDF reports",
        "Email support",
      ],
      popular: false,
    },
    {
      name: "Premium",
      price: "$49",
      period: "/month",
      description: "For professionals and educators",
      features: [
        "Unlimited scans",
        "Up to 100,000 words per scan",
        "Advanced AI detection",
        "Citation & bibliography tools",
        "Batch scanning",
        "API access",
        "Priority support",
      ],
      popular: true,
    },
    {
      name: "University",
      price: "Custom",
      period: "",
      description: "For institutions and teams",
      features: [
        "Everything in Premium",
        "Unlimited users",
        "Admin dashboard",
        "SSO integration",
        "Custom integrations",
        "Dedicated support",
        "SLA guarantee",
      ],
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-full mb-6">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-medium">Subscription Required</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Subscribe to {settings.app_name}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose a plan to unlock full access to plagiarism detection, AI analysis, and citation tools.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${
                plan.popular
                  ? "border-primary shadow-lg scale-105"
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-serif">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription className="mt-2">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.name === "University" ? "Contact Sales" : "Subscribe Now"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-8 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm">Secure payments</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-sm">Instant access</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-primary" />
            <span className="text-sm">Cancel anytime</span>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;
