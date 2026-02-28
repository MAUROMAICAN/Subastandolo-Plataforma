import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVerifiedDealer } from "@/hooks/useVerifiedDealers";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useUserReviews } from "@/hooks/useReviews";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import VerifiedBadge, { getDealerTier, DEALER_TIERS } from "@/components/VerifiedBadge";
import ReputationThermometer from "@/components/ReputationThermometer";
import ProfileAvatarUpload from "@/components/ProfileAvatarUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, BarChart3, Package, Truck, Banknote, Wallet, Trophy, Ban, Pause, ShieldAlert } from "lucide-react";

import type { AuctionWithImages, WinnerProfile } from "@/components/dealer/types";
import DealerDashboardTab from "@/components/dealer/DealerDashboardTab";
import DealerCreateTab from "@/components/dealer/DealerCreateTab";
import DealerAuctionsTab from "@/components/dealer/DealerAuctionsTab";
import DealerShipmentsTab from "@/components/dealer/DealerShipmentsTab";
import DealerLevelsTab from "@/components/dealer/DealerLevelsTab";
import DealerPaymentTab from "@/components/dealer/DealerPaymentTab";
import DealerWalletTab from "@/components/dealer/DealerWalletTab";

const DealerDashboard = () => {
  const { user, isDealer, isAdmin, loading: authLoading } = useAuth();
  const dealer = useVerifiedDealer(user?.id);
  const { dealerStats } = useUserReviews(user?.id);
  const { sections } = useSiteSettings();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [auctions, setAuctions] = useState<AuctionWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedAuction, setExpandedAuction] = useState<string | null>(null);
  const [winnerProfiles, setWinnerProfiles] = useState<Record<string, WinnerProfile>>({});
  const [dealerAvatarUrl, setDealerAvatarUrl] = useState<string | null>(null);
  const [shippingInfoMap, setShippingInfoMap] = useState<Record<string, any>>({});

  // Tracking state (shared between Auctions and Shipments tabs)
  const [trackingNumber, setTrackingNumber] = useState<Record<string, string>>({});
  const [trackingFile, setTrackingFile] = useState<Record<string, File | null>>({});
  const [trackingCompany, setTrackingCompany] = useState<Record<string, string>>({});
  const [submittingTracking, setSubmittingTracking] = useState<string | null>(null);

  const isGoldPlus = (() => {
    if (!dealer?.isVerified) return false;
    const effectiveSalesCount = dealer.manualTier
      ? (DEALER_TIERS.find(t => t.key === dealer.manualTier)?.minSales || 0)
      : dealer.salesCount;
    const tier = getDealerTier(effectiveSalesCount);
    return ["oro", "platinum", "ruby"].includes(tier.key);
  })();

  const prevTierRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || (!isDealer && !isAdmin))) {
      navigate("/");
    }
  }, [user, isDealer, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchMyAuctions();
    supabase.from("profiles").select("avatar_url").eq("id", user.id).single().then(({ data }) => {
      setDealerAvatarUrl((data as any)?.avatar_url || null);
    });
  }, [user]);

  // Level-up detection
  useEffect(() => {
    if (!dealer?.isVerified) return;
    const currentTier = getDealerTier(dealer.salesCount);
    const storageKey = `dealer_tier_${user?.id}`;
    const savedTier = localStorage.getItem(storageKey);

    if (!savedTier) {
      localStorage.setItem(storageKey, currentTier.key);
      prevTierRef.current = currentTier.key;
      return;
    }

    if (savedTier !== currentTier.key) {
      const savedIndex = DEALER_TIERS.findIndex(t => t.key === savedTier);
      const currentIndex = DEALER_TIERS.findIndex(t => t.key === currentTier.key);
      if (currentIndex < savedIndex) {
        localStorage.setItem(storageKey, currentTier.key);
        prevTierRef.current = currentTier.key;

        const duration = 3000;
        const end = Date.now() + duration;
        const colors = [currentTier.colors.fill, currentTier.colors.accent || "#ffd700", "#ffffff"];
        const frame = () => {
          confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
          confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();

        toast({
          title: `🎉 ¡Felicidades! Subiste a Verificado ${currentTier.label}`,
          description: `Has alcanzado Verificado ${currentTier.label} con ${dealer.salesCount} ventas completadas. ¡Sigue así!`,
        });
      } else {
        localStorage.setItem(storageKey, currentTier.key);
      }
    }
    prevTierRef.current = currentTier.key;
  }, [dealer, user?.id]);

  const fetchMyAuctions = async () => {
    if (!user) return;
    const { data: auctionData } = await supabase
      .from("auctions").select("*").eq("created_by", user.id).order("created_at", { ascending: false });

    if (!auctionData) { setLoading(false); return; }

    const auctionIds = auctionData.map(a => a.id);
    const [imagesRes, bidsRes, shippingRes] = await Promise.all([
      supabase.from("auction_images").select("*").in("auction_id", auctionIds).order("display_order"),
      supabase.from("bids").select("*").in("auction_id", auctionIds).order("amount", { ascending: false }),
      supabase.from("shipping_info").select("*").in("auction_id", auctionIds),
    ]);

    const imagesMap: Record<string, any[]> = {};
    (imagesRes.data || []).forEach(img => {
      if (!imagesMap[img.auction_id]) imagesMap[img.auction_id] = [];
      imagesMap[img.auction_id].push(img);
    });

    const bidsMap: Record<string, any[]> = {};
    (bidsRes.data || []).forEach(bid => {
      if (!bidsMap[bid.auction_id]) bidsMap[bid.auction_id] = [];
      bidsMap[bid.auction_id].push(bid);
    });

    const shipMap: Record<string, any> = {};
    (shippingRes.data || []).forEach((s: any) => { shipMap[s.auction_id] = s; });
    setShippingInfoMap(shipMap);

    const enriched: AuctionWithImages[] = auctionData.map(a => ({
      ...a,
      status: (a as any).status || 'active',
      admin_notes: (a as any).admin_notes || null,
      images: imagesMap[a.id] || [],
      bids: bidsMap[a.id] || [],
    }));

    setAuctions(enriched);

    const winnerIds = auctionData.filter(a => a.winner_id).map(a => a.winner_id!);
    if (winnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles").select("id, full_name, phone").in("id", [...new Set(winnerIds)]);
      if (profiles) {
        const map: Record<string, WinnerProfile> = {};
        profiles.forEach(p => { map[p.id] = { full_name: p.full_name, phone: p.phone }; });
        setWinnerProfiles(map);
      }
    }
    setLoading(false);
  };

  const handleSubmitTracking = async (auctionId: string) => {
    const number = trackingNumber[auctionId]?.trim();
    const file = trackingFile[auctionId];
    const company = trackingCompany[auctionId];
    if (!number || !file || !company || !user) {
      toast({ title: "Completa todos los campos", description: "Empresa de envío, número de guía y foto son obligatorios.", variant: "destructive" });
      return;
    }
    setSubmittingTracking(auctionId);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${auctionId}-tracking.${ext}`;
      const { error: upErr } = await supabase.storage.from("auction-images").upload(filePath, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("auction-images").getPublicUrl(filePath);
      const { error } = await supabase.from("auctions").update({
        tracking_number: number, tracking_photo_url: urlData.publicUrl, delivery_status: "shipped",
      } as any).eq("id", auctionId);
      if (error) throw error;

      await supabase.from("shipping_audit_log").insert([
        { auction_id: auctionId, changed_by: user.id, change_type: "tracking_submitted", field_name: "Número de guía", old_value: null, new_value: number },
        { auction_id: auctionId, changed_by: user.id, change_type: "tracking_submitted", field_name: "Empresa de envío", old_value: null, new_value: company },
      ] as any);

      supabase.functions.invoke("notify-shipment", {
        body: { auction_id: auctionId, tracking_number: number, shipping_company: company },
      }).catch(err => console.error("Error notifying buyer:", err));
      toast({ title: "📦 ¡Guía registrada!", description: "El comprador ha sido notificado." });
      fetchMyAuctions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSubmittingTracking(null);
  };

  if (authLoading || (!isDealer && !isAdmin)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Dealer identity header
  const renderDealerHeader = () => {
    if (!dealer?.isVerified) return null;
    if (dealer.accountStatus === "banned") return (
      <div className="mb-6 bg-destructive/10 border border-destructive/30 rounded-sm p-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <Ban className="h-6 w-6 text-destructive" />
          <div>
            <p className="text-sm font-bold text-destructive">Cuenta Suspendida</p>
            <p className="text-xs text-muted-foreground">Tu cuenta ha sido suspendida por el equipo de administración. Contacta soporte para más información.</p>
          </div>
        </div>
      </div>
    );
    if (dealer.accountStatus === "paused") return (
      <div className="mb-6 bg-warning/10 border border-warning/30 rounded-sm p-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <Pause className="h-6 w-6 text-warning" />
          <div>
            <p className="text-sm font-bold text-warning">Cuenta Pausada Temporalmente</p>
            <p className="text-xs text-muted-foreground">Tu cuenta está pausada temporalmente. Contacta soporte para más información.</p>
          </div>
        </div>
      </div>
    );
    if (dealer.accountStatus === "under_review") return (
      <div className="mb-6 bg-primary/10 border border-primary/30 rounded-sm p-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-bold text-primary">Cuenta en Revisión de Seguridad</p>
            <p className="text-xs text-muted-foreground">Tu cuenta está siendo revisada por nuestro departamento de seguridad. Este proceso puede tomar entre 24-72 horas.</p>
          </div>
        </div>
      </div>
    );

    const effectiveSalesCount = dealer.manualTier
      ? (DEALER_TIERS.find(t => t.key === dealer.manualTier)?.minSales || 0)
      : dealer.salesCount;
    const tier = getDealerTier(effectiveSalesCount);
    const salesCount = dealer.salesCount;
    const tierThresholds = [
      { label: "Bronce", min: 10 }, { label: "Plata", min: 50 }, { label: "Oro", min: 100 },
      { label: "Platinum", min: 500 }, { label: "Ruby Estelar", min: 1000 },
    ];
    const nextTier = tierThresholds.find(t => salesCount < t.min) || null;

    return (
      <div className={`mb-6 bg-card border ${tier.colors.border} rounded-sm p-4 sm:p-5 animate-fade-in overflow-hidden`}>
        {/* Mobile: stacked layout */}
        <div className="flex items-center gap-3 sm:hidden">
          <div className="relative shrink-0">
            <Avatar className="h-14 w-14 border-2 border-border shadow-sm">
              {dealerAvatarUrl && <AvatarImage src={dealerAvatarUrl} alt={dealer.name} className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {(dealer.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1">
              <VerifiedBadge size="sm" salesCount={effectiveSalesCount} showTooltip={false} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-heading font-bold truncate">{dealer.name}</h2>
              <span className={`text-[9px] ${tier.colors.bg} border ${tier.colors.border} ${tier.colors.text} rounded-sm px-1.5 py-0.5 font-semibold whitespace-nowrap shrink-0`}>
                {tier.label}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {salesCount} {salesCount === 1 ? "venta" : "ventas"} completada{salesCount !== 1 ? "s" : ""}
            </p>
            <div className="mt-1">
              <ReputationThermometer
                percentage={dealerStats.totalReviews > 0 ? dealerStats.positivePercentage : 0}
                totalReviews={dealerStats.totalReviews}
                size="sm"
              />
            </div>
            {nextTier && (
              <div className="mt-1.5">
                <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                  <span>→ {nextTier.label}</span>
                  <span>{salesCount}/{nextTier.min}</span>
                </div>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((salesCount / nextTier.min) * 100, 100)}%`, background: tier.colors.fill }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: original layout with full avatar upload */}
        <div className="hidden sm:flex items-start gap-4">
          <div className="relative shrink-0">
            <ProfileAvatarUpload avatarUrl={dealerAvatarUrl} userName={dealer.name} onAvatarChange={(url) => setDealerAvatarUrl(url)} size="md" />
            <div className="absolute -bottom-1 -right-1">
              <VerifiedBadge size="sm" salesCount={effectiveSalesCount} showTooltip={false} />
            </div>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-heading font-bold truncate">{dealer.name}</h2>
              <span className={`text-[11px] ${tier.colors.bg} border ${tier.colors.border} ${tier.colors.text} rounded-sm px-2.5 py-0.5 font-semibold whitespace-nowrap`}>
                Verificado {tier.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-muted-foreground truncate">
                {salesCount} {salesCount === 1 ? "venta" : "ventas"} completada{salesCount !== 1 ? "s" : ""}
              </p>
              <ReputationThermometer
                percentage={dealerStats.totalReviews > 0 ? dealerStats.positivePercentage : 0}
                totalReviews={dealerStats.totalReviews}
                size="sm"
              />
            </div>
            {nextTier && (
              <div className="mt-2.5 max-w-xs">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Progreso a {nextTier.label}</span>
                  <span>{salesCount}/{nextTier.min}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((salesCount / nextTier.min) * 100, 100)}%`, background: tier.colors.fill }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "auctions", label: "Mis Subastas", icon: Package },
    { key: "create", label: "Crear Subasta", icon: Plus },
    { key: "shipments", label: "Envíos", icon: Truck },
    { key: "payment", label: "Cobro", icon: Banknote },
    { key: "wallet", label: "Mi Billetera", icon: Wallet },
    { key: "levels", label: "Niveles", icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {renderDealerHeader()}

        <div className="flex items-center justify-between mb-6 gap-2">
          <h1 className="text-lg sm:text-xl font-heading font-bold truncate">Panel de Dealer</h1>
          <Button onClick={() => setActiveTab("create")} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-sm text-xs font-bold shrink-0">
            <Plus className="h-4 w-4 mr-1" /> <span className="hidden xs:inline">Nuevo</span> Producto
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6 border-b border-border overflow-x-auto scrollbar-none -mx-4 px-4">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ").pop()}</span>
            </button>
          ))}
        </div>

        {activeTab === "dashboard" && (
          <DealerDashboardTab auctions={auctions} setActiveTab={setActiveTab} setStatusFilter={setStatusFilter} sections={sections} />
        )}

        {activeTab === "create" && (
          <DealerCreateTab
            isGoldPlus={isGoldPlus}
            dealerAccountStatus={dealer?.accountStatus || "active"}
            onCreated={fetchMyAuctions}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "auctions" && (
          <DealerAuctionsTab
            auctions={auctions} loading={loading} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            expandedAuction={expandedAuction} setExpandedAuction={setExpandedAuction}
            winnerProfiles={winnerProfiles} shippingInfoMap={shippingInfoMap}
            trackingNumber={trackingNumber} setTrackingNumber={setTrackingNumber}
            trackingFile={trackingFile} setTrackingFile={setTrackingFile}
            trackingCompany={trackingCompany} setTrackingCompany={setTrackingCompany}
            submittingTracking={submittingTracking} handleSubmitTracking={handleSubmitTracking}
            fetchMyAuctions={fetchMyAuctions}
          />
        )}

        {activeTab === "shipments" && (
          <DealerShipmentsTab
            auctions={auctions} winnerProfiles={winnerProfiles} shippingInfoMap={shippingInfoMap}
            trackingNumber={trackingNumber} setTrackingNumber={setTrackingNumber}
            trackingFile={trackingFile} setTrackingFile={setTrackingFile}
            trackingCompany={trackingCompany} setTrackingCompany={setTrackingCompany}
            submittingTracking={submittingTracking} handleSubmitTracking={handleSubmitTracking}
            fetchMyAuctions={fetchMyAuctions}
          />
        )}

        {activeTab === "levels" && <DealerLevelsTab dealer={dealer} />}
        {activeTab === "payment" && <DealerPaymentTab />}
        {activeTab === "wallet" && <DealerWalletTab />}
      </main>
      <Footer />
    </div>
  );
};

export default DealerDashboard;
