import { useState, useEffect } from "react";
import WonAuctionCard from "@/components/WonAuctionCard";
import { useNavigate, Link } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { useDisputes, type Dispute } from "@/hooks/useDisputes";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useBuyerWins } from "@/hooks/useBuyerStats";
import { useUserReviews } from "@/hooks/useReviews";
import { useFavorites } from "@/hooks/useFavorites";
import BuyerBadge, { getBuyerTier } from "@/components/BuyerBadge";
import AdminBadge from "@/components/AdminBadge";
import ReputationThermometer from "@/components/ReputationThermometer";
import DisputeChat from "@/components/DisputeChat";
import DisputeForm from "@/components/DisputeForm";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import ProfileAvatarUpload from "@/components/ProfileAvatarUpload";
import AuctionCard from "@/components/AuctionCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ArrowLeft, AlertTriangle, Clock, CheckCircle, Shield, Scale,
  ChevronRight, ImageIcon, Store, Download, User, Package, Gavel, Plus, Star, Heart, Trophy,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Abierta", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: AlertTriangle },
  mediation: { label: "En Mediación", color: "bg-primary/10 text-primary border-primary/20", icon: Scale },
  resolved: { label: "Resuelta", color: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle },
  refunded: { label: "Reembolsada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Shield },
};

type PanelView = "overview" | "disputes" | "dispute-detail" | "new-dispute";

const BuyerPanel = () => {
  const { user, profile, isDealer, isAdmin, loading: authLoading } = useAuth();
  const { getSetting } = useSiteSettings();
  const { winsCount } = useBuyerWins(user?.id);
  const { buyerStats } = useUserReviews(user?.id);
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();
  const { disputes, loading: disputesLoading, requestAdminIntervention, createDispute } = useDisputes();
  const [view, setView] = useState<PanelView>("overview");
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [wonAuctions, setWonAuctions] = useState<Tables<"auctions">[]>([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true);
  const [selectedAuctionForDispute, setSelectedAuctionForDispute] = useState<Tables<"auctions"> | null>(null);
  const [favoriteAuctions, setFavoriteAuctions] = useState<Tables<"auctions">[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);

  const siteName = getSetting("site_name", "SUBASTANDOLO");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchWon = async () => {
      const { data } = await supabase
        .from("auctions")
        .select("*")
        .eq("winner_id", user.id)
        .in("status", ["finalized", "active"])
        .lte("end_time", new Date().toISOString())
        .order("end_time", { ascending: false });
      setWonAuctions(data || []);
      setLoadingAuctions(false);
    };
    fetchWon();
  }, [user]);

  // Fetch favorite auctions
  useEffect(() => {
    if (!user || favoriteIds.size === 0) {
      setFavoriteAuctions([]);
      setLoadingFavorites(false);
      return;
    }
    const fetchFavs = async () => {
      const ids = Array.from(favoriteIds);
      const { data } = await supabase
        .from("auctions")
        .select("*")
        .in("id", ids)
        .order("end_time", { ascending: true });
      setFavoriteAuctions(data || []);
      setLoadingFavorites(false);
    };
    fetchFavs();
  }, [user, favoriteIds]);

  const loadEvidence = async (urls: string[]) => {
    setLoadingEvidence(true);
    const signed: string[] = [];
    for (const path of urls) {
      const { data } = await supabase.storage.from("dispute-evidence").createSignedUrl(path, 3600);
      if (data?.signedUrl) signed.push(data.signedUrl);
    }
    setEvidenceUrls(signed);
    setLoadingEvidence(false);
  };

  const handleSelectDispute = (d: Dispute) => {
    setSelectedDispute(d);
    setView("dispute-detail");
    if (d.evidence_urls.length > 0) loadEvidence(d.evidence_urls);
    else setEvidenceUrls([]);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  // Dispute detail view
  if (view === "dispute-detail" && selectedDispute) {
    const sc = STATUS_CONFIG[selectedDispute.status] || STATUS_CONFIG.open;
    const Icon = sc.icon;
    const deadlinePassed = selectedDispute.dealer_deadline && new Date(selectedDispute.dealer_deadline).getTime() < Date.now();

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-3xl">
          <button onClick={() => { setView("disputes"); setSelectedDispute(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft className="h-3 w-3" /> Volver a disputas
          </button>

          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-sm">{selectedDispute.auction_title}</h2>
                <p className="text-xs text-muted-foreground">{selectedDispute.category}</p>
              </div>
              <Badge variant="outline" className={sc.color}>
                <Icon className="h-3 w-3 mr-1" />
                {sc.label}
              </Badge>
            </div>

            <div className="p-4 border-b border-border space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Comprador: <strong className="text-foreground">{selectedDispute.buyer_name}</strong></span>
                <span>Dealer: <strong className="text-foreground">{selectedDispute.dealer_name}</strong></span>
              </div>
              <p className="text-sm">{selectedDispute.description}</p>

              {selectedDispute.dealer_deadline && (
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  <span className={deadlinePassed ? "text-destructive font-semibold" : "text-muted-foreground"}>
                    Plazo del dealer: {new Date(selectedDispute.dealer_deadline).toLocaleString("es-MX")}
                    {deadlinePassed && " — VENCIDO"}
                  </span>
                </div>
              )}

              {selectedDispute.resolution && (
                <div className="bg-primary/10 border border-primary/20 rounded-sm p-3 text-sm">
                  <strong>Resolución:</strong> {selectedDispute.resolution}
                </div>
              )}
            </div>

            {selectedDispute.evidence_urls.length > 0 && (
              <div className="p-4 border-b border-border">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Evidencia ({selectedDispute.evidence_urls.length})
                </h4>
                {loadingEvidence ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div className="flex gap-2 overflow-x-auto">
                    {evidenceUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Evidencia ${i + 1}`} className="h-20 w-20 object-cover rounded-sm border border-border" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DisputeChat disputeId={selectedDispute.id} disputeStatus={selectedDispute.status} />

            {selectedDispute.status === "open" && selectedDispute.buyer_id === user.id && !selectedDispute.admin_requested && (
              <div className="p-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
                  onClick={() => requestAdminIntervention(selectedDispute.id)}
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Solicitar Intervención del Administrador
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Disputes list view
  if (view === "disputes") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-3xl">
          <button onClick={() => setView("overview")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft className="h-3 w-3" /> Volver a mi panel
          </button>

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Mis Disputas
            </h1>
            <Button size="sm" className="bg-primary text-primary-foreground rounded-sm text-xs" onClick={() => setView("new-dispute")}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nueva Disputa
            </Button>
          </div>

          {disputesLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : disputes.length === 0 ? (
            <div className="bg-card border border-border rounded-sm p-8 text-center">
              <CheckCircle className="h-10 w-10 text-primary mx-auto mb-3" />
              <p className="font-heading font-bold">Sin disputas</p>
              <p className="text-sm text-muted-foreground mt-1">No tienes disputas abiertas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {disputes.map(d => {
                const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.open;
                const Icon = sc.icon;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleSelectDispute(d)}
                    className="w-full bg-card border border-border rounded-sm p-4 text-left hover:border-primary/30 transition-colors flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold text-sm truncate">{d.auction_title}</p>
                      <p className="text-xs text-muted-foreground">{d.category}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(d.created_at).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <Badge variant="outline" className={sc.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {sc.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 bg-muted/50 border border-border rounded-sm p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">📜 Garantía de Subasta Segura</p>
            <p><strong>Para el Comprador:</strong> Si el producto no coincide con la descripción, tienes 72 horas tras recibirlo para abrir una disputa.</p>
            <p><strong>Para el Dealer:</strong> Si el comprador abre una disputa injustificada, puedes presentar tus pruebas.</p>
          </div>
        </main>
      </div>
    );
  }

  // New dispute view
  if (view === "new-dispute") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-3xl">
          <button onClick={() => setView("disputes")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft className="h-3 w-3" /> Volver a disputas
          </button>
          <h1 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Abrir Nueva Disputa
          </h1>

          {loadingAuctions ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : wonAuctions.length === 0 ? (
            <div className="bg-card border border-border rounded-sm p-8 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-heading font-bold">Sin subastas ganadas</p>
              <p className="text-sm text-muted-foreground mt-1">Necesitas haber ganado una subasta para abrir una disputa.</p>
            </div>
          ) : !selectedAuctionForDispute ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">Selecciona la subasta sobre la que deseas abrir la disputa:</p>
              {wonAuctions.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAuctionForDispute(a)}
                  className="w-full bg-card border border-border rounded-sm p-4 text-left hover:border-primary/30 transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold text-sm truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">${a.current_price} USD</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-3">Disputa para: <strong className="text-foreground">{selectedAuctionForDispute.title}</strong></p>
              <DisputeForm
                onSubmit={async (category, description, files, desiredResolution, signatureData) => {
                  const result = await createDispute(
                    selectedAuctionForDispute.id,
                    selectedAuctionForDispute.created_by,
                    category,
                    description,
                    files,
                    desiredResolution,
                    signatureData
                  );
                  if (result) {
                    setSelectedAuctionForDispute(null);
                    setView("disputes");
                  }
                  return result;
                }}
                onCancel={() => setSelectedAuctionForDispute(null)}
              />
            </div>
          )}
        </main>
      </div>
    );
  }

  // Overview
  const openDisputes = disputes.filter(d => d.status === "open" || d.status === "mediation").length;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Mi Panel" description="Panel de control del comprador - Gestiona tus subastas, disputas y favoritos" />
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
          <button onClick={() => navigate("/")} className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Inicio
          </button>
          <span>/</span>
          <span className="text-foreground">Mi Panel</span>
        </div>

        {/* Welcome header with buyer badge */}
        <div className="bg-card border border-border rounded-sm p-4 sm:p-6 mb-6 overflow-hidden">
          {/* Mobile: compact layout */}
          <div className="flex items-center gap-3 sm:hidden">
            <Avatar className="h-14 w-14 border-2 border-border shadow-sm shrink-0">
              {(profile as any)?.avatar_url && <AvatarImage src={(profile as any).avatar_url} alt={profile?.full_name || ""} className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm font-heading font-bold truncate">¡Hola, {profile?.full_name || "Usuario"}!</h1>
                {isAdmin && <AdminBadge size="sm" />}
                <BuyerBadge size="sm" winsCount={winsCount} isAdmin={isAdmin} manualTier={profile?.manual_buyer_tier} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Panel de control en {siteName}</p>
              {(profile as any)?.public_id && (
                <span className="text-[9px] font-mono bg-secondary text-muted-foreground px-1 py-0.5 rounded-sm border border-border">
                  {(profile as any).public_id}
                </span>
              )}
            </div>
          </div>

          {/* Desktop: full layout with avatar upload */}
          <div className="hidden sm:flex items-center gap-4">
            <ProfileAvatarUpload
              avatarUrl={(profile as any)?.avatar_url || null}
              userName={profile?.full_name || "Usuario"}
              onAvatarChange={() => {}}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-heading font-bold">¡Hola, {profile?.full_name || "Usuario"}!</h1>
                {isAdmin && <AdminBadge size="md" showLabel />}
                <BuyerBadge size="md" winsCount={winsCount} showLabel isAdmin={isAdmin} manualTier={profile?.manual_buyer_tier} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground">Bienvenido a tu panel de control en {siteName}</p>
                {(profile as any)?.public_id && (
                  <span className="text-[9px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-sm border border-border">
                    {(profile as any).public_id}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Buyer reputation bar */}
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Star className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-amber-400" />
              <span className="text-[10px] sm:text-xs font-semibold">Mi Reputación</span>
            </div>
            <ReputationThermometer
              percentage={buyerStats.positivePercentage}
              totalReviews={buyerStats.totalReviews}
              size="sm"
            />
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              {winsCount} {winsCount === 1 ? "ganada" : "ganadas"}
            </span>
          </div>
        </div>

        {/* === WON AUCTIONS — MercadoLibre style === */}
        {!loadingAuctions && wonAuctions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-heading font-bold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Mis Compras
              <Badge variant="secondary" className="ml-1 text-[10px]">{wonAuctions.length}</Badge>
            </h2>

            {/* Reviews CTA */}
            <div className="bg-card border border-border rounded-sm p-4 mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Opina sobre tus productos</p>
                <button onClick={() => navigate("/mi-panel")} className="text-xs text-primary hover:underline">Ir a mis opiniones</button>
              </div>
              <Star className="h-6 w-6 text-amber-400" />
            </div>

            {/* Purchase cards grouped by date */}
            <div className="space-y-3">
              {wonAuctions.map(a => {
                const endDate = new Date(a.end_time);
                const dateStr = endDate.toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" });
                
                const statusLabel = 
                  a.delivery_status === "delivered" || a.delivered_at ? "Entregado" :
                  a.delivery_status === "shipped" || a.tracking_number ? "En camino" :
                  a.payment_status === "verified" ? "Pago verificado" :
                  a.payment_status === "under_review" ? "Pago en revisión" :
                  a.payment_status === "escrow" ? "En escrow" :
                  "Pago pendiente";

                const statusColor = 
                  a.delivery_status === "delivered" || a.delivered_at ? "text-emerald-600" :
                  a.delivery_status === "shipped" || a.tracking_number ? "text-primary" :
                  a.payment_status === "verified" ? "text-primary" :
                  "text-amber-600";

                const statusDesc =
                  a.delivery_status === "delivered" || a.delivered_at ? "Asumimos que ya recibiste la compra" :
                  a.delivery_status === "shipped" || a.tracking_number ? "Tu producto está en camino" :
                  a.payment_status === "verified" ? "El dealer preparará tu envío" :
                  a.payment_status === "under_review" ? "Estamos revisando tu comprobante" :
                  "Sube tu comprobante de pago";

                return (
                  <div
                    key={a.id}
                    className="bg-card border border-border rounded-sm overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/auction/${a.id}`)}
                  >
                    {/* Date header */}
                    <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-secondary/20">
                      <p className="text-xs font-medium text-foreground">{dateStr}</p>
                      <span className="text-[11px] text-primary font-medium hover:underline">Ver detalle</span>
                    </div>

                    {/* Product row */}
                    <div className="p-4 flex items-center gap-3">
                      {a.image_url ? (
                        <img src={a.image_url} alt={a.title} className="w-16 h-16 rounded-sm object-cover border border-border shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-sm bg-muted border border-border flex items-center justify-center shrink-0">
                          <Package className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{statusDesc}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate font-medium">{a.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">${a.current_price.toLocaleString("es-MX")} USD</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loadingAuctions && (
          <div className="mb-6 bg-card border border-border rounded-sm p-8 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Cargando compras...</span>
          </div>
        )}

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Disputes */}
          <Card
            className="border border-border rounded-sm cursor-pointer hover:border-primary/30 transition-colors group"
            onClick={() => setView("disputes")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-sm bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm">Mis Disputas</p>
                <p className="text-xs text-muted-foreground">
                  {openDisputes > 0 ? `${openDisputes} disputa(s) activa(s)` : "Sin disputas activas"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </CardContent>
          </Card>

          {/* Ser Dealer */}
          {!isDealer && !isAdmin && (
            <Card
              className="border border-accent/40 rounded-sm cursor-pointer hover:border-accent transition-colors group bg-accent/5"
              onClick={() => navigate("/dealer/apply")}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-sm bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <Store className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm text-accent">Ser Dealer</p>
                  <p className="text-xs text-muted-foreground">Vende tus productos en subastas</p>
                </div>
                <ChevronRight className="h-4 w-4 text-accent ml-auto shrink-0" />
              </CardContent>
            </Card>
          )}

          {/* Descargar App */}
          <Card
            className="border border-border rounded-sm cursor-pointer hover:border-primary/30 transition-colors group"
            onClick={() => navigate("/instalar")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-sm bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm">Descargar App</p>
                <p className="text-xs text-muted-foreground">Instala la app en tu dispositivo</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* Favorites section */}
        {favoriteAuctions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" />
              Mis Favoritos
              <span className="text-xs font-normal text-muted-foreground">({favoriteAuctions.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteAuctions.map(a => (
                <AuctionCard
                  key={a.id}
                  auction={a}
                  isFavorite={isFavorite(a.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </div>
        )}
      </main>
      <div className="hidden sm:block"><Footer /></div>
      <div className="sm:hidden h-14" />
      <BottomNav />
    </div>
  );
};

export default BuyerPanel;
