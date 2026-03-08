import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import SEOHead from "@/components/SEOHead";
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
import { Loader2, Plus, BarChart3, Package, Truck, Banknote, Wallet, Trophy, Ban, Pause, ShieldAlert, Store, Headphones } from "lucide-react";

import type { AuctionWithImages, WinnerProfile } from "@/components/dealer/types";
import DealerDashboardTab from "@/components/dealer/DealerDashboardTab";
import DealerCreateTab from "@/components/dealer/DealerCreateTab";
import DealerStoreTab from "@/components/dealer/DealerStoreTab";
import DealerStoreCreateTab from "@/components/dealer/DealerStoreCreateTab";
import DealerStoreEditTab from "@/components/dealer/DealerStoreEditTab";
import DealerStoreOrdersTab from "@/components/dealer/DealerStoreOrdersTab";
import DealerAuctionsTab from "@/components/dealer/DealerAuctionsTab";
import DealerShipmentsTab from "@/components/dealer/DealerShipmentsTab";
import DealerLevelsTab from "@/components/dealer/DealerLevelsTab";
import DealerPaymentTab from "@/components/dealer/DealerPaymentTab";
import DealerWalletTab from "@/components/dealer/DealerWalletTab";
import DealerSupportInbox from "@/components/dealer/DealerSupportInbox";

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
  const [showComingSoon, setShowComingSoon] = useState<string | null>(null);

  // Tracking state (shared between Auctions and Shipments tabs)
  const [trackingNumber, setTrackingNumber] = useState<Record<string, string>>({});
  const [trackingFile, setTrackingFile] = useState<Record<string, File | null>>({});
  const [trackingCompany, setTrackingCompany] = useState<Record<string, string>>({});
  const [submittingTracking, setSubmittingTracking] = useState<string | null>(null);

  // Duplicate auction draft state
  const [duplicateData, setDuplicateData] = useState<{ title: string; description: string; startingPrice: string; durationHours: string } | null>(null);

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
        <Loader2 className="h-8 w-8 animate-spin text-primary dark:text-[#A6E300]" />
      </div>
    );
  }


  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "store", label: "Tienda Directa", icon: Store },
    { key: "store-orders", label: "Ventas Tienda", icon: Package },
    { key: "auctions", label: "Mis Subastas", icon: Package },
    { key: "create", label: "Crear Subasta", icon: Plus },
    { key: "shipments", label: "Envíos", icon: Truck },
    { key: "payment", label: "Cobro", icon: Banknote },
    { key: "wallet", label: "Mi Billetera", icon: Wallet },
    { key: "levels", label: "Niveles", icon: Trophy },
    { key: "support", label: "Soporte", icon: Headphones },
  ];

  // ── Compute tier info for header ──────────────────────────────────────────
  const effectiveSalesCount = dealer?.isVerified
    ? (dealer.manualTier ? (DEALER_TIERS.find(t => t.key === dealer.manualTier)?.minSales || 0) : dealer.salesCount)
    : 0;
  const tier = getDealerTier(effectiveSalesCount);
  const salesCount = dealer?.salesCount || 0;
  const tierThresholds = [
    { label: "Bronce", min: 10 }, { label: "Plata", min: 50 }, { label: "Oro", min: 100 },
    { label: "Platinum", min: 500 }, { label: "Ruby Estelar", min: 1000 },
  ];
  const nextTier = tierThresholds.find(t => salesCount < t.min) || null;
  const progressPct = nextTier ? Math.min((salesCount / nextTier.min) * 100, 100) : 100;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Panel de Dealer" description="Gestiona tus subastas, envíos, cobros y más desde tu panel de dealer." />
      <Navbar />
      <BackButton />

      <main className="container mx-auto px-3 sm:px-4 py-4 max-w-6xl pb-24">

        {/* ── STATUS BANNERS ── */}
        {dealer?.accountStatus === "banned" && (
          <div className="mb-4 bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-center gap-3">
            <Ban className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-bold text-destructive">Cuenta Suspendida</p>
              <p className="text-xs text-muted-foreground">Tu cuenta ha sido suspendida. Contacta soporte.</p>
            </div>
          </div>
        )}
        {dealer?.accountStatus === "under_review" && (
          <div className="mb-4 bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-primary dark:text-[#A6E300] shrink-0" />
            <div>
              <p className="text-sm font-bold text-primary dark:text-[#A6E300]">Cuenta en Revisión</p>
              <p className="text-xs text-muted-foreground">Revisión de seguridad activa (24–72 h).</p>
            </div>
          </div>
        )}

        {/* ── HERO HEADER ── */}
        {dealer?.isVerified && (
          <div className="relative mb-5 rounded-2xl overflow-hidden">
            {/* Dark gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: `radial-gradient(ellipse at top left, ${tier.colors.fill}22, transparent 60%)` }} />
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom right, ${tier.colors.fill}18, transparent 50%)` }} />
            {/* Accent top bar */}
            <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${tier.colors.fill}, transparent)` }} />

            <div className="relative z-10 px-4 sm:px-6 py-5 sm:py-6">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="hidden sm:block">
                    <ProfileAvatarUpload avatarUrl={dealerAvatarUrl} userName={dealer.name} onAvatarChange={url => setDealerAvatarUrl(url)} size="md" />
                  </div>
                  <div className="sm:hidden">
                    <Avatar className="h-14 w-14 border-2 shadow-lg" style={{ borderColor: tier.colors.fill }}>
                      {dealerAvatarUrl && <AvatarImage src={dealerAvatarUrl} alt={dealer.name} className="object-cover" />}
                      <AvatarFallback className="text-sm font-bold bg-white/10 text-white">
                        {(dealer.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {/* Tier badge overlay */}
                  <div className="absolute -bottom-1 -right-1 ring-2 ring-[#0d1117] rounded-full">
                    <VerifiedBadge size="sm" salesCount={effectiveSalesCount} showTooltip={false} />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-heading font-black text-white truncate">{dealer.name}</h1>
                    <span
                      className="text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap"
                      style={{ color: tier.colors.fill, borderColor: tier.colors.fill + "55", background: tier.colors.fill + "15" }}
                    >
                      ✓ {tier.label}
                    </span>
                  </div>

                  {/* Stat pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-1 text-[11px] font-semibold text-white/80">
                      <Trophy className="h-3 w-3 text-amber-500" />
                      {salesCount} venta{salesCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-1 text-[11px] font-semibold text-white/80">
                      <span className="w-2 h-2 rounded-full" style={{ background: dealerStats.totalReviews > 0 ? (dealerStats.positivePercentage >= 80 ? "#22c55e" : dealerStats.positivePercentage >= 50 ? "#eab308" : "#ef4444") : "#6b7280" }} />
                      {dealerStats.totalReviews > 0 ? `${dealerStats.positivePercentage}% positivo` : "Sin reseñas"}
                    </span>
                    <span className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-1 text-[11px] font-semibold text-white/80">
                      <BarChart3 className="h-3 w-3" style={{ color: tier.colors.fill }} />
                      {dealerStats.totalReviews} reseña{dealerStats.totalReviews !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Progress to next tier */}
                  {nextTier && (
                    <div className="mt-3 max-w-sm">
                      <div className="flex justify-between text-[10px] text-white/40 mb-1">
                        <span>Próximo nivel: <strong className="text-white/70">{nextTier.label}</strong></span>
                        <span>{salesCount} / {nextTier.min}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 shadow-sm"
                          style={{ width: `${progressPct}%`, background: tier.colors.fill }}
                        />
                      </div>
                    </div>
                  )}
                  {!nextTier && (
                    <p className="mt-2 text-[11px] font-semibold" style={{ color: tier.colors.fill }}>
                      🏆 ¡Nivel máximo alcanzado!
                    </p>
                  )}
                </div>

                {/* CTA */}
                <Button
                  onClick={() => setActiveTab("create")}
                  className="shrink-0 hidden sm:flex rounded-xl gap-1.5 font-bold text-xs bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20"
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Nueva Subasta
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── MOBILE CTA ── */}
        <div className="flex sm:hidden items-center justify-between mb-4">
          <p className="text-sm font-heading font-bold text-foreground">Panel de Dealer</p>
          <Button
            onClick={() => setActiveTab("create")}
            size="sm"
            className="rounded-xl gap-1 font-bold text-xs bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva Subasta
          </Button>
        </div>

        {/* ── TAB NAVIGATION ── */}
        <div className="mb-5">
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map(tab => {
              const isRestricted = !isAdmin && ["store", "store-orders"].includes(tab.key);
              const isActive = activeTab === tab.key;

              return (
                <div key={tab.key} className="relative shrink-0">
                  {showComingSoon === tab.key && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 animate-fade-in">
                      <div className="bg-foreground text-background text-[10px] font-black px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl flex items-center gap-1">
                        🚀 Próximamente
                      </div>
                      <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (isRestricted) {
                        setShowComingSoon(tab.key);
                        setTimeout(() => setShowComingSoon(null), 2500);
                      } else {
                        setActiveTab(tab.key);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 border ${isRestricted
                      ? "opacity-40 cursor-not-allowed bg-secondary/20 text-muted-foreground border-transparent"
                      : isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 border-primary/50"
                        : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground border-border/50 hover:border-primary/20"
                      }`}
                  >
                    <tab.icon className={`h-3.5 w-3.5 ${isActive ? '' : 'opacity-70'}`} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ").pop()}</span>
                    {isRestricted && (
                      <span className="hidden sm:inline text-[9px] font-black bg-muted-foreground/20 text-muted-foreground rounded-full px-1.5 py-0.5 ml-0.5">
                        Próx.
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="rounded-2xl">
          {activeTab === "dashboard" && (
            <DealerDashboardTab auctions={auctions} setActiveTab={setActiveTab} setStatusFilter={setStatusFilter} sections={sections} />
          )}
          {activeTab === "store" && user?.id && (
            <DealerStoreTab dealerId={user.id} setActiveTab={setActiveTab} />
          )}
          {activeTab === "store-create" && user?.id && (
            <DealerStoreCreateTab dealerId={user.id} setActiveTab={setActiveTab} onCreated={fetchMyAuctions} />
          )}
          {activeTab.startsWith("store-edit-") && user?.id && (
            <DealerStoreEditTab
              dealerId={user.id}
              productId={activeTab.replace("store-edit-", "")}
              setActiveTab={setActiveTab}
              onUpdated={fetchMyAuctions}
            />
          )}
          {activeTab === "store-orders" && user?.id && (
            <DealerStoreOrdersTab dealerId={user.id} />
          )}
          {activeTab === "create" && (
            <DealerCreateTab
              isGoldPlus={isGoldPlus}
              dealerAccountStatus={dealer?.accountStatus || "active"}
              onCreated={fetchMyAuctions}
              setActiveTab={setActiveTab}
              initialData={duplicateData || undefined}
              onInitialDataConsumed={() => setDuplicateData(null)}
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
              onDuplicate={(data) => { setDuplicateData(data); setActiveTab("create"); }}
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
          {activeTab === "support" && <DealerSupportInbox />}
        </div>
      </main>
      <div className="hidden sm:block"><Footer /></div>
      <div className="sm:hidden h-14" />
      <BottomNav />
    </div>
  );
};

export default DealerDashboard;
