import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Shield, User, Search, Menu, X, Store, HelpCircle } from "lucide-react";
import AdminBadge from "@/components/AdminBadge";
import ReferButton from "@/components/ReferButton";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface NavbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const Navbar = ({ searchQuery, onSearchChange }: NavbarProps) => {
  const { user, profile, isAdmin, isDealer, loading, signOut } = useAuth();
  const { getSetting } = useSiteSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const siteName = getSetting("site_name", "SUBASTANDOLO");

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
    <header className="sticky top-0 z-[60] overflow-x-hidden">
      {/* Main Nav */}
      <div className="bg-nav">
        <div className="container mx-auto flex h-12 sm:h-14 items-center justify-between px-3 sm:px-4 gap-2">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt={siteName} className="h-6 sm:h-7 w-auto" />
          </Link>

          {/* Search - Desktop */}
          {onSearchChange && (
            <div className="hidden lg:flex flex-1 max-w-lg mx-4">
              <div className="relative w-full">
                <Input
                  placeholder="Buscar productos, lotes..."
                  value={searchQuery ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="bg-white text-foreground border-0 h-9 pr-10 rounded-full shadow-sm placeholder:text-muted-foreground/50 text-sm"
                />
                <button className="absolute right-0 top-0 h-9 w-10 bg-primary hover:bg-primary/90 flex items-center justify-center rounded-r-full transition-colors">
                  <Search className="h-4 w-4 text-primary-foreground" />
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
      <div className="hidden lg:block bg-nav-solid border-b border-white/5">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-0 h-9 text-[12px]">
            <Link to="/" className="px-3 py-1.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors font-medium rounded-md">Inicio</Link>
            <a href="/#subastas" className="px-3 py-1.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors font-medium rounded-md">Subastas</a>
            <Link to="/como-funciona" className="px-3 py-1.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors font-medium rounded-md">Cómo Funciona</Link>
            <Link to="/nosotros" className="px-3 py-1.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors font-medium rounded-md">Nosotros</Link>
            <Link to="/compradores" className="px-3 py-1.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors font-medium rounded-md">Compradores</Link>
            <Link to="/ayuda" className="px-3 py-1.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors font-medium rounded-md flex items-center gap-1"><HelpCircle className="h-3 w-3" />Ayuda</Link>
            <div className="ml-auto flex items-center gap-2">
              <ReferButton variant="compact" />
            </div>
            {!user && (
              <Link to="/auth" className="px-3 py-1.5 text-accent hover:text-accent/80 hover:bg-white/5 transition-colors font-bold flex items-center gap-1 border border-accent/30 rounded-full text-[11px]">
                <Store className="h-3 w-3" />Sé Dealer
              </Link>
            )}
          </nav>
        </div>
      </div>

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
            <a href="/#subastas" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Subastas</a>
            <Link to="/como-funciona" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Cómo Funciona</Link>
            <Link to="/nosotros" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Nosotros</Link>
            <Link to="/compradores" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary" onClick={() => setMobileMenuOpen(false)}>Compradores</Link>
            <Link to="/ayuda" className="px-3 py-2 rounded-lg text-foreground hover:bg-secondary flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
              <HelpCircle className="h-4 w-4" />Ayuda
            </Link>
            <div className="border-t border-border/50 my-1" />
            {!user && (
              <Link to="/auth" className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <Store className="h-4 w-4" />Regístrate como Dealer
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
