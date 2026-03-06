
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Shield, User, Search, Menu, X, Store, HelpCircle, Package } from "lucide-react";
import AdminBadge from "@/components/AdminBadge";
import ReferButton from "@/components/ReferButton";
import AnnouncementTicker from "@/components/AnnouncementTicker";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface NavbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const Navbar = ({ searchQuery, onSearchChange }: NavbarProps) => {
  const { user, profile, isAdmin, isDealer, signOut } = useAuth();
  const { getSetting } = useSiteSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const siteName = getSetting("site_name", "SUBASTANDOLO");
  const siteLogo = getSetting("site_logo", "/logo_letras.svg");

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Sesión cerrada", description: "Has cerrado sesión correctamente." });
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("Sign out error:", err);
      toast({ title: "Error", description: "No se pudo cerrar sesión. Intenta de nuevo.", variant: "destructive" });
    }
  };

  return (
    <header className="sticky top-0 z-[100] shadow-sm">
      {/* Main Nav */}
      <div className="bg-nav overflow-x-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 gap-4">
          <Link to="/" className="flex items-center shrink-0">
            <img src={siteLogo} alt={siteName} className="h-8 sm:h-10 w-auto object-contain" />
          </Link>

          {/* Search - Desktop */}
          {onSearchChange && (
            <div className="hidden lg:flex flex-1 max-w-2xl mx-8">
              <div className="relative w-full">
                <Input
                  placeholder="Buscar productos, marcas y más..."
                  value={searchQuery ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="bg-white text-foreground border-0 h-10 pr-12 rounded-full shadow-sm placeholder:text-muted-foreground/60 text-[15px] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <button className="absolute right-0 top-0 h-10 w-14 bg-[#244299] hover:bg-[#1e367d] flex items-center justify-center rounded-r-full transition-colors border-none">
                  <Search className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {user && <NotificationBell />}
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-0.5">
                  {!isDealer && !isAdmin && (
                    <Button variant="ghost" size="sm" asChild className="text-white/80 hover:text-white hover:bg-white/10 text-xs h-8 rounded-full">
                      <Link to="/mi-panel"><User className="h-3.5 w-3.5 mr-1" />Mi Panel</Link>
                    </Button>
                  )}
                  {(isDealer || isAdmin) && (
                    <>
                      <Button variant="ghost" size="sm" asChild className="text-white/80 hover:text-white hover:bg-white/10 text-xs h-8 rounded-full">
                        <Link to="/dealer"><Store className="h-3.5 w-3.5 mr-1" />Dealer</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild className="text-white/80 hover:text-white hover:bg-white/10 text-xs h-8 rounded-full">
                        <Link to="/mi-panel"><User className="h-3.5 w-3.5 mr-1" />Comprador</Link>
                      </Button>
                    </>
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="sm" asChild className="text-white/80 hover:text-white hover:bg-white/10 text-xs h-8 rounded-full">
                      <Link to="/admin"><Shield className="h-3.5 w-3.5 mr-1" />Admin</Link>
                    </Button>
                  )}
                  <Link to={isDealer || isAdmin ? "/dealer" : "/mi-panel"} className="hidden md:flex items-center gap-2 text-xs text-white/70 px-2 hover:text-white transition-colors">
                    <Avatar className="h-7 w-7 border border-white/20">
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.full_name || ""} />}
                      <AvatarFallback className="bg-white/10 text-white text-[10px]">
                        {(profile?.full_name || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{profile?.full_name || "Usuario"}</span>
                    {isAdmin && <AdminBadge size="sm" />}
                  </Link>
                </div>
                <div className="hidden sm:flex">
                  <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 rounded-full">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <Button size="sm" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-[10px] sm:text-xs h-8 px-3 sm:px-4 rounded-full whitespace-nowrap">
                <Link to="/auth"><span className="sm:hidden">Ingresar</span><span className="hidden sm:inline">Registrarse / Iniciar sesión</span></Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="lg:hidden text-white/70 h-8 w-8 rounded-full" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Secondary Nav - Desktop */}
      <div className="hidden lg:block bg-nav-solid border-t border-white/10">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-1 h-10 text-[13px]">
            <Link to="/" className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium rounded-sm">Inicio</Link>
            <Link to="/tienda" className="px-3 py-1.5 text-accent hover:text-white hover:bg-white/10 transition-colors font-bold rounded-sm flex items-center gap-1"><Store className="h-3.5 w-3.5" />Tienda</Link>
            {user && (
              <Link to="/mi-panel?tab=purchases" className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium rounded-sm flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />Mis Compras
              </Link>
            )}
            <a href="/#subastas" className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium rounded-sm">Subastas</a>
            <Link to="/como-funciona" className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium rounded-sm">Cómo Funciona</Link>
            <Link to="/nosotros" className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium rounded-sm">Nosotros</Link>
            <Link to="/compradores" className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium rounded-sm">Compradores</Link>
            <Link to="/ayuda" className="px-3 py-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium rounded-sm flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" />Ayuda</Link>
            <div className="ml-auto flex items-center gap-3">
              <ReferButton variant="compact" />
            </div>
            {!user && (
              <Link to="/quiero-vender" className="px-4 py-1.5 text-accent hover:bg-accent/10 transition-colors font-bold flex items-center gap-1.5 border border-accent rounded-full text-[12px] ml-2">
                Quiero Vender
              </Link>
            )}
          </nav>
        </div>
      </div>

      {/* Announcement Ticker */}
      <AnnouncementTicker message={getSetting("announcement_bar", "")} />

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-card border-b border-border p-4 space-y-3 overflow-x-hidden shadow-lg">
          {onSearchChange && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar productos..." value={searchQuery ?? ""} onChange={(e) => onSearchChange(e.target.value)} className="pl-10 rounded-full h-9" />
            </div>
          )}

          {user && (
            <Link to={isDealer || isAdmin ? "/dealer" : "/mi-panel"} className="flex items-center gap-3 px-3 py-2 bg-secondary/40 rounded-xl text-sm" onClick={() => setMobileMenuOpen(false)}>
              <Avatar className="h-8 w-8 border border-border">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.full_name || ""} />}
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {(profile?.full_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{profile?.full_name || "Usuario"}</span>
              {isAdmin && <AdminBadge size="sm" />}
            </Link>
          )}

          <nav className="flex flex-col gap-0.5 text-sm">
            {user && (
              <>
                {!isDealer && !isAdmin && (
                  <Link to="/mi-panel" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                    <User className="h-4 w-4" />Mi Panel
                  </Link>
                )}
                {(isDealer || isAdmin) && (
                  <>
                    <Link to="/dealer" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                      <Store className="h-4 w-4" />Panel Dealer
                    </Link>
                    <Link to="/mi-panel" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                      <User className="h-4 w-4" />Panel Comprador
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <Link to="/admin" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                    <Shield className="h-4 w-4" />Admin
                  </Link>
                )}
              </>
            )}
            <div className="border-t border-border/50 my-1" />
            <Link to="/" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Inicio</Link>
            <Link to="/tienda" className="px-3 py-2 rounded-lg text-accent font-bold hover:bg-secondary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}><Store className="h-4 w-4" />Tienda</Link>
            {user && (
              <Link to="/mi-panel?tab=purchases" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Package className="h-4 w-4" />Mis Compras
              </Link>
            )}
            <a href="/#subastas" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Subastas</a>
            <Link to="/como-funciona" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Cómo Funciona</Link>
            <Link to="/nosotros" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Nosotros</Link>
            <Link to="/compradores" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Compradores</Link>
            <Link to="/ayuda" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
              <HelpCircle className="h-4 w-4" />Ayuda
            </Link>
            <div className="border-t border-border/50 my-1" />
            {!user && (
              <Link to="/quiero-vender" className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Store className="h-4 w-4" />Quiero Vender
              </Link>
            )}
            {user && (
              <>
                <div className="border-t border-border/50 my-1" />
                <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="px-3 py-2 rounded-lg text-destructive hover:bg-secondary flex items-center gap-2 text-left w-full">
                  <LogOut className="h-4 w-4" />Cerrar Sesión
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
