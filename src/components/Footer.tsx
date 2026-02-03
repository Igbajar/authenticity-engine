import { FileSearch } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";

const Footer = () => {
  const { settings } = useAppSettings();
  
  const links = {
    Product: ["Features", "Pricing", "API", "Integrations", "Changelog"],
    Solutions: ["Universities", "Publishers", "Enterprises", "Researchers", "Students"],
    Resources: ["Documentation", "Help Center", "Blog", "Case Studies", "Webinars"],
    Company: ["About", "Careers", "Press", "Contact", "Partners"],
    Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"],
  };

  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Logo Column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <FileSearch className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="font-serif text-lg">
                {settings.app_name}
              </span>
            </div>
            <p className="text-sm text-background/60">
              The most advanced plagiarism and AI detection platform for academic integrity.
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="font-medium mb-4 text-sm">{category}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm text-background/60 hover:text-accent transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-background/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-background/60">
            © {new Date().getFullYear()} {settings.app_name}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-background/60 hover:text-accent transition-colors">
              Twitter
            </a>
            <a href="#" className="text-sm text-background/60 hover:text-accent transition-colors">
              LinkedIn
            </a>
            <a href="#" className="text-sm text-background/60 hover:text-accent transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
