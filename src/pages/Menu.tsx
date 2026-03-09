import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Home, Heart, HelpCircle,
  User, Store, FileText, Info, Mail, LogOut,
  Gavel, Scale, Settings, BookOpen, Shield,
} from "lucide-react";

interface MenuItem {
  label: string;
  icon: React.ElementType;
  to: string;
  badge?: number;
  external?: boolean;
}

const Menu = () => {
  const { user, profile, isAdmin, isDealer, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }

  const mainItems: MenuItem[] = [
    { label: "Inicio", icon: Home, to: "/" },
    { label: "Ayuda", icon: HelpCircle, to: "/ayuda" },
    { label: "Mi Panel", icon: User, to: "/mi-panel" },
  ];

  const shoppingItems: MenuItem[] = [
    { label: "Mis Disputas", icon: Scale, to: "/disputes" },
    { label: "Favoritos", icon: Heart, to: "/mi-panel" },
  ];

  const infoItems: MenuItem[] = [
    { label: "Cómo Funciona", icon: BookOpen, to: "/como-funciona" },
    { label: "Preguntas Frecuentes", icon: HelpCircle, to: "/compradores" },
    { label: "Nosotros", icon: Info, to: "/nosotros" },
    { label: "Contacto", icon: Mail, to: "/contacto" },
  ];

  const legalItems: MenuItem[] = [
    { label: "Términos y Condiciones", icon: FileText, to: "/terminos" },
    { label: "Política de Privacidad", icon: Shield, to: "/privacidad" },
    { label: "Políticas de Publicación", icon: FileText, to: "/politicas-publicacion" },
  ];

  const dealerItems: MenuItem[] = isDealer
    ? [
      { label: "Panel Dealer", icon: Store, to: "/dealer" },
      { label: "Solicitar ser Dealer", icon: Gavel, to: "/dealer/apply" },
    ]
    : [{ label: "Vender en Subastandolo", icon: Store, to: "/dealer/apply" }];

  const adminItems: MenuItem[] = isAdmin
    ? [{ label: "Panel Admin", icon: Settings, to: "/admin" }]
    : [];

  const renderSection = (title: string, items: MenuItem[]) => (
    <div className="mb-0">
      {title && (
        <p className="px-4 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <div className="bg-card">
        {items.map((item) => (
          <Link
            key={item.to + item.label}
            to={item.to}
            className="flex items-center gap-4 px-4 py-4 hover:bg-secondary/30 transition-colors border-b border-border/50 last:border-0"
          >
            <item.icon className="h-5 w-5 text-muted-foreground/80 shrink-0" strokeWidth={1.5} />
            <span className="flex-1 text-sm font-medium">{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className="h-5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead title="Menú" description="Menú de navegación" />
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full">
        {/* User header */}
        <div className="bg-card border-b border-border px-4 py-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border-2 border-border shadow-sm">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile?.full_name || ""} className="object-cover" />
              )}
              <AvatarFallback className="bg-primary/10 dark:bg-[#A6E300]/10 text-primary dark:text-[#A6E300] font-bold text-lg">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-base font-heading font-bold truncate">{profile?.full_name || "Usuario"}</h2>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Menu sections */}
        <div className="pb-6">
          {renderSection("", mainItems)}
          {renderSection("Compras", shoppingItems)}
          {renderSection("Vender", dealerItems)}
          {adminItems.length > 0 && renderSection("Administración", adminItems)}
          {renderSection("Información", infoItems)}
          {renderSection("Legal", legalItems)}

          {/* Sign out */}
          <div className="mt-2 bg-card">
            <button
              onClick={async () => { await signOut(); navigate("/auth"); }}
              className="flex items-center gap-3.5 px-4 py-3.5 w-full hover:bg-secondary/40 transition-colors text-destructive"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </main>
      <div className="sm:hidden h-16" />
      <BottomNav />
      <div className="hidden sm:block"><Footer /></div>
    </div>
  );
};

export default Menu;
