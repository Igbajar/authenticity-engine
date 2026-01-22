const stats = [
  { value: "500+", label: "Universities" },
  { value: "50M+", label: "Documents Scanned" },
  { value: "100B+", label: "Source Database" },
  { value: "99.9%", label: "Accuracy Rate" },
];

const Stats = () => {
  return (
    <section className="py-16 bg-primary">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-primary-foreground mb-2">
                {stat.value}
              </p>
              <p className="text-primary-foreground/70 text-sm md:text-base">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
