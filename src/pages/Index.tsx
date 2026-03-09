import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useVerifiedDealers } from "@/hooks/useVerifiedDealers";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { fuzzyFilter } from "@/lib/fuzzySearch";
import AuctionCard from "@/components/AuctionCard";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { Search, Flame, Clock, Gavel, ArrowRight, Store, Globe, Sparkles } from "lucide-react";
import { AuctionGridSkeleton } from "@/components/AuctionCardSkeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import CampaignModal from "@/components/CampaignModal";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import type { Tables } from "@/integrations/supabase/types";

const Index = () => {
  const { getSetting, sections } = useSiteSettings();
  const { user } = useAuth();
  // Initialize from cache for instant render on back navigation
  const cachedAuctions = useMemo(() => {
    try {
      const cached = sessionStorage.getItem("cache:auctions");
      return cached ? JSON.parse(cached) as Tables<"auctions">[] : [];
    } catch { return []; }
  }, []);
  const [auctions, setAuctions] = useState<Tables<"auctions">[]>(cachedAuctions);
  const [loading, setLoading] = useState(cachedAuctions.length === 0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "ending_soon" | "newest" | "finalized" | "my_bids">("all");
  const [userBidAuctionIds, setUserBidAuctionIds] = useState<Set<string>>(new Set());
  const [banners, setBanners] = useState<{ id: string; image_url: string; title: string | null; subtitle: string | null; description: string | null }[]>([]);

  const siteName = getSetting("site_name", "SUBASTANDOLO");
  const siteDescription = getSetting("site_description", "La plataforma #1 de subastas en línea");
  const heroCta = getSetting("hero_cta_text", "Regístrate para Pujar");


  useEffect(() => {
    const fetchBanners = async () => {
      const { data } = await supabase.from("banner_images").select("id, image_url, title, subtitle, description").eq("is_active", true).order("display_order");
      setBanners(data || []);
    };
    fetchBanners();
  }, []);

  const bannerInterval = parseInt(getSetting("banner_interval", "5"), 10) * 1000;
  const bannerPaused = useRef(false);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const interval = setInterval(() => {
      if (!bannerPaused.current) setCurrentSlide(prev => (prev + 1) % banners.length);
    }, bannerInterval);
    return () => clearInterval(interval);
  }, [banners.length, bannerInterval]);

  const fetchAuctions = useCallback(async () => {
    setFetchError(null);
    // Only show loading skeleton if no cached data
    if (auctions.length === 0) setLoading(true);
    const { data, error } = await supabase.from("auctions").select("*").in("status", ["active", "finalized", "scheduled"]).is("archived_at", null).order("end_time", { ascending: true });
    setLoading(false);
    if (error) {
      setFetchError(error.message);
      return;
    }
    setAuctions(data || []);
    // Cache for instant render on back navigation
    try { sessionStorage.setItem("cache:auctions", JSON.stringify(data || [])); } catch { }
  }, []);

  useEffect(() => {
    void fetchAuctions();
    const channel = supabase.channel("auctions-realtime").on("postgres_changes", { event: "*", schema: "public", table: "auctions" }, (payload) => {
      if (payload.eventType === "DELETE") {
        setAuctions(prev => prev.filter(a => a.id !== (payload.old as any).id));
      } else if (payload.eventType === "INSERT") {
        const newAuction = payload.new as Tables<"auctions">;
        if (!newAuction.archived_at && ["active", "finalized", "scheduled"].includes(newAuction.status)) {
          setAuctions(prev => [...prev, newAuction]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Tables<"auctions">;
        const shouldBeVisible = !updated.archived_at && ["active", "finalized", "scheduled"].includes(updated.status);
        setAuctions(prev => {
          if (shouldBeVisible) {
            const exists = prev.find(a => a.id === updated.id);
            return exists ? prev.map(a => a.id === updated.id ? updated : a) : [...prev, updated];
          }
          return prev.filter(a => a.id !== updated.id);
        });
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAuctions]);

  useEffect(() => {
    if (!user) {
      setUserBidAuctionIds(new Set());
      return;
    }
    const fetchUserBids = async () => {
      const { data } = await supabase.from("bids").select("auction_id").eq("user_id", user.id);
      if (data) {
        setUserBidAuctionIds(new Set(data.map(b => b.auction_id)));
      }
    };
    fetchUserBids();
  }, [user]);

  const creatorIds = useMemo(() => auctions.map(a => a.created_by), [auctions]);
  const { dealers } = useVerifiedDealers(creatorIds);
  const { isFavorite, toggleFavorite } = useFavorites();

  const filtered = useMemo(() => {
    let result = auctions;
    if (activeFilter === "active") {
      result = result.filter(a => a.status === "active");
    } else if (activeFilter === "ending_soon") {
      result = result.filter(a => a.status === "active").sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());
    } else if (activeFilter === "newest") {
      result = result.filter(a => a.status === "active" || a.status === "scheduled").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (activeFilter === "finalized") {
      result = result.filter(a => a.status === "finalized").sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
    } else if (activeFilter === "my_bids") {
      result = result.filter(a => userBidAuctionIds.has(a.id));
    }
    if (!searchQuery.trim()) return result;
    return fuzzyFilter(
      result,
      searchQuery,
      (a) => a.title + " " + (a.description || ""),
      (a) => (a as any).operation_number,
    );
  }, [auctions, searchQuery, activeFilter, userBidAuctionIds]);

  const scheduledAuctions = filtered.filter(a => a.status === "scheduled");
  const activeAuctions = filtered.filter(a => a.status === "active");
  const endedAuctions = filtered.filter(a => a.status === "finalized");

  const visibleSections = sections.filter(s =>
    s.is_visible &&
    s.section_type !== "guide" &&
    s.section_type !== "cta" &&
    !s.title?.toLowerCase().includes("cómo funciona") &&
    !s.title?.toLowerCase().includes("preguntas frecuentes")
  );

  if (loading && auctions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingState message="Cargando subastas..." className="min-h-[50vh]" />
      </div>
    );
  }

  if (fetchError && auctions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <main className="flex-1 flex items-center justify-center p-4 text-center">
          <ErrorState
            title="Error al cargar"
            message={`No pudimos cargar las subastas. Error: ${fetchError}`}
            onRetry={fetchAuctions}
            retryLabel="Reintentar"
          />
        </main>
      </div>
    );
  }

  const filterButtons = [
    { key: "all" as const, icon: Search, label: "Todas", count: auctions.length },
    { key: "active" as const, icon: Flame, label: "En Vivo", count: auctions.filter(a => a.status === "active").length },
    { key: "ending_soon" as const, icon: Clock, label: "Por Terminar", count: auctions.filter(a => a.status === "active").length },
    { key: "newest" as const, icon: Sparkles, label: "Nuevas", count: auctions.filter(a => a.status === "active" || a.status === "scheduled").length },
    { key: "finalized" as const, icon: Gavel, label: "Finalizadas", count: auctions.filter(a => a.status === "finalized").length },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <CampaignModal />
      <SEO
        title="Subastas Online en Venezuela - Tú pones el precio"
        description="La plataforma de subastas más segura de Venezuela. Compra tecnología, hogar y más con solo el 10% de comisión. ¡El mejor postor gana!"
        schemaData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Subastandolo.com",
          "url": "https://www.subastandolo.com",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://www.subastandolo.com/home?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main>


        {/* Banners start immediately after the Navbar */}



        {/* Banner */}
        {banners.length > 0 && (
          <section
            className="relative overflow-hidden h-[170px] sm:h-[360px] sm:rounded-xl sm:mx-4 sm:mt-3"
            onMouseEnter={() => { bannerPaused.current = true; }}
            onMouseLeave={() => { bannerPaused.current = false; }}
            onTouchStart={() => { bannerPaused.current = true; }}
            onTouchEnd={() => { bannerPaused.current = false; }}
          >
            {banners.map((banner, index) => (
              <div key={banner.id} className={`absolute inset-0 transition-opacity duration-700 ${index === currentSlide ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <img
                  src={banner.image_url}
                  alt={banner.title || "Banner"}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading={index <= 1 ? "eager" : "lazy"}
                  decoding="async"
                />
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.40) 45%, rgba(0,0,0,0.05) 75%, transparent 100%)' }} />
              </div>
            ))}
            <div className="container mx-auto px-4 sm:px-5 h-full flex items-center relative z-10">
              {/* Text container: no truncate, allows natural wrap and better scaling, but tight and structured */}
              <div className="w-full max-w-[90%] sm:max-w-2xl">
                {banners[currentSlide] && (
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    {banners[currentSlide].title && (
                      <h1 className="font-heading font-black text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] leading-[1.1] text-[clamp(1.4rem,4vw,2.75rem)] uppercase tracking-tight text-balance">
                        {banners[currentSlide].title}
                      </h1>
                    )}
                    {banners[currentSlide].subtitle && (
                      <p className="font-semibold text-white/95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-snug text-[clamp(0.9rem,2vw,1.35rem)] mt-0.5 text-balance">
                        {banners[currentSlide].subtitle}
                      </p>
                    )}
                    {banners[currentSlide].description && (
                      <p className="font-normal text-white/85 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-snug text-[clamp(0.8rem,1.5vw,1rem)] mt-1 line-clamp-2 max-w-xl">
                        {banners[currentSlide].description}
                      </p>
                    )}
                  </div>
                )}
                {!user && (
                  <Button size="default" asChild className="hidden sm:inline-flex bg-[#B5FB05] text-[#1a1a2e] hover:bg-[#9fe004] font-bold rounded-full shadow-lg text-sm h-11 px-8 mt-4 sm:mt-5 transition-transform hover:scale-105">
                    <Link to="/auth">{heroCta}</Link>
                  </Button>
                )}
              </div>
            </div>
            {banners.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
                {banners.map((_, i) => <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentSlide ? "bg-white w-5" : "bg-white/40"}`} />)}
              </div>
            )}
          </section>
        )}

        {banners.length === 0 && (
          <section className="bg-brand-dark py-14 sm:rounded-xl sm:mx-4 sm:mt-3">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-white mb-3">{siteName}</h2>
              <p className="text-white/50 mb-5 max-w-md mx-auto text-sm">{siteDescription}</p>
              {!user && (
                <Button size="default" asChild className="bg-[#B5FB05] text-[#1a1a2e] hover:bg-[#9fe004] font-bold rounded-full shadow-lg h-11 px-8 text-sm mt-2">
                  <Link to="/auth">{heroCta}</Link>
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Removed generic categories section to establish a unique layout */}

        {/* Stats */}
        <div className="bg-card border-b border-border">
          <div className="container mx-auto px-4 py-2.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span><strong className="text-foreground text-sm">{auctions.length}</strong> productos</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <strong className="text-foreground text-sm">{auctions.filter(a => a.status === "active").length}</strong> en vivo
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="sticky top-12 sm:top-14 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="container mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide -mx-1 px-1">
              {filterButtons.map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all duration-200 ${activeFilter === f.key
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                >
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${activeFilter === f.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                    }`}>{f.count}</span>
                  {activeFilter === f.key && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary-foreground/50" />
                  )}
                </button>
              ))}
              {user && (
                <button
                  onClick={() => setActiveFilter("my_bids")}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all duration-200 ${activeFilter === "my_bids"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                >
                  <Gavel className="h-3.5 w-3.5" />
                  Mis Pujas
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${activeFilter === "my_bids"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                    }`}>{userBidAuctionIds.size}</span>
                  {activeFilter === "my_bids" && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary-foreground/50" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Listings */}
        <section id="subastas" className="container mx-auto px-3 sm:px-4 py-5 sm:py-6">
          {loading ? (
            <AuctionGridSkeleton />
          ) : filtered.length === 0 && (searchQuery || activeFilter !== "all") ? (
            <div className="text-center py-16">
              <Search className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <h2 className="text-base font-heading font-semibold text-muted-foreground">
                {activeFilter === "my_bids" ? "No has pujado en ninguna subasta aún" : `Sin resultados para "${searchQuery}"`}
              </h2>
              {activeFilter === "my_bids" && (
                <p className="text-xs text-muted-foreground mt-1.5">Explora las subastas activas y haz tu primera puja</p>
              )}
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-16">
              <h2 className="text-base font-heading font-semibold text-muted-foreground">No hay subastas disponibles</h2>
            </div>
          ) : activeFilter !== "all" ? (
            /* Single flat grid for specific filters */
            <div>
              <h2 className="text-sm sm:text-base font-heading font-bold mb-3 flex items-center gap-2 px-0.5">
                {activeFilter === "active" && <><span className="w-2 h-2 rounded-full bg-success animate-pulse" />Subastas En Vivo</>}
                {activeFilter === "ending_soon" && <><Clock className="h-4 w-4 text-orange-400" />Por Terminar</>}
                {activeFilter === "newest" && <><Sparkles className="h-4 w-4 text-primary" />Más Recientes</>}
                {activeFilter === "finalized" && <><Gavel className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Finalizadas</span></>}
                {activeFilter === "my_bids" && <><Gavel className="h-4 w-4 text-primary" />Mis Pujas</>}
                <span className="text-[10px] font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{filtered.length}</span>
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                {filtered.map(a => <AuctionCard key={a.id} auction={a} dealer={dealers[a.created_by]} isFavorite={isFavorite(a.id)} onToggleFavorite={toggleFavorite} />)}
              </div>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {scheduledAuctions.length > 0 && (
                <div>
                  <h2 className="text-sm sm:text-base font-heading font-bold mb-3 flex items-center gap-2 px-0.5">
                    <Clock className="h-4 w-4 text-primary" />
                    Próximamente
                    <span className="text-[10px] font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{scheduledAuctions.length}</span>
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                    {scheduledAuctions.map(a => <AuctionCard key={a.id} auction={a} dealer={dealers[a.created_by]} isFavorite={isFavorite(a.id)} onToggleFavorite={toggleFavorite} />)}
                  </div>
                </div>
              )}
              {activeAuctions.length > 0 && (
                <div>
                  <h2 className="text-sm sm:text-base font-heading font-bold mb-3 flex items-center gap-2 px-0.5">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    Subastas Activas
                    <span className="text-[10px] font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{activeAuctions.length}</span>
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                    {activeAuctions.map(a => <AuctionCard key={a.id} auction={a} dealer={dealers[a.created_by]} isFavorite={isFavorite(a.id)} onToggleFavorite={toggleFavorite} />)}
                  </div>
                </div>
              )}
              {endedAuctions.length > 0 && (
                <div>
                  <h2 className="text-sm sm:text-base font-heading font-bold mb-3 text-muted-foreground px-0.5 flex items-center gap-2">
                    <Gavel className="h-4 w-4" />
                    Finalizadas
                    <span className="text-[10px] font-normal bg-secondary px-2 py-0.5 rounded-full">{endedAuctions.length}</span>
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                    {endedAuctions.map(a => <AuctionCard key={a.id} auction={a} dealer={dealers[a.created_by]} isFavorite={isFavorite(a.id)} onToggleFavorite={toggleFavorite} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>


        {/* Dynamic sections */}
        {visibleSections.map(section => (
          <section key={section.id} className={`py-12 ${section.section_type === "cta" ? "bg-brand-dark text-white" : "bg-secondary/20"}`}>
            <div className="container mx-auto px-4 text-center max-w-xl">
              {section.title && <h2 className={`text-xl font-heading font-bold mb-3 ${section.section_type === "cta" ? "text-white" : ""}`}>{section.title}</h2>}
              {section.content && <p className={`text-sm ${section.section_type === "cta" ? "text-white/50 mb-5" : "text-muted-foreground"}`}>{section.content}</p>}
              {section.section_type === "cta" && !user && (
                <Button size="default" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-full">
                  <Link to="/auth">{heroCta}</Link>
                </Button>
              )}
            </div>
          </section>
        ))}

        {/* Premium CTA Section */}
        <section className="relative overflow-hidden bg-primary py-20">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-accent/10 -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-accent/5 translate-y-1/3 -translate-x-1/3 blur-2xl pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <Link to="/auth" className="inline-flex items-center gap-2 bg-accent/20 hover:bg-accent/30 transition-colors border border-accent/40 text-accent text-xs font-bold px-5 py-2 rounded-full mb-6 tracking-wide uppercase shadow-sm cursor-pointer">
                <Globe className="h-3.5 w-3.5" />
                Registrarse en Subastandolo
              </Link>
              <h2 className="text-3xl sm:text-4xl font-heading font-black text-white mb-4 leading-tight">
                ¿Listo para conseguir
                <span className="text-accent"> los mejores precios?</span>
              </h2>
              <p className="text-white/50 text-base mb-8 max-w-xl mx-auto leading-relaxed">
                Únete a miles de compradores que ya están ganando subastas increíbles.
                Sin intermediarios. Tú pones el precio.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {!user && (
                  <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-black text-sm h-12 px-8 rounded-full shadow-lg shadow-accent/25">
                    <Link to="/auth">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Registrarse Gratis
                    </Link>
                  </Button>
                )}
                <Button size="lg" variant="outline" asChild className="bg-transparent border-white/20 text-white hover:bg-white/10 font-bold text-sm h-12 px-8 rounded-full">
                  <Link to="/quiero-vender">
                    <Store className="h-4 w-4 mr-2" />
                    Quiero Vender
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
      <BottomNav />
    </div>
  );
};

export default Index;
