import Header from "@/components/Header";
import Hero from "@/components/Hero";
import UploadSection from "@/components/UploadSection";
import Features from "@/components/Features";
import SimilarityDemo from "@/components/SimilarityDemo";
import Stats from "@/components/Stats";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <UploadSection />
      <Stats />
      <Features />
      <SimilarityDemo />
      <Testimonials />
      <Pricing />
      <Footer />
    </div>
  );
};

export default Index;
