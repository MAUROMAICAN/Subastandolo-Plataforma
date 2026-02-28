import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import ReferButton from "@/components/ReferButton";

const Footer = () => {
  const { getSetting } = useSiteSettings();
  const siteName = getSetting("site_name", "SUBASTANDOLO");
  const siteDescription = getSetting("site_description", "La plataforma #1 de subastas en línea");
  const footerText = getSetting("footer_text", `© ${new Date().getFullYear()} SUBASTANDOLO. Todos los derechos reservados.`);

  return (
    <footer className="bg-nav-solid text-white/70">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h4 className="font-heading font-bold text-white text-base mb-4">{siteName}</h4>
            <p className="leading-relaxed text-white/50 text-xs">{siteDescription}</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Subastas</h4>
            <ul className="space-y-2.5">
              <li><Link to="/" className="text-white/50 hover:text-white transition-colors text-xs">Todas</Link></li>
              <li><Link to="/" className="text-white/50 hover:text-white transition-colors text-xs">Activas</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Ayuda</h4>
            <ul className="space-y-2.5">
              <li><Link to="/como-funciona" className="text-white/50 hover:text-white transition-colors text-xs">Cómo funciona</Link></li>
              <li><Link to="/contacto" className="text-white/50 hover:text-white transition-colors text-xs">Contacto</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Legal</h4>
            <ul className="space-y-2.5">
              <li><Link to="/terminos" className="text-white/50 hover:text-white transition-colors text-xs">Términos</Link></li>
              <li><Link to="/privacidad" className="text-white/50 hover:text-white transition-colors text-xs">Privacidad</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <span>{footerText}</span>
          <ReferButton variant="compact" />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
