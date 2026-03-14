import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import { useVerifiedDealer } from "@/hooks/useVerifiedDealers";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useUserReviews } from "@/hooks/useReviews";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import VerifiedBadge, { getDealerTier, DEALER_TIERS } from "@/components/VerifiedBadge";
import ProfileAvatarUpload from "@/components/ProfileAvatarUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, BarChart3, Package, Truck, Banknote, Wallet, Trophy, Ban, ShieldAlert, Store, Headphones, UserCircle, Star, Globe, ChevronLeft, Menu, MessageSquare } from "lucide-react";

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
import DealerReviewsTab from "@/components/dealer/DealerReviewsTab";
import DealerQuestionsTab from "@/components/dealer/DealerQuestionsTab";
import DealerProfileTab from "@/components/dealer/DealerProfileTab";
import DealerOffersTab from "@/components/dealer/DealerOffersTab";

const DealerDashboard = () => {
  const { user, isDealer, isAdmin, loading: authLoading } = useAuth();
  const dealer = useVerifiedDealer(user?.id);
  const { dealerStats, buyerStats, unifiedStats } = useUserReviews(user?.id);
  const { sections } = useSiteSettings();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [auctions, setAuctions] = useState<AuctionWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = useCallback((tab: string) => {
    setSearchParams({ tab }, { replace: false });
  }, [setSearchParams]);
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
      images: (imagesMap[a.id] || []).sort((x: any, y: any) => x.display_order - y.display_order),
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
    if (!company || !user) {
      toast({ title: "Selecciona un método de envío", variant: "destructive" });
      return;
    }
    const isPersonalOrDelivery = ["Entrega Personal", "Delivery"].includes(company);
    if (!isPersonalOrDelivery && (!number || !file)) {
      toast({ title: "Completa todos los campos", description: "Número de guía y foto son obligatorios para envíos por encomienda.", variant: "destructive" });
      return;
    }
    setSubmittingTracking(auctionId);
    try {
      const trackingLabel = isPersonalOrDelivery ? company : number!;
      let trackingPhotoUrl: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/${auctionId}-tracking.${ext}`;
        const { error: upErr } = await supabase.storage.from("auction-images").upload(filePath, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("auction-images").getPublicUrl(filePath);
        trackingPhotoUrl = urlData.publicUrl;
      }

      const updateData: any = { tracking_number: trackingLabel, delivery_status: "shipped" };
      if (trackingPhotoUrl) updateData.tracking_photo_url = trackingPhotoUrl;

      const { error } = await supabase.from("auctions").update(updateData).eq("id", auctionId);
      if (error) throw error;

      await supabase.from("shipping_audit_log").insert([
        { auction_id: auctionId, changed_by: user.id, change_type: "tracking_submitted", field_name: "Método de envío", old_value: null, new_value: company },
        ...(isPersonalOrDelivery ? [] : [{ auction_id: auctionId, changed_by: user.id, change_type: "tracking_submitted", field_name: "Número de guía", old_value: null, new_value: trackingLabel }]),
      ] as any);

      supabase.functions.invoke("notify-shipment", {
        body: { auction_id: auctionId, tracking_number: trackingLabel, shipping_company: company },
      }).catch(err => console.error("Error notifying buyer:", err));
      toast({ title: isPersonalOrDelivery ? "✅ ¡Envío confirmado!" : "📦 ¡Guía registrada!", description: "El comprador ha sido notificado." });
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

  const sidebarGroups = [
    {
      label: "Principal",
      items: [
        { key: "dashboard", label: "Dashboard", icon: BarChart3 },
        { key: "create", label: "Crear Subasta", icon: Plus },
        ...(isAdmin ? [{ key: "store", label: "Marketplace", icon: Store }] : []),
      ],
    },
    {
      label: "Operaciones",
      items: [
        { key: "auctions", label: "Mis Ventas", icon: Package },
        { key: "shipments", label: "Envíos", icon: Truck },
        { key: "wallet", label: "Mi Billetera", icon: Wallet },
        { key: "questions", label: "Preguntas", icon: MessageSquare },
        ...(isAdmin ? [{ key: "offers", label: "Ofertas", icon: MessageSquare }] : []),
      ],
    },
    {
      label: "Reputación",
      items: [
        { key: "reviews", label: "Reseñas", icon: Star },
        { key: "levels", label: "Niveles", icon: Trophy },
      ],
    },
    {
      label: "Cuenta",
      items: [
        { key: "profile", label: "Mi Perfil", icon: UserCircle },
        { key: "support", label: "Soporte", icon: Headphones },
      ],
    },
  ];

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Pending action counts for sidebar badges — MUST match DealerShipmentsTab logic exactly
  const pendingCounts = useMemo(() => {
    const shippable = auctions.filter(a => {
      const isEnded = new Date(a.end_time).getTime() <= Date.now();
      return (a.status === "finalized" || (a.status === "active" && isEnded)) && a.winner_id;
    });
    const shipments = shippable.filter(a => a.delivery_status === "ready_to_ship" && !a.tracking_number).length;
    const payments = shippable.filter(a => ["pending", "under_review"].includes(a.payment_status || "")).length;
    const inReview = auctions.filter(a => a.status === "pending" || a.status === "in_review").length;
    return { shipments, payment: payments, auctions: inReview } as Record<string, number>;
  }, [auctions]);

  const handleSidebarNav = (key: string) => {
    setActiveTab(key);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <SEOHead title="Panel de Dealer" description="Gestiona tus subastas, envíos, cobros y más desde tu panel de dealer." />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`${sidebarOpen ? "w-60 fixed lg:relative z-40" : "w-0 lg:w-16"} bg-nav-solid text-white shrink-0 transition-all duration-300 flex flex-col h-screen lg:sticky top-0 overflow-hidden`}>
        {/* Logo / Brand */}
        <div className="flex flex-col border-b border-white/10 shrink-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 h-14 sm:h-16 px-4 hover:bg-white/5 transition-colors text-left"
          >
            {sidebarOpen ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center"><Store className="h-4 w-4 text-accent-foreground" /></div>
                <div><span className="font-heading font-bold text-sm block leading-tight text-white">Dealer</span><span className="text-[10px] text-white/40 leading-tight">Panel de Ventas</span></div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center mx-auto"><Store className="h-4 w-4 text-accent-foreground" /></div>
            )}
          </button>

          <div className="px-2 pb-2 space-y-1">
            <button onClick={() => navigate("/")} className="flex items-center gap-2.5 text-xs text-white/40 hover:text-white w-full px-3 py-2 rounded-md hover:bg-white/5 transition-colors">
              <Globe className="h-3.5 w-3.5" />{sidebarOpen && <span>Ver sitio</span>}
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden lg:flex items-center gap-2.5 text-xs text-white/30 hover:text-white w-full px-3 py-2 rounded-md hover:bg-white/5 transition-colors">
              {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}{sidebarOpen && <span>Colapsar</span>}
            </button>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {sidebarGroups.map((group, gi) => {
            return (
              <div key={group.label} className={gi > 0 ? "mt-1" : ""}>
                {sidebarOpen && (
                  <p className="text-[9px] uppercase tracking-widest text-white/25 font-semibold px-3 pt-3 pb-1.5">{group.label}</p>
                )}
                {!sidebarOpen && gi > 0 && (
                  <div className="mx-3 my-2 border-t border-white/10" />
                )}
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const isActive = activeTab === item.key;
                    const isRestricted = false; // Marketplace now available to all dealers
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          if (isRestricted) {
                            setShowComingSoon(item.key);
                            setTimeout(() => setShowComingSoon(null), 2500);
                          } else {
                            handleSidebarNav(item.key);
                          }
                        }}
                        title={!sidebarOpen ? item.label : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all relative ${isRestricted
                          ? "opacity-30 cursor-not-allowed text-white/40"
                          : isActive
                            ? "bg-accent/90 text-accent-foreground font-semibold shadow-sm"
                            : "text-white/55 hover:text-white hover:bg-white/8"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {sidebarOpen && <span>{item.label}</span>}
                        {isRestricted && sidebarOpen && (
                          <span className="ml-auto text-[8px] font-black bg-white/10 text-white/40 rounded-full px-1.5 py-0.5">Próx.</span>
                        )}
                        {!isRestricted && sidebarOpen && (pendingCounts[item.key] || 0) > 0 && (
                          <span className={`ml-auto inline-flex items-center justify-center font-bold tracking-tight min-w-[22px] h-5 px-1.5 text-[10px] rounded-md bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)] ring-1 ring-red-400/30`}>
                            {pendingCounts[item.key]}
                          </span>
                        )}
                        {!sidebarOpen && (pendingCounts[item.key] || 0) > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 text-[8px] rounded-md bg-red-500 text-white shadow-[0_0_6px_rgba(239,68,68,0.6)] inline-flex items-center justify-center font-bold">
                            {pendingCounts[item.key]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom info / verified badge */}
        <div className="p-3 border-t border-white/10 shrink-0">
          {dealer?.isVerified && sidebarOpen && (
            <div className="flex items-center gap-2 px-1 py-1">
              <VerifiedBadge size="sm" salesCount={effectiveSalesCount} showTooltip={false} />
              <span className="text-[10px] font-semibold text-white/50 truncate">{tier.label}</span>
            </div>
          )}
          {!sidebarOpen && dealer?.isVerified && (
            <div className="flex justify-center">
              <VerifiedBadge size="sm" salesCount={effectiveSalesCount} showTooltip={false} />
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Sticky header */}
        <header className="sticky top-0 z-20 bg-card border-b border-border h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="font-heading font-bold text-sm sm:text-base text-foreground truncate">
              {sidebarGroups.flatMap(g => g.items).find(s => s.key === activeTab)?.label || "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Button
              onClick={() => setActiveTab("create")}
              size="sm"
              className="rounded-xl gap-1 font-bold text-xs bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nueva Subasta</span>
            </Button>
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border">
              <Avatar className="h-8 w-8 border border-border">
                {dealerAvatarUrl && <AvatarImage src={dealerAvatarUrl} alt={dealer?.name || ""} className="object-cover" />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {(dealer?.name || "D").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-xs font-medium text-foreground leading-tight truncate max-w-[120px]">{dealer?.name || "Dealer"}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Dealer</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">

            {/* Status banners */}
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

            {/* Hero header — only on dashboard */}
            {activeTab === "dashboard" && dealer?.isVerified && (
              <div className="relative mb-5 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: `radial-gradient(ellipse at top left, ${tier.colors.fill}22, transparent 60%)` }} />
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(ellipse at bottom right, ${tier.colors.fill}18, transparent 50%)` }} />
                <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${tier.colors.fill}, transparent)` }} />
                <div className="relative z-10 px-4 sm:px-6 py-5 sm:py-6">
                  <div className="flex items-start gap-4">
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
                      <div className="absolute -bottom-1 -right-1 ring-2 ring-[#0d1117] rounded-full">
                        <VerifiedBadge size="sm" salesCount={effectiveSalesCount} showTooltip={false} />
                      </div>
                    </div>
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
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-1 text-[11px] font-semibold text-white/80">
                          <Trophy className="h-3 w-3 text-amber-500" />
                          {salesCount} venta{salesCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-1 text-[11px] font-semibold text-white/80">
                          <span className="w-2 h-2 rounded-full" style={{ background: unifiedStats.totalReviews > 0 ? (unifiedStats.positivePercentage >= 80 ? "#22c55e" : unifiedStats.positivePercentage >= 50 ? "#eab308" : "#ef4444") : "#6b7280" }} />
                          {unifiedStats.totalReviews > 0 ? `${Math.round(unifiedStats.positivePercentage)}% reputación` : "Sin reseñas"}
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-1 text-[11px] font-semibold text-white/80">
                          <BarChart3 className="h-3 w-3" style={{ color: tier.colors.fill }} />
                          {unifiedStats.totalReviews} calificación{unifiedStats.totalReviews !== 1 ? "es" : ""}
                        </span>
                      </div>
                      {nextTier && (
                        <div className="mt-3 max-w-sm">
                          <div className="flex justify-between text-[10px] text-white/40 mb-1">
                            <span>Próximo nivel: <strong className="text-white/70">{nextTier.label}</strong></span>
                            <span>{salesCount} / {nextTier.min}</span>
                          </div>
                          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700 shadow-sm" style={{ width: `${progressPct}%`, background: tier.colors.fill }} />
                          </div>
                        </div>
                      )}
                      {!nextTier && (
                        <p className="mt-2 text-[11px] font-semibold" style={{ color: tier.colors.fill }}>
                          🏆 ¡Nivel máximo alcanzado!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content */}
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
                dealerId={user?.id}
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
            {activeTab === "reviews" && <DealerReviewsTab />}
            {activeTab === "questions" && user?.id && <DealerQuestionsTab dealerId={user.id} />}
            {activeTab === "offers" && user?.id && <DealerOffersTab dealerId={user.id} />}
            {activeTab === "levels" && <DealerLevelsTab dealer={dealer} />}
            {activeTab === "payment" && <DealerPaymentTab />}
            {activeTab === "wallet" && <DealerWalletTab auctions={auctions} />}
            {activeTab === "support" && <DealerSupportInbox />}
            {activeTab === "profile" && <DealerProfileTab />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DealerDashboard;
