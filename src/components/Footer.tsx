import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import ReferButton from "@/components/ReferButton";
import { Instagram, Facebook, Twitter, Youtube, MessageCircle, Gavel, ChevronRight } from "lucide-react";

const Footer = () => {
  const { getSetting } = useSiteSettings();
  const siteName = getSetting("site_name", "SUBASTANDOLO");
  const siteLogo = getSetting("site_logo", "/logo_letras.svg");
  const siteDescription = getSetting("site_description", "La plataforma #1 de subastas en línea");
  const footerText = getSetting("footer_text", `© ${new Date().getFullYear()} Subastandolo. Todos los derechos reservados.`);

  const year = new Date().getFullYear();

  return (
    <footer className="bg-primary text-white">
      {/* Main Footer Grid */}
      <div className="container mx-auto px-4 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Gavel className="h-5 w-5 text-accent-foreground" />
              </div>
              <Link to="/">
                <img src={siteLogo} alt={siteName} className="h-8 max-w-[200px] object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
              </Link>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-6">{siteDescription}</p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {[
                { Icon: Instagram, href: "#", label: "Instagram" },
                { Icon: Facebook, href: "#", label: "Facebook" },
                { Icon: Twitter, href: "#", label: "Twitter/X" },
                { Icon: Youtube, href: "#", label: "YouTube" },
                { Icon: MessageCircle, href: "#", label: "WhatsApp" },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 rounded-full bg-white/8 hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-all duration-200 hover:scale-110 text-white/60"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Subastas Column */}
          <div>
            <h4 className="font-heading font-bold text-white text-sm uppercase tracking-wider mb-5">Subastas</h4>
            <ul className="space-y-3">
              {[
                { label: "Todas las subastas", to: "/" },
                { label: "En Vivo ahora", to: "/#subastas" },
                { label: "Próximas subastas", to: "/" },
                { label: "Subastas ganadas", to: "/mi-panel" },
                { label: "Quiero Vender", to: "/quiero-vender" },
              ].map(({ label, to }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-white/50 hover:text-accent text-sm transition-colors flex items-center gap-1.5 group"
                  >
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1.5" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ayuda Column */}
          <div>
            <h4 className="font-heading font-bold text-white text-sm uppercase tracking-wider mb-5">Ayuda</h4>
            <ul className="space-y-3">
              {[
                { label: "Contacto", to: "/contacto" },
                { label: "Centro de ayuda", to: "/ayuda" },
                { label: "Reportar problema", to: "/contacto" },
              ].map(({ label, to }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-white/50 hover:text-accent text-sm transition-colors flex items-center gap-1.5 group"
                  >
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1.5" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="font-heading font-bold text-white text-sm uppercase tracking-wider mb-5">Legal</h4>
            <ul className="space-y-3">
              {[
                { label: "Términos y condiciones", to: "/terminos" },
                { label: "Política de privacidad", to: "/privacidad" },
                { label: "Política de cookies", to: "/privacidad" },
                { label: "Acuerdo de usuario", to: "/terminos" },
              ].map(({ label, to }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-white/50 hover:text-accent text-sm transition-colors flex items-center gap-1.5 group"
                  >
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1.5" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Trust badges */}
            <div className="mt-8 space-y-2">
              <div className="flex items-center gap-2 text-xs text-white/30">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                Plataforma Segura SSL
              </div>
              <div className="flex items-center gap-2 text-xs text-white/30">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                Venezuela 🇻🇪
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-white/30">{footerText || `© ${year} ${siteName}. Todos los derechos reservados.`}</span>
          <div className="flex items-center gap-4">
            <ReferButton variant="compact" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
