import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";

const DescriptionToggle = ({ text, maxLength = 120 }: { text: string; maxLength?: number }) => {
  const [expanded, setExpanded] = useState(false);
  const needsTruncate = text.length > maxLength;

  if (!needsTruncate) return <span>{text}</span>;

  return (
    <span>
      {expanded ? text : `${text.slice(0, maxLength).trimEnd()}…`}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-foreground dark:text-white font-medium hover:underline text-xs"
      >
        {expanded ? "Ver menos" : "Ver más"}
      </button>
    </span>
  );
};
import { useParams, useNavigate } from "react-router-dom";
import { useDisputes } from "@/hooks/useDisputes";
import DisputeForm from "@/components/DisputeForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVerifiedDealer } from "@/hooks/useVerifiedDealers";
import { useAuctionReviews, useUserReviews } from "@/hooks/useReviews";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import Countdown from "@/components/Countdown";
import VerifiedBadge, { getDealerTier } from "@/components/VerifiedBadge";
import BuyerBadge from "@/components/BuyerBadge";
import AdminBadge from "@/components/AdminBadge";
import ReputationThermometer from "@/components/ReputationThermometer";
import ReviewForm from "@/components/ReviewForm";
import ReviewCard from "@/components/ReviewCard";
import PaymentFlow from "@/components/PaymentFlow";
import ShippingForm from "@/components/ShippingForm";
import AuctionProgressTracker from "@/components/AuctionProgressTracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Trophy, TrendingUp, ChevronLeft, ChevronRight, User, Star, MessageSquare, AlertTriangle, Clock, Zap, X } from "lucide-react";
import ReportAuctionButton from "@/components/ReportAuctionButton";
import WinnerCelebration from "@/components/WinnerCelebration";
import SEO from "@/components/SEO";
import type { Tables } from "@/integrations/supabase/types";
import { maskName } from "@/lib/utils";
import confetti from "canvas-confetti";


const fireConfetti = () => {
  const count = 200;
  const defaults = { origin: { y: 0.7 }, zIndex: 9999 };
  const fire = (ratio: number, opts: confetti.Options) =>
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * ratio) });
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};

const AuctionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [auction, setAuction] = useState<Tables<"auctions"> | null>(null);
  const [bids, setBids] = useState<Tables<"bids">[]>([]);
  const [images, setImages] = useState<{ id: string; image_url: string; display_order: number }[]>([]);
  const [currentImage, setCurrentImage] = useState(0);
  const [bidAmount, setBidAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [shippingComplete, setShippingComplete] = useState(false);
  const [bidderWins, setBidderWins] = useState<Record<string, number>>({});
  const [bidderIsAdmin, setBidderIsAdmin] = useState<Record<string, boolean>>({});
  const [bidderManualTier, setBidderManualTier] = useState<Record<string, string | null>>({});
  const { createDispute, disputes } = useDisputes();

  const [autoBidMax, setAutoBidMax] = useState("");
  const [autoBidActive, setAutoBidActive] = useState<{ id: string; max_amount: number } | null>(null);
  const [savingAutoBid, setSavingAutoBid] = useState(false);

  const dealerUserId = auction?.created_by;
  const dealer = useVerifiedDealer(dealerUserId);
  const { reviews: auctionReviews } = useAuctionReviews(id);
  const { dealerStats } = useUserReviews(dealerUserId);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const [auctionRes, bidsRes, imagesRes] = await Promise.all([
        supabase.from("auctions").select("*").eq("id", id).single(),
        supabase.from("bids").select("*").eq("auction_id", id).order("amount", { ascending: false }),
        supabase.from("auction_images").select("*").eq("auction_id", id).order("display_order"),
      ]);
      setAuction(auctionRes.data);
      setBids(bidsRes.data || []);
      setImages(imagesRes.data || []);

      const bidderIds = [...new Set((bidsRes.data || []).map(b => b.user_id))];
      if (bidderIds.length > 0) {
        const winCounts: Record<string, number> = {};
        const adminMap: Record<string, boolean> = {};
        await Promise.all(bidderIds.map(async (uid) => {
          const { count } = await supabase
            .from("auctions")
            .select("id", { count: "exact", head: true })
            .eq("winner_id", uid)
            .eq("status", "finalized");
          winCounts[uid] = count || 0;
        }));
        const [{ data: adminRoles }, { data: profilesData }] = await Promise.all([
          supabase.from("user_roles").select("user_id").in("user_id", bidderIds).eq("role", "admin"),
          supabase.from("profiles").select("id, manual_buyer_tier").in("id", bidderIds),
        ]);
        (adminRoles || []).forEach(r => { adminMap[r.user_id] = true; });
        const tierMap: Record<string, string | null> = {};
        (profilesData || []).forEach((p: any) => { tierMap[p.id] = p.manual_buyer_tier; });
        setBidderWins(winCounts);
        setBidderIsAdmin(adminMap);
        setBidderManualTier(tierMap);
      }

      if (user) {
        const { data: autoBidData } = await supabase
          .from("auto_bids" as any)
          .select("id, max_amount")
          .eq("auction_id", id)
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (autoBidData) {
          setAutoBidActive({ id: (autoBidData as any).id, max_amount: (autoBidData as any).max_amount });
        }
      }

      setLoading(false);
    };

    fetchData();

    const bidsChannel = supabase
      .channel(`bids-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${id}` },
        (payload) => setBids((prev) => [payload.new as Tables<"bids">, ...prev])
      )
      .subscribe();

    const auctionChannel = supabase
      .channel(`auction-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${id}` },
        (payload) => setAuction(payload.new as Tables<"auctions">)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(auctionChannel);
    };
  }, [id]);

  const handleSetAutoBid = async () => {
    if (!user || !auction) return;
    const maxAmt = parseFloat(autoBidMax);
    const currentP = auction.current_price > 0 ? auction.current_price : auction.starting_price;
    if (isNaN(maxAmt) || maxAmt <= currentP + 1) {
      toast({ title: "Monto inválido", description: `Tu monto máximo debe ser mayor a $${(currentP + 1).toLocaleString("es-MX")}`, variant: "destructive" });
      return;
    }
    setSavingAutoBid(true);
    if (autoBidActive) {
      const { error } = await supabase.from("auto_bids" as any).update({ max_amount: maxAmt } as any).eq("id", autoBidActive.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setAutoBidActive({ ...autoBidActive, max_amount: maxAmt });
        toast({ title: "✅ Auto-puja actualizada", description: `Monto máximo: $${maxAmt.toLocaleString("es-MX")}` });
        setAutoBidMax("");
      }
    } else {
      const { data, error } = await supabase.from("auto_bids" as any).insert({
        auction_id: auction.id,
        user_id: user.id,
        max_amount: maxAmt,
      } as any).select().single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setAutoBidActive({ id: (data as any).id, max_amount: maxAmt });
        toast({ title: "⚡ Auto-puja activada", description: `El sistema pujará automáticamente hasta $${maxAmt.toLocaleString("es-MX")}` });
        setAutoBidMax("");
      }
    }
    setSavingAutoBid(false);
  };

  const handleCancelAutoBid = async () => {
    if (!autoBidActive) return;
    setSavingAutoBid(true);
    const { error } = await supabase.from("auto_bids" as any).update({ is_active: false } as any).eq("id", autoBidActive.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAutoBidActive(null);
      setAutoBidMax("");
      toast({ title: "Auto-puja cancelada" });
    }
    setSavingAutoBid(false);
  };

  const handleBid = async () => {
    if (!user || !profile || !auction || auction.status === "scheduled") return;
    const amount = parseFloat(bidAmount);
    const currentPrice = auction.current_price > 0 ? auction.current_price : auction.starting_price;

    const startTime = (auction as any).start_time;
    if (startTime && new Date(startTime).getTime() > Date.now()) {
      toast({ title: "Subasta no ha iniciado", description: "Esta subasta aún no está abierta para pujas.", variant: "destructive" });
      return;
    }

    if (isNaN(amount) || amount <= currentPrice) {
      toast({ title: "Puja inválida", description: `Debe ser mayor a $${currentPrice.toLocaleString("es-MX")}`, variant: "destructive" });
      return;
    }
    if (new Date(auction.end_time).getTime() <= Date.now()) {
      toast({ title: "Subasta finalizada", variant: "destructive" });
      return;
    }

    setBidding(true);
    const previousLeaderId = auction.winner_id;

    const { error } = await supabase.from("bids").insert({
      auction_id: auction.id,
      user_id: user.id,
      bidder_name: profile.full_name,
      amount,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fireConfetti();
      toast({ title: "¡Puja exitosa!", description: `Pujaste $${amount.toLocaleString("es-MX")}` });
      setBidAmount("");

      if (previousLeaderId && previousLeaderId !== user.id) {
        supabase.functions.invoke("send-push-notification", {
          body: {
            type: "outbid",
            targetUserId: previousLeaderId,
            auctionId: auction.id,
            auctionTitle: auction.title,
          },
        }).catch(() => { });
      }
    }
    setBidding(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-heading font-bold">Subasta no encontrada</h1>
        </div>
      </div>
    );
  }

  const isScheduled = auction.status === "scheduled";
  const isEnded = !isScheduled && new Date(auction.end_time).getTime() <= Date.now();
  const currentPrice = auction.current_price > 0 ? auction.current_price : auction.starting_price;

  const canReviewDealer = isEnded && user && auction.winner_id === user.id && !auctionReviews.some(r => r.reviewer_id === user.id && r.review_type === "buyer_to_dealer");
  const canReviewBuyer = isEnded && user && auction.created_by === user.id && auction.winner_id && !auctionReviews.some(r => r.reviewer_id === user.id && r.review_type === "dealer_to_buyer");

  const allImages = images.length > 0
    ? images.map(i => i.image_url)
    : auction.image_url ? [auction.image_url] : [];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={auction.title}
        description={`Participa en la subasta de ${auction.title} en Subastandolo.com. Precio inicial: $${auction.starting_price.toLocaleString("es-MX")}. ¡Oferta ahora!`}
        image={allImages[0]}
        url={`https://www.subastandolo.com/auction/${id}`}
        type="product"
        schemaData={{
          "@context": "https://schema.org/",
          "@type": "Product",
          "name": auction.title,
          "image": allImages,
          "description": auction.description,
          "offers": {
            "@type": "Offer",
            "url": `https://www.subastandolo.com/auction/${id}`,
            "priceCurrency": "USD",
            "price": currentPrice,
            "availability": isEnded ? "https://schema.org/OutOfStock" : "https://schema.org/InStock"
          }
        }}
      />
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
          <button onClick={() => navigate("/")} className="hover:text-primary dark:hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Inicio
          </button>
          <span className="text-border">/</span>
          <span className="text-foreground truncate font-medium">{auction.title}</span>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Image gallery */}
          <div className="space-y-3">
            <div className="aspect-square bg-card border border-border rounded-xl overflow-hidden relative shadow-sm">
              {allImages.length > 0 ? (
                <>
                  <img src={allImages[currentImage]} alt={auction.title} className="w-full h-full object-contain p-4" />
                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentImage(prev => (prev - 1 + allImages.length) % allImages.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 hover:bg-card border border-border/50 text-foreground flex items-center justify-center shadow-md transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCurrentImage(prev => (prev + 1) % allImages.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 hover:bg-card border border-border/50 text-foreground flex items-center justify-center shadow-md transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-foreground/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                        {currentImage + 1} / {allImages.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sin imagen</div>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === currentImage ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Lot info */}
          <div className="space-y-5">
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-2xl font-heading font-bold leading-tight">{auction.title}</h1>
              {(auction as any).operation_number && (
                <span className="text-[10px] font-mono bg-secondary text-muted-foreground px-2.5 py-1 rounded-lg border border-border mt-1">
                  {(auction as any).operation_number}
                </span>
              )}
            </div>

            {/* Dealer info */}
            {dealer && (
              <div className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                  <Link to={`/dealer/${dealerUserId}`} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity">
                    <div className="w-12 h-12 rounded-full border border-border bg-secondary flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      {dealer.avatarUrl ? (
                        <img src={dealer.avatarUrl} alt={dealer.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-bold text-foreground text-sm sm:text-base">
                        <span className="truncate hover:underline hover:text-primary dark:hover:text-white transition-colors">{dealer.name}</span>
                        {dealer.isVerified && <VerifiedBadge size="sm" salesCount={dealer.salesCount} />}
                      </div>

                      {(() => {
                        const tier = getDealerTier(dealer?.salesCount || 0);
                        return (
                          <span className={`text-xs font-semibold ${tier.colors.text} mt-0.5`}>
                            {tier.label}
                          </span>
                        );
                      })()}
                    </div>
                  </Link>

                  <div className="flex flex-col items-start sm:items-end justify-center shrink-0 pl-[52px] sm:pl-0 sm:border-l sm:border-border sm:pl-4">
                    <ReputationThermometer percentage={dealerStats.positivePercentage} totalReviews={dealerStats.totalReviews} size="sm" />
                    <span className="text-[10px] text-muted-foreground mt-1 font-medium">{dealer?.salesCount || 0} {dealer?.salesCount === 1 ? 'venta' : 'ventas'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Price highlight */}
            {!isScheduled && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">
                  {auction.current_price > 0 ? "Puja actual" : "Precio inicial"}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-foreground">US$</span>
                  <span className="text-4xl font-black text-foreground tracking-tight">
                    {Math.floor(currentPrice).toLocaleString("es-MX")}
                  </span>
                  <span className="text-sm text-foreground">
                    {(currentPrice % 1).toFixed(2).substring(1)}
                  </span>
                </div>
                {!isEnded && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Termina en</span>
                    <Countdown endTime={auction.end_time} />
                  </div>
                )}
                {isEnded && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-destructive/10 dark:bg-white/10 text-destructive dark:text-white text-xs font-semibold px-3 py-1 rounded-lg">
                    Finalizada
                  </div>
                )}
              </div>
            )}

            {/* Info table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium w-1/3">Estado</td>
                    <td className="px-4 py-3 font-medium">
                      {isScheduled ? (
                        <span className="text-foreground dark:text-gray-200 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> Próximamente
                        </span>
                      ) : isEnded ? (
                        <span className="text-destructive dark:text-white font-semibold">Finalizada</span>
                      ) : (
                        <span className="text-foreground dark:text-gray-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> En vivo
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Precio inicial</td>
                    <td className="px-4 py-3 font-semibold">${auction.starting_price.toLocaleString("es-MX")}</td>
                  </tr>
                  {!isScheduled && (
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Puja actual</td>
                      <td className="px-4 py-3 font-bold text-foreground text-lg">${currentPrice.toLocaleString("es-MX")}</td>
                    </tr>
                  )}
                  {!isScheduled && (
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Tiempo restante</td>
                      <td className="px-4 py-3"><Countdown endTime={auction.end_time} /></td>
                    </tr>
                  )}
                  {!isScheduled && (
                    <tr className="border-b border-border">
                      <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Total de pujas</td>
                      <td className="px-4 py-3 font-semibold">{bids.length}</td>
                    </tr>
                  )}
                  <tr className="border-b border-border">
                    <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium">Fotos</td>
                    <td className="px-4 py-3 font-semibold">{allImages.length}</td>
                  </tr>
                  {auction.description && (
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground bg-muted/50 font-medium align-top">Descripción</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                        <DescriptionToggle text={auction.description} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Report button */}
            <div className="flex justify-end">
              <ReportAuctionButton auctionId={auction.id} />
            </div>

            {/* Winner Celebration */}
            {isEnded && user && auction.winner_id === user.id && (
              <WinnerCelebration
                auction={auction}
                userId={user.id}
                productImages={allImages}
              />
            )}

            {/* Winner label for non-winners */}
            {isEnded && auction.winner_name && (!user || auction.winner_id !== user.id) && (
              <div className="flex items-center gap-2.5 text-sm text-foreground dark:text-gray-200 bg-secondary/80 dark:bg-white/10 border border-border rounded-xl px-4 py-3.5">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-bold">Ganador: {maskName(auction.winner_name)}</span>
              </div>
            )}

            {/* Dispute */}
            {isEnded && user && auction.winner_id === user.id && !disputes.some(d => d.auction_id === auction.id) && (
              <div>
                {showDisputeForm ? (
                  <div className="bg-card border border-destructive/20 rounded-xl p-4">
                    <DisputeForm
                      onSubmit={async (category, description, files) => {
                        await createDispute(auction.id, auction.created_by, category, description, files);
                        setShowDisputeForm(false);
                      }}
                      onCancel={() => setShowDisputeForm(false)}
                    />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 rounded-xl"
                    onClick={() => setShowDisputeForm(true)}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Tengo un problema con este producto
                  </Button>
                )}
              </div>
            )}

            {isEnded && user && disputes.some(d => d.auction_id === auction.id) && (
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => navigate("/disputes")}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Ver mi disputa abierta
              </Button>
            )}

            {/* Scheduled notice */}
            {isScheduled && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2 text-center">
                <h3 className="font-heading font-bold text-sm flex items-center justify-center gap-1.5 text-primary dark:text-gray-200">
                  <Clock className="h-4 w-4" />
                  Próximamente
                </h3>
                <p className="text-xs text-muted-foreground">
                  Esta subasta estará disponible pronto. ¡Agrégala a favoritos para ser notificado cuando inicie!
                </p>
              </div>
            )}

            {!isScheduled && !isEnded && auction && (auction as any).start_time && new Date((auction as any).start_time).getTime() > Date.now() && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2 text-center">
                <h3 className="font-heading font-bold text-sm flex items-center justify-center gap-1.5 text-primary dark:text-gray-200">
                  <Clock className="h-4 w-4" />
                  Subasta programada
                </h3>
                <p className="text-xs text-muted-foreground">
                  Las pujas se abrirán el <strong className="text-foreground">{new Date((auction as any).start_time).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong> a las 9:00 AM
                </p>
                <div className="flex justify-center">
                  <Countdown endTime={(auction as any).start_time} />
                </div>
              </div>
            )}

            {/* User bid stats */}
            {user && bids.length > 0 && (() => {
              const myBids = bids.filter(b => b.user_id === user.id);
              if (myBids.length === 0) return null;
              const highestBid = Math.max(...myBids.map(b => b.amount));
              const isLeading = bids[0]?.user_id === user.id;
              return (
                <div className={`border rounded-xl p-4 space-y-2 ${isLeading ? "bg-accent/10 border-accent/30" : "bg-muted/50 border-border"}`}>
                  <h4 className="text-xs font-heading font-bold flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    Mis pujas en esta subasta
                  </h4>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Pujas realizadas</span>
                      <p className="font-bold text-foreground text-base">{myBids.length}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Mi puja más alta</span>
                      <p className="font-bold text-primary font-mono text-base">${highestBid.toLocaleString("es-MX")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Estado</span>
                      <p className={`font-bold text-xs ${isLeading ? "text-accent-foreground" : "text-muted-foreground"}`}>
                        {isLeading ? "👑 Líder" : "Superado"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Bid action */}
            {!isScheduled && !isEnded && user && !(auction && (auction as any).start_time && new Date((auction as any).start_time).getTime() > Date.now()) && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
                <h3 className="font-heading font-bold text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  Hacer una puja
                </h3>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={`Mínimo $${(currentPrice + 1).toLocaleString("es-MX")}`}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={currentPrice + 1}
                    className="rounded-lg h-11"
                  />
                  <Button onClick={handleBid} disabled={bidding} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold px-8 rounded-lg h-11 whitespace-nowrap shadow-md text-sm">
                    {bidding ? <Loader2 className="h-4 w-4 animate-spin" /> : "¡PUJAR!"}
                  </Button>
                </div>

                {/* Auto-bid */}
                <div className="bg-primary/5 border border-primary/15 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-primary dark:text-yellow-400" />
                      <span className="dark:text-white">Auto-Puja</span>
                      {autoBidActive && <span className="text-[10px] font-normal text-muted-foreground ml-1">(activa hasta ${autoBidActive.max_amount.toLocaleString("es-MX")})</span>}
                    </h4>
                    {autoBidActive && (
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-destructive hover:text-destructive" onClick={handleCancelAutoBid} disabled={savingAutoBid}>
                        {savingAutoBid ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancelar"}
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    El sistema pujará automáticamente por ti (de $1 en $1) hasta tu monto máximo.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Monto máximo ($)"
                      value={autoBidMax}
                      onChange={(e) => setAutoBidMax(e.target.value)}
                      min={currentPrice + 2}
                      className="rounded-lg text-sm"
                    />
                    <Button onClick={handleSetAutoBid} disabled={savingAutoBid} size="sm" className="rounded-lg whitespace-nowrap px-4">
                      {savingAutoBid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : autoBidActive ? "Actualizar" : "Activar"}
                    </Button>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  ⚠️ Al pujar, te comprometes a <strong className="text-foreground">pagar el monto de tu puja</strong> si resultas ganador.
                  El incumplimiento puede afectar tu reputación y restringir tu acceso a futuras subastas.
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed flex items-start gap-1">
                  <span>💱</span>
                  <span>El monto final se paga en <strong className="text-foreground">bolívares (Bs)</strong> a la tasa oficial del <strong className="text-foreground">Banco Central de Venezuela (BCV)</strong> vigente al momento de cerrar la subasta.</span>
                </p>
              </div>
            )}

            {!isEnded && !user && (
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  <a href="/auth" className="text-primary hover:underline font-bold">Inicia sesión</a> para pujar
                </p>
              </div>
            )}

            {/* Bid History */}
            {bids.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-muted/50 px-4 py-3 border-b border-border">
                  <h3 className="font-heading font-bold text-sm">Historial de Pujas</h3>
                </div>
                <div className="max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-2 sm:px-4 py-2.5 text-left text-xs text-muted-foreground font-medium w-8">#</th>
                        <th className="px-2 sm:px-4 py-2.5 text-left text-xs text-muted-foreground font-medium">Postor</th>
                        <th className="px-2 sm:px-4 py-2.5 text-right text-xs text-muted-foreground font-medium w-20 sm:w-24">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bids.map((bid, index) => (
                        <tr key={bid.id} className={`border-b border-border last:border-0 transition-colors ${index === 0 ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                          <td className="px-2 sm:px-4 py-2.5 text-muted-foreground">{index === 0 ? "👑" : index + 1}</td>
                          <td className="px-2 sm:px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 max-w-full overflow-hidden">
                              <span className="truncate font-medium">{maskName(bid.bidder_name)}</span>
                              {bidderIsAdmin[bid.user_id] && <AdminBadge size="sm" />}
                              <BuyerBadge size="sm" winsCount={bidderWins[bid.user_id] || 0} isAdmin={!!bidderIsAdmin[bid.user_id]} manualTier={bidderManualTier[bid.user_id]} />
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-2.5 text-right font-bold text-primary font-mono whitespace-nowrap">${bid.amount.toLocaleString("es-MX")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Review Section */}
            {isEnded && (canReviewDealer || canReviewBuyer) && (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="w-full bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between hover:bg-muted/70 transition-colors"
                >
                  <h3 className="font-heading font-bold text-sm flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-warning" />
                    {canReviewDealer ? "Calificar al Vendedor" : "Calificar al Comprador"}
                  </h3>
                  <span className="text-xs text-muted-foreground">{showReviewForm ? "▲" : "▼"}</span>
                </button>
                {showReviewForm && (
                  <div className="p-4">
                    <ReviewForm
                      auctionId={auction.id}
                      reviewedId={canReviewDealer ? auction.created_by : auction.winner_id!}
                      reviewType={canReviewDealer ? "buyer_to_dealer" : "dealer_to_buyer"}
                      onSubmitted={() => setShowReviewForm(false)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Existing Reviews */}
            {auctionReviews.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-muted/50 px-4 py-3 border-b border-border">
                  <h3 className="font-heading font-bold text-sm flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Calificaciones ({auctionReviews.length})
                  </h3>
                </div>
                <div className="p-3 space-y-2">
                  {auctionReviews.map(review => (
                    <ReviewCard
                      key={review.id}
                      id={review.id}
                      reviewerName={review.reviewer_name || "Usuario"}
                      rating={review.rating}
                      comment={review.comment}
                      tags={review.tags || []}
                      productAccuracy={review.product_accuracy}
                      attentionQuality={review.attention_quality}
                      shippingSpeed={review.shipping_speed}
                      paymentCompliance={review.payment_compliance}
                      communicationQuality={review.communication_quality}
                      createdAt={review.created_at}
                      reviewType={review.review_type}
                      replyText={(review as any).reply_text}
                      repliedAt={(review as any).replied_at}
                      reviewedId={review.reviewed_id}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main >
      <Footer />
    </div >
  );
};

export default AuctionDetail;
