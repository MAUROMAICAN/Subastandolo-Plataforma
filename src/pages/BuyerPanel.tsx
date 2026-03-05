import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { useDisputes, type Dispute } from "@/hooks/useDisputes";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useBuyerWins } from "@/hooks/useBuyerStats";
import { useUserReviews } from "@/hooks/useReviews";
import { useFavorites } from "@/hooks/useFavorites";
import { useDealerFollows } from "@/hooks/useDealerFollows";
import BuyerBadge from "@/components/BuyerBadge";
import AdminBadge from "@/components/AdminBadge";
import ReputationThermometer from "@/components/ReputationThermometer";
import DisputeChat from "@/components/DisputeChat";
import DisputeForm from "@/components/DisputeForm";
import PasswordInput from "@/components/PasswordInput";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import ProfileAvatarUpload from "@/components/ProfileAvatarUpload";
import AuctionCard from "@/components/AuctionCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ArrowLeft, AlertTriangle, Clock, CheckCircle, Shield, Scale,
  ChevronRight, ImageIcon, Store, Star, Heart, Plus, Package,
  Lock, ShieldCheck, User, MapPin, Users, CreditCard
} from "lucide-react";
import ProfileCompletionBar from "@/components/ProfileCompletionBar";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Abierta", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30", icon: AlertTriangle },
  mediation: { label: "En Mediación", color: "bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20", icon: Scale },
  resolved: { label: "Resuelta", color: "bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20", icon: CheckCircle },
  refunded: { label: "Reembolsada", color: "bg-destructive/10 text-destructive dark:text-white border-destructive/20 dark:border-white/20", icon: Shield },
};

type PanelView = "overview" | "disputes" | "dispute-detail" | "new-dispute" | "security" | "profile" | "dealers" | "favoritos" | "purchases" | "addresses";

export interface StoreOrder extends Tables<"marketplace_orders"> {
  dealer: { name: string } | null;
  product: {
    title: string;
    images: { image_url: string; display_order: number }[];
  } | null;
}

const BuyerPanel = () => {
  const { user, profile, isDealer, isAdmin, loading: authLoading, refreshProfile } = useAuth();
  const { getSetting } = useSiteSettings();
  const { winsCount } = useBuyerWins(user?.id);
  const { buyerStats } = useUserReviews(user?.id);
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();
  const { followedDealers, loadingList: loadingDealers, toggleFollow } = useDealerFollows();
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

  // Tienda (Marketplace Orders)
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [purchasesTab, setPurchasesTab] = useState<"subastas" | "tienda">("subastas");

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

  // Fetch Marketplace Orders
  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      setLoadingOrders(true);
      try {
        const { data } = await supabase
          .from("marketplace_orders")
          .select(`
            *,
            dealer:profiles!dealer_id(name),
            product:marketplace_products(title, images:marketplace_product_images(image_url, display_order))
          `)
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false });

        // Enrich
        const enriched = (data || []).map((o: any) => ({
          ...o,
          product: {
            ...o.product,
            images: o.product?.images?.sort((a: any, b: any) => a.display_order - b.display_order) || []
          }
        }));
        setStoreOrders(enriched);
      } catch (err) {
        console.error("Error fetching store orders:", err);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchOrders();
  }, [user]);

  // Fetch favorite auctions
  useEffect(() => {
    if (!user || favoriteIds.size === 0) {
      setFavoriteAuctions([]);
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

  const handlePasswordUpdate = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    } else {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "✅ Éxito", description: "Tu contraseña ha sido actualizada." });
      return true;
    }
  };

  const ProfileView = () => {
    const [fullName, setFullName] = useState((profile as any)?.full_name || "");
    const [phone, setPhone] = useState((profile as any)?.phone || "");
    const [city, setCity] = useState((profile as any)?.city || "");
    const [profileState, setProfileState] = useState((profile as any)?.state || "");
    const [cedulaNumber, setCedulaNumber] = useState((profile as any)?.cedula_number || "");
    const [cedulaPhotoUrl, setCedulaPhotoUrl] = useState<string | null>((profile as any)?.cedula_photo_url || null);
    const [cedulaFile, setCedulaFile] = useState<File | null>(null);
    const [cedulaPreview, setCedulaPreview] = useState<string | null>(null);
    const [cedulaFileName, setCedulaFileName] = useState<string | null>(null);
    const cedulaFileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const { toast } = useToast();

    // Build a synthetic profile object for the completion bar
    const liveProfile = {
      full_name: fullName,
      avatar_url: (profile as any)?.avatar_url,
      city,
      state: profileState,
      cedula_number: cedulaNumber,
      cedula_photo_url: cedulaPhotoUrl,
    };

    const handleCedulaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCedulaFile(file);
      setCedulaFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => setCedulaPreview(reader.result as string);
      reader.readAsDataURL(file);
    };

    const uploadCedulaPhoto = async (): Promise<string | null> => {
      if (!cedulaFile || !user) return cedulaPhotoUrl;
      const ext = cedulaFile.name.split(".").pop();
      const path = `cedula/${user.id}/cedula.${ext}`;
      const { error } = await supabase.storage
        .from("profile-docs")
        .upload(path, cedulaFile, { upsert: true });
      if (error) { toast({ title: "Error subiendo foto de cédula", description: error.message, variant: "destructive" }); return null; }
      const { data: urlData } = supabase.storage.from("profile-docs").getPublicUrl(path);
      return urlData.publicUrl;
    };

    const onSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setUpdating(true);
      setUploading(true);

      let finalCedulaUrl = cedulaPhotoUrl;
      if (cedulaFile) {
        finalCedulaUrl = await uploadCedulaPhoto();
      }

      setUploading(false);

      const { error } = await supabase.from("profiles").update({
        full_name: fullName,
        phone,
        city,
        state: profileState,
        cedula_number: cedulaNumber || null,
        cedula_photo_url: finalCedulaUrl || null,
      } as any).eq("id", user!.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setCedulaPhotoUrl(finalCedulaUrl);
        toast({ title: "✅ ¡Perfil actualizado!", description: "Tus datos han sido guardados." });
        await refreshProfile();
      }
      setUpdating(false);
    };

    const STATES = ["Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo", "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "Lara", "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre", "Táchira", "Trujillo", "Vargas", "Yaracuy", "Zulia"];

    return (
      <main className="container mx-auto px-4 py-4 max-w-2xl">
        <button onClick={() => setView("overview")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-6">
          <ArrowLeft className="h-3 w-3" /> Volver a mi panel
        </button>

        <h1 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary dark:text-[#A6E300]" />
          Mi Perfil
        </h1>

        {/* Completion bar */}
        <Card className="border border-border rounded-xl mb-5 p-5">
          <ProfileCompletionBar profile={liveProfile} />
        </Card>

        {/* Avatar — clean horizontal layout */}
        <Card className="border border-border rounded-xl mb-5 overflow-hidden">
          <div className="p-5 flex items-start gap-5">
            {/* Left: avatar + buttons (policies hidden) */}
            <div className="shrink-0">
              <ProfileAvatarUpload
                avatarUrl={(profile as any)?.avatar_url || null}
                userName={(profile as any)?.full_name || "Usuario"}
                onAvatarChange={async () => { await refreshProfile(); }}
                size="md"
                hidePolicies
              />
            </div>

            {/* Right: name + status + compact policy note */}
            <div className="flex-1 min-w-0 pt-1 space-y-2">
              <div>
                <p className="font-heading font-bold text-sm leading-tight truncate">
                  {(profile as any)?.full_name || "Sin nombre"}
                </p>
                <p className={`text-[11px] mt-0.5 font-medium ${(profile as any)?.avatar_url ? "text-green-500 dark:text-[#A6E300]" : "text-muted-foreground"}`}>
                  {(profile as any)?.avatar_url ? "✓ Foto guardada" : "Sin foto de perfil"}
                </p>
              </div>
              <div className="bg-secondary/50 dark:bg-white/5 rounded-lg p-2.5 text-[10px] text-muted-foreground leading-relaxed space-y-0.5">
                <p className="font-semibold text-foreground mb-1">📌 Políticas de imagen</p>
                <p>• Solo fotos personales o logos de emprendimiento</p>
                <p>• Sin cédulas, QR, redes sociales ni datos privados</p>
                <p className="font-medium text-[10px]">JPG, PNG, WebP · Máx 2MB</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Personal data form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-primary dark:text-[#A6E300]" />
                Datos Personales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nombre completo *</label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Tu nombre completo" className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0412-0000000" className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Estado *</label>
                  <select value={profileState} onChange={e => setProfileState(e.target.value)} required className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Selecciona estado...</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Ciudad *</label>
                  <Input value={city} onChange={e => setCity(e.target.value)} required placeholder="Tu ciudad" className="rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identity / cedula */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading font-bold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary dark:text-[#A6E300]" />
                Identidad (Cédula)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Número de Cédula *</label>
                <Input
                  value={cedulaNumber}
                  onChange={e => setCedulaNumber(e.target.value.toUpperCase())}
                  placeholder="Ej: V-12345678"
                  className="rounded-lg font-mono"
                  maxLength={15}
                />
                <p className="text-[10px] text-muted-foreground">Formato: V-XXXXXXXX o E-XXXXXXXX</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Foto de tu Cédula *</label>
                {/* Hidden input – Android-safe pattern */}
                <input
                  ref={cedulaFileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleCedulaFile}
                />

                {(cedulaPreview || cedulaPhotoUrl) ? (
                  <div className="relative w-full max-w-xs">
                    <img
                      src={cedulaPreview || cedulaPhotoUrl!}
                      alt="Cédula"
                      className="w-full rounded-xl border border-border object-cover max-h-40"
                    />
                    <button
                      type="button"
                      onClick={() => { setCedulaFile(null); setCedulaPreview(null); setCedulaFileName(null); }}
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-lg border border-border"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="border border-border rounded-xl p-3 bg-secondary/10 dark:bg-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => cedulaFileInputRef.current?.click()}
                        className="shrink-0 py-2.5 px-4 rounded-lg text-xs font-black bg-primary text-primary-foreground hover:bg-primary/80 active:scale-95 transition-all dark:bg-[#A6E300] dark:text-black"
                      >
                        Seleccionar foto
                      </button>
                      <span className="text-xs min-w-0 truncate">
                        {cedulaFileName ? (
                          <span className="text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <span className="shrink-0">✓</span>
                            <span className="truncate">{cedulaFileName}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Ningún archivo seleccionado</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  📌 Tu cédula se usa solo para verificar identidad y se almacena de forma segura.
                </p>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={updating} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm h-11">
            {updating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />{uploading ? "Subiendo foto..." : "Guardando..."}</>
            ) : "Guardar Perfil"}
          </Button>
        </form>
      </main>
    );
  };

  const SecurityView = () => {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [updating, setUpdating] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
        const { toast } = await import("@/hooks/use-toast");
        toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
        return;
      }
      if (newPassword.length < 6) {
        const { toast } = await import("@/hooks/use-toast");
        toast({ title: "Error", description: "Mínimo 6 caracteres.", variant: "destructive" });
        return;
      }
      setUpdating(true);
      const success = await handlePasswordUpdate(newPassword);
      if (success) {
        setNewPassword("");
        setConfirmPassword("");
      }
      setUpdating(false);
    };

    return (
      <main className="container mx-auto px-4 py-4 max-w-3xl">
        <button onClick={() => setView("overview")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-6">
          <ArrowLeft className="h-3 w-3" /> Volver a mi panel
        </button>

        <h1 className="text-xl font-heading font-bold mb-6 flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary dark:text-[#A6E300]" />
          Seguridad de la Cuenta
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Mis Compras Section */}
            <Card className="border border-border rounded-sm shadow-sm overflow-hidden">
              <CardHeader className="pb-0 pt-5 px-5 flex flex-row items-center justify-between border-b border-border bg-secondary/20">
                <CardTitle className="text-base font-heading font-bold flex items-center gap-2 mb-4">
                  <Package className="h-4 w-4 text-primary dark:text-[#A6E300]" />
                  Mis Compras
                </CardTitle>
                <div className="flex bg-background rounded-md p-1 border border-border/50 mb-4 h-9">
                  <button
                    onClick={() => setPurchasesTab("subastas")}
                    className={`text-xs px-3 font-semibold rounded-sm transition-colors ${purchasesTab === "subastas" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Subastas
                  </button>
                  <button
                    onClick={() => setPurchasesTab("tienda")}
                    className={`text-xs px-3 font-semibold rounded-sm transition-colors ${purchasesTab === "tienda" ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Tienda
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-0">

                {purchasesTab === "subastas" && (
                  <>
                    <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center text-xs text-muted-foreground">
                      <span>Total ganadas: <strong className="text-foreground">{winsCount}</strong></span>
                    </div>
                    {loadingAuctions ? (
                      <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300]" /></div>
                    ) : wonAuctions.length === 0 ? (
                      <div className="text-center p-8 bg-muted/10">
                        <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-foreground">Aún no has ganado subastas</p>
                        <p className="text-xs text-muted-foreground mt-1 mb-4">¡Anímate a participar y consigue grandes ofertas!</p>
                        <Button size="sm" onClick={() => navigate("/#subastas")} className="rounded-sm text-xs h-8">Ver Subastas Activas</Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {wonAuctions.map((auction) => {
                          const endDate = new Date(auction.end_time);
                          const dateStr = endDate.toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" });

                          const statusLabel =
                            auction.delivery_status === "delivered" || auction.delivered_at ? "Entregado" :
                              auction.delivery_status === "shipped" || auction.tracking_number ? "En camino" :
                                auction.payment_status === "verified" ? "Pago verificado" :
                                  auction.payment_status === "under_review" ? "Pago en revisión" :
                                    auction.payment_status === "escrow" ? "En escrow" :
                                      "Pago pendiente";

                          const statusColor =
                            auction.delivery_status === "delivered" || auction.delivered_at ? "text-emerald-600 dark:text-[#A6E300]" :
                              auction.delivery_status === "shipped" || auction.tracking_number ? "text-primary dark:text-[#A6E300]" :
                                auction.payment_status === "verified" ? "text-primary dark:text-[#A6E300]" :
                                  "text-amber-600 dark:text-amber-400";

                          const statusDesc =
                            auction.delivery_status === "delivered" || auction.delivered_at ? "Asumimos que ya recibiste la compra" :
                              auction.delivery_status === "shipped" || auction.tracking_number ? "Tu producto está en camino" :
                                auction.payment_status === "verified" ? "El dealer preparará tu envío" :
                                  auction.payment_status === "under_review" ? "Estamos revisando tu comprobante" :
                                    "Sube tu comprobante de pago";

                          return (
                            <div key={auction.id} className="p-5 flex flex-col sm:flex-row gap-4 hover:bg-muted/5 transition-colors group cursor-pointer" onClick={() => navigate(`/auction/${auction.id}`)}>
                              <div className="h-20 w-20 bg-secondary/30 rounded-sm overflow-hidden shrink-0 border border-border flex items-center justify-center">
                                {auction.image_url ? <img src={auction.image_url} alt={auction.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Package className="h-6 w-6 text-muted-foreground/30" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p className="font-heading font-bold text-sm text-foreground hover:text-primary dark:hover:text-white transition-colors line-clamp-1 truncate block">
                                    {auction.title}
                                  </p>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{dateStr}</span>
                                </div>

                                <p className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{statusDesc}</p>

                                <div className="flex items-end justify-between mt-3">
                                  <p className="font-bold text-sm">Precio final: <span className="text-accent">${auction.current_price} USD</span></p>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}

                {purchasesTab === "tienda" && (
                  loadingOrders ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300]" /></div>
                  ) : storeOrders.length === 0 ? (
                    <div className="text-center p-8 bg-muted/10">
                      <Store className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-foreground">Aún no tienes pedidos en la Tienda</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">Compra productos directos a precio fijo.</p>
                      <Button size="sm" onClick={() => navigate("/tienda")} className="rounded-sm bg-accent hover:bg-accent/90 text-accent-foreground text-xs h-8">Visitar Tienda</Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {storeOrders.map((order) => {
                        const mainImg = order.product?.images?.[0]?.image_url;
                        return (
                          <div key={order.id} className="p-5 flex flex-col sm:flex-row gap-4 hover:bg-muted/5 transition-colors group cursor-pointer" onClick={() => navigate(`/checkout-tienda/${order.product_id}`)}>
                            <div className="h-20 w-20 bg-secondary/30 rounded-sm overflow-hidden shrink-0 border border-border flex items-center justify-center">
                              {mainImg ? <img src={mainImg} alt={order.product?.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Store className="h-6 w-6 text-muted-foreground/30" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="font-heading font-bold text-sm text-foreground hover:text-accent transition-colors line-clamp-1">
                                  {order.product?.title || "Producto"}
                                </p>
                                <span className="text-[10px] text-muted-foreground shrink-0">{new Date(order.created_at).toLocaleDateString("es-VE")}</span>
                              </div>

                              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                                <Store className="h-3 w-3" /> Dealer: {order.dealer?.name || "Vendedor"}
                              </p>

                              <div className="flex items-center justify-between mt-3">
                                <p className="font-bold text-sm text-foreground">${order.total_price_usd.toLocaleString("es-MX", { minimumFractionDigits: 2 })} USD</p>
                                <div className="flex items-center gap-2">
                                  {order.payment_status === 'pending' || order.payment_status === 'under_review' ? (
                                    <Badge variant="outline" className="text-[10px] h-5 bg-warning/10 text-warning dark:text-amber-400 border-warning/20">Pago Revisión</Badge>
                                  ) : order.shipping_status === 'shipped' ? (
                                    <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20">Enviado</Badge>
                                  ) : order.shipping_status === 'delivered' ? (
                                    <Badge variant="outline" className="text-[10px] h-5 bg-success/10 text-success dark:text-[#A6E300] border-success/20">Entregado</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] h-5 bg-secondary text-foreground dark:text-white">Por Enviar</Badge>
                                  )}
                                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 dark:text-slate-500 shrink-0" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            <Card className="border border-border rounded-sm shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-heading font-bold">Cambiar Contraseña</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Nueva contraseña</label>
                    <PasswordInput
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="h-10 rounded-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Confirmar nueva contraseña</label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="h-10 rounded-sm"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground rounded-sm font-bold" disabled={updating}>
                    {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Actualizar Contraseña"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border rounded-sm bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading font-bold">Estado de Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-brand-lime/10 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-brand-lime" />
                </div>
                <div>
                  <p className="text-xs font-bold">Cuenta Verificada</p>
                  <p className="text-[10px] text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="p-3 bg-card border border-border rounded-sm">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Tu cuenta está protegida con cifrado de extremo a extremo. Recuerda no compartir tu contraseña con nadie.
                </p>
              </div>
              <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => navigate("/reset-password")}>
                ¿Olvidaste tu contraseña?
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary dark:text-[#A6E300]" /></div>
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
          <button onClick={() => { setView("disputes"); setSelectedDispute(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-4">
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

  // Purchases view
  if (view === "purchases") {
    const auctionStatuses: Record<string, { label: string; color: string; dot: string }> = {
      pending: { label: "Pago pendiente", color: "bg-amber-500/10 text-amber-600 border-amber-400/30 dark:text-amber-400", dot: "bg-amber-400" },
      under_review: { label: "En revisión", color: "bg-blue-500/10 text-blue-600 border-blue-400/30 dark:text-blue-400", dot: "bg-blue-400" },
      verified: { label: "Pago verificado", color: "bg-primary/10 text-primary border-primary/30 dark:text-[#A6E300]", dot: "bg-primary" },
      paid: { label: "Pago reportado", color: "bg-blue-500/10 text-blue-600 border-blue-400/30 dark:text-blue-400", dot: "bg-blue-400" },
      shipped: { label: "Enviado 🚚", color: "bg-purple-500/10 text-purple-600 border-purple-400/30 dark:text-purple-400", dot: "bg-purple-400" },
      delivered: { label: "Entregado ✓", color: "bg-primary/10 text-primary border-primary/30 dark:text-[#A6E300]", dot: "bg-primary" },
    };
    const orderStatuses: Record<string, { label: string; color: string }> = {
      pending: { label: "Pago pendiente", color: "bg-amber-500/10 text-amber-600 border-amber-400/30 dark:text-amber-400" },
      under_review: { label: "En revisión", color: "bg-blue-500/10 text-blue-600 border-blue-400/30 dark:text-blue-400" },
      verified: { label: "Pago verificado", color: "bg-primary/10 text-primary border-primary/30 dark:text-[#A6E300]" },
      shipped: { label: "Enviado 🚚", color: "bg-purple-500/10 text-purple-600 border-purple-400/30 dark:text-purple-400" },
      delivered: { label: "Entregado ✓", color: "bg-primary/10 text-primary border-primary/30 dark:text-[#A6E300]" },
    };

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-2xl pb-24">
          <button onClick={() => setView("overview")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-6 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Volver a mi panel
          </button>

          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary dark:text-[#A6E300]" />
              Mis Compras
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{wonAuctions.length} subasta{wonAuctions.length !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{storeOrders.length} tienda</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-secondary/50 dark:bg-secondary/20 rounded-xl p-1 gap-1 mb-6 border border-border">
            <button
              onClick={() => setPurchasesTab("subastas")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${purchasesTab === "subastas"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"}`}
            >
              🏆 Subastas {wonAuctions.length > 0 && <span className="ml-1.5 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">{wonAuctions.length}</span>}
            </button>
            <button
              onClick={() => setPurchasesTab("tienda")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${purchasesTab === "tienda"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"}`}
            >
              🏪 Tienda {storeOrders.length > 0 && <span className="ml-1.5 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">{storeOrders.length}</span>}
            </button>
          </div>

          {/* === SUBASTAS TAB === */}
          {purchasesTab === "subastas" && (
            loadingAuctions ? (
              <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary dark:text-[#A6E300]" /></div>
            ) : wonAuctions.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-8 w-8 text-primary/50" />
                </div>
                <div>
                  <p className="font-heading font-bold text-lg mb-1">Aún no has ganado subastas</p>
                  <p className="text-sm text-muted-foreground dark:text-slate-400 max-w-xs mx-auto">¡Participa en nuestras subastas y gana increíbles productos!</p>
                </div>
                <button
                  onClick={() => navigate("/")}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  Explorar Subastas
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {wonAuctions.map(a => {
                  const st = auctionStatuses[a.delivery_status === "delivered" ? "delivered" : a.delivery_status === "shipped" ? "shipped" : a.payment_status] || auctionStatuses.pending;
                  const isPending = a.payment_status === "pending";
                  return (
                    <div key={a.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors group">
                      <div className="flex items-center gap-4 p-4">
                        {/* Image */}
                        <div className="h-18 w-18 shrink-0 rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center border border-border" style={{ height: "72px", width: "72px" }}>
                          {a.image_url
                            ? <img src={a.image_url} alt={a.title} className="h-full w-full object-contain" />
                            : <Package className="h-6 w-6 text-muted-foreground/30" />}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-heading font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary dark:group-hover:text-[#A6E300] transition-colors">{a.title}</p>
                          <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">{new Date(a.end_time).toLocaleDateString("es-VE")}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="font-black text-sm text-foreground">${a.current_price.toLocaleString("es-MX")} <span className="text-[10px] font-normal text-muted-foreground">USD</span></span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                          </div>
                        </div>
                        {/* CTA */}
                        <button
                          onClick={() => navigate(`/mi-compra/${a.id}`)}
                          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${isPending
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 animate-pulse-slow"
                            : "bg-secondary text-foreground hover:bg-secondary/80"}`}
                        >
                          {isPending ? "💳 Pagar" : "Ver →"}
                        </button>
                      </div>
                      {/* Progress bar mini */}
                      <div className="px-4 pb-3">
                        <div className="flex items-center gap-1">
                          {["pending", "under_review", "verified", "shipped", "delivered"].map((step, idx) => {
                            const current = a.delivery_status === "delivered" ? 4 :
                              a.delivery_status === "shipped" ? 3 :
                                a.payment_status === "verified" ? 2 :
                                  a.payment_status === "under_review" ? 1 : 0;
                            return (
                              <div key={step} className={`h-1 flex-1 rounded-full transition-all ${idx <= current ? "bg-primary" : "bg-border"}`} />
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-1 text-[9px] text-muted-foreground dark:text-slate-500">
                          <span>Pago</span><span>Revisión</span><span>Verificado</span><span>Enviado</span><span>Entregado</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* === TIENDA TAB === */}
          {purchasesTab === "tienda" && (
            loadingOrders ? (
              <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary dark:text-[#A6E300]" /></div>
            ) : storeOrders.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                  <Store className="h-8 w-8 text-accent/50" />
                </div>
                <div>
                  <p className="font-heading font-bold text-lg mb-1">Aún no tienes pedidos en la Tienda</p>
                  <p className="text-sm text-muted-foreground dark:text-slate-400 max-w-xs mx-auto">Compra productos directos a precio fijo.</p>
                </div>
                <button
                  onClick={() => navigate("/tienda")}
                  className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-bold hover:bg-accent/90 transition-colors"
                >
                  Visitar Tienda
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {storeOrders.map(order => {
                  const mainImg = order.product?.images?.[0]?.image_url;
                  const st = orderStatuses[order.shipping_status === "delivered" ? "delivered" :
                    order.shipping_status === "shipped" ? "shipped" :
                      order.payment_status === "verified" ? "verified" :
                        order.payment_status === "under_review" ? "under_review" : "pending"]
                    || orderStatuses.pending;
                  return (
                    <div key={order.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-accent/30 transition-colors group">
                      <div className="flex items-center gap-4 p-4">
                        <div className="h-18 w-18 shrink-0 rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center border border-border" style={{ height: "72px", width: "72px" }}>
                          {mainImg
                            ? <img src={mainImg} alt={order.product?.title} className="h-full w-full object-contain" />
                            : <Store className="h-6 w-6 text-muted-foreground/30" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-heading font-bold text-sm text-foreground line-clamp-1 group-hover:text-accent transition-colors">{order.product?.title || "Producto"}</p>
                          <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5 flex items-center gap-1">
                            <Store className="h-3 w-3" />{order.dealer?.name || "Dealer"}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="font-black text-sm text-foreground">${order.total_price_usd.toLocaleString("es-MX", { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-muted-foreground">USD</span></span>
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>
                              {st.label}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/checkout-tienda/${order.product_id}`)}
                          className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-secondary text-foreground hover:bg-secondary/80 transition-all"
                        >
                          Ver →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </main>
      </div>
    );
  }

  // Disputes list view
  // Addresses view
  if (view === "addresses") {
    const AddressesView = () => {
      const [editing, setEditing] = useState(false);
      const [addrName, setAddrName] = useState((profile as any)?.full_name || "");
      const [addrPhone, setAddrPhone] = useState((profile as any)?.phone || "");
      const [addrState, setAddrState] = useState((profile as any)?.state || "");
      const [addrCity, setAddrCity] = useState((profile as any)?.city || "");
      const [saving, setSaving] = useState(false);

      const STATES = ["Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo", "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "Lara", "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre", "Táchira", "Trujillo", "Vargas", "Yaracuy", "Zulia"];

      const handleSave = async () => {
        if (!addrName.trim() || !addrCity.trim() || !addrState) return;
        setSaving(true);
        await supabase.from("profiles").update({
          full_name: addrName.trim(),
          phone: addrPhone.trim(),
          city: addrCity.trim(),
          state: addrState,
        } as any).eq("id", user!.id);
        setSaving(false);
        setEditing(false);
        const { toast } = await import("@/hooks/use-toast");
        toast({ title: "¡Dirección guardada!" });
      };

      const hasAddress = (profile as any)?.city && (profile as any)?.state;

      return (
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="container mx-auto px-4 py-4 max-w-2xl">
            <button onClick={() => setView("overview")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-6">
              <ArrowLeft className="h-3 w-3" /> Volver a mi panel
            </button>

            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-heading font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Mis Direcciones de Envío
              </h1>
            </div>

            {/* Info banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-5 text-xs text-primary dark:text-[#A6E300] flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Tu dirección guardada aquí se utilizará automáticamente al realizar nuevas compras para pre-llenar el formulario de envío.</span>
            </div>

            {/* Saved address card */}
            <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
              <div className="bg-secondary/30 px-5 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground dark:text-slate-300">Dirección Principal</span>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    {hasAddress ? "Editar" : "Agregar"}
                  </button>
                )}
              </div>

              {!editing ? (
                hasAddress ? (
                  <div className="px-5 py-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground dark:text-slate-400 w-20 text-xs shrink-0">Nombre</span>
                      <span className="font-semibold">{(profile as any)?.full_name || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground dark:text-slate-400 w-20 text-xs shrink-0">Teléfono</span>
                      <span className="font-semibold">{(profile as any)?.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground dark:text-slate-400 w-20 text-xs shrink-0">Estado</span>
                      <span className="font-semibold">{(profile as any)?.state}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground dark:text-slate-400 w-20 text-xs shrink-0">Ciudad</span>
                      <span className="font-semibold">{(profile as any)?.city}</span>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground dark:text-slate-400">No tienes una dirección guardada aún.</p>
                    <button onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                      + Agregar dirección
                    </button>
                  </div>
                )
              ) : (
                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground dark:text-slate-300">Nombre completo</label>
                      <Input value={addrName} onChange={e => setAddrName(e.target.value)} placeholder="Tu nombre" className="rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground dark:text-slate-300">Teléfono</label>
                      <Input value={addrPhone} onChange={e => setAddrPhone(e.target.value)} placeholder="0412-0000000" className="rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground dark:text-slate-300">Estado</label>
                      <select value={addrState} onChange={e => setAddrState(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Selecciona estado...</option>
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground dark:text-slate-300">Ciudad</label>
                      <Input value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="Tu ciudad" className="rounded-lg" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl font-bold text-sm">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Guardar Dirección
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      );
    };
    return <AddressesView />;
  }

  // Disputes list view
  if (view === "disputes") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-3xl">
          <button onClick={() => setView("overview")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-4">
            <ArrowLeft className="h-3 w-3" /> Volver a mi panel
          </button>

          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary dark:text-[#A6E300]" />
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

  if (view === "security") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <SecurityView />
      </div>
    );
  }

  if (view === "profile") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <ProfileView />
      </div>
    );
  }

  // New dispute view
  if (view === "new-dispute") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-3xl">
          <button onClick={() => setView("disputes")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-4">
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

  // Favoritos view
  if (view === "favoritos") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-4xl">
          <button onClick={() => setView("overview")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-6">
            <ArrowLeft className="h-3 w-3" /> Volver a mi panel
          </button>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500 dark:text-[#A6E300]" />
              Mis Favoritos
            </h1>
            <span className="text-xs text-muted-foreground">{favoriteAuctions.length} subasta{favoriteAuctions.length !== 1 ? "s" : ""}</span>
          </div>

          {favoriteIds.size === 0 || favoriteAuctions.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 dark:bg-[#A6E300]/10 flex items-center justify-center">
                <Heart className="h-8 w-8 text-red-500/50 dark:text-[#A6E300]/50" />
              </div>
              <div>
                <p className="font-heading font-bold text-lg mb-1">Aún no tienes subastas favoritas</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Presiona el <strong>corazón ♥</strong> en cualquier subasta para guardarla aquí.</p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                Explorar Subastas
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {favoriteAuctions.map(a => (
                <AuctionCard key={a.id} auction={a} isFavorite={true} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Dealers view
  if (view === "dealers") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-4xl">
          <button onClick={() => setView("overview")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-6">
            <ArrowLeft className="h-3 w-3" /> Volver a mi panel
          </button>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary dark:text-[#A6E300]" />
              Mis Dealers Favoritos
            </h1>
            <span className="text-xs text-muted-foreground">{followedDealers.length} dealer{followedDealers.length !== 1 ? "s" : ""}</span>
          </div>

          {loadingDealers ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : followedDealers.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary/50" />
              </div>
              <div>
                <p className="font-heading font-bold text-lg mb-1">Aún no sigues ningún dealer</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Visita el perfil de un dealer y presiona <strong>"Seguir dealer"</strong> para agregarlo aquí.</p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                Explorar Subastas
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {followedDealers.map(d => {
                const name = d.profile?.full_name || "Dealer";
                const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                const since = new Date(d.created_at).toLocaleDateString("es-VE", { month: "short", year: "numeric" });
                return (
                  <div
                    key={d.dealer_id}
                    className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
                  >
                    {/* Cover strip */}
                    <div className="h-14 bg-gradient-to-r from-slate-800 to-slate-900 relative">
                      {d.live_auctions > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/15 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
                          <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#A6E300" }} /><span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: "#A6E300" }} /></span>
                          {d.live_auctions} en vivo
                        </div>
                      )}
                    </div>

                    <div className="px-4 pb-4">
                      {/* Avatar */}
                      <div className="-mt-7 mb-3">
                        <div className="w-14 h-14 rounded-full border-2 border-background bg-secondary flex items-center justify-center overflow-hidden shadow-md">
                          {d.profile?.avatar_url ? (
                            <img src={d.profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base font-black text-secondary-foreground">{initials}</span>
                          )}
                        </div>
                      </div>

                      {/* Name + Badge */}
                      <div className="mb-1">
                        <p className="font-heading font-bold text-sm leading-tight truncate">{name}</p>
                        {d.is_verified && (
                          <span className="text-[10px] font-semibold text-primary">✓ Verificado · {d.sales_count} ventas</span>
                        )}
                      </div>

                      {/* Location + since */}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-3">
                        {d.profile?.city && <><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{d.profile.city}{d.profile.state ? `, ${d.profile.state}` : ""}</span><span className="mx-1 text-border">·</span></>}
                        <span>Desde {since}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/dealer/${d.dealer_id}`)}
                          className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors text-center"
                        >
                          Ver perfil
                        </button>
                        <button
                          onClick={() => toggleFollow(d.dealer_id)}
                          className="px-3 py-2 rounded-xl border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors"
                          title="Dejar de seguir"
                        >
                          <Heart className="h-3.5 w-3.5 fill-primary text-primary hover:fill-destructive hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          <button onClick={() => navigate("/")} className="hover:text-primary dark:hover:text-white transition-colors flex items-center gap-1">
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
              onAvatarChange={() => { }}
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

        {/* Action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Mis Compras */}
          <Card
            className="border border-primary/30 rounded-sm cursor-pointer hover:border-primary transition-colors group bg-primary/5 dark:bg-[#A6E300]/5"
            onClick={() => setView("purchases")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-sm bg-primary/15 dark:bg-[#A6E300]/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 dark:group-hover:bg-[#A6E300]/25 transition-colors">
                <Package className="h-5 w-5 text-primary dark:text-[#A6E300]" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm">Mis Compras</p>
                <p className="text-xs text-muted-foreground">
                  {loadingAuctions ? "Cargando..." : wonAuctions.length > 0 ? `${wonAuctions.length} subasta${wonAuctions.length !== 1 ? "s" : ""} ganada${wonAuctions.length !== 1 ? "s" : ""}` : "Ver tus subastas ganadas"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-primary dark:text-[#A6E300] ml-auto shrink-0" />
            </CardContent>
          </Card>

          {/* Mis Direcciones */}
          <Card
            className="border border-border rounded-sm cursor-pointer hover:border-primary/30 transition-colors group"
            onClick={() => setView("addresses")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-sm bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 dark:group-hover:bg-[#A6E300]/20 transition-colors">
                <MapPin className="h-5 w-5 text-primary dark:text-[#A6E300]" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm">Mis Direcciones</p>
                <p className="text-xs text-muted-foreground">
                  {(profile as any)?.city && (profile as any)?.state
                    ? `${(profile as any).city}, ${(profile as any).state}`
                    : "Configura tu dirección de envío"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </CardContent>
          </Card>

          {/* Disputes */}
          <Card
            className="border border-border rounded-sm cursor-pointer hover:border-primary/30 transition-colors group"
            onClick={() => setView("disputes")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-sm bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 dark:group-hover:bg-[#A6E300]/20 transition-colors">
                <Shield className="h-5 w-5 text-primary dark:text-[#A6E300]" />
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

          {/* Mis Favoritos */}
          <Card
            className="border border-border rounded-sm cursor-pointer hover:border-primary/30 transition-colors group"
            onClick={() => setView("favoritos")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-sm bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 dark:group-hover:bg-[#A6E300]/20 transition-colors">
                <Heart className="h-5 w-5 text-primary dark:text-[#A6E300]" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm">Mis Favoritos</p>
                <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {favoriteAuctions.length > 0 ? `${favoriteAuctions.length} subasta${favoriteAuctions.length !== 1 ? "s" : ""} guardada${favoriteAuctions.length !== 1 ? "s" : ""}` : "Guarda tus subastas favoritas"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </CardContent>
          </Card>

          {/* Mis Dealers */}
          <Card
            className="border border-border rounded-sm cursor-pointer hover:border-primary/30 transition-colors group"
            onClick={() => setView("dealers")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-sm bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 dark:group-hover:bg-[#A6E300]/20 transition-colors">
                <Users className="h-5 w-5 text-primary dark:text-[#A6E300]" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm">Mis Dealers</p>
                <p className="text-xs text-muted-foreground">
                  {followedDealers.length > 0 ? `${followedDealers.length} dealer${followedDealers.length !== 1 ? "s" : ""} favorito${followedDealers.length !== 1 ? "s" : ""}` : "Sigue tus dealers favoritos"}
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



          {/* Perfil */}
          <Card
            className="border border-border rounded-sm cursor-pointer hover:border-primary/30 transition-colors group"
            onClick={() => setView("profile")}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-3">
                <div className="h-11 w-11 rounded-sm bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 dark:group-hover:bg-[#A6E300]/20 transition-colors">
                  <User className="h-5 w-5 text-primary dark:text-[#A6E300]" />
                </div>
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm">Mi Perfil</p>
                  <p className="text-xs text-muted-foreground">Datos personales y verificación</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
              </div>
              <ProfileCompletionBar profile={profile as any} compact onGoToProfile={() => setView("profile")} />
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card
            className="border border-border rounded-sm cursor-pointer hover:border-primary/30 transition-colors group"
            onClick={() => setView("security")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-11 w-11 rounded-sm bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 dark:group-hover:bg-[#A6E300]/20 transition-colors">
                <Lock className="h-5 w-5 text-primary dark:text-[#A6E300]" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm">Seguridad</p>
                <p className="text-xs text-muted-foreground">Contraseña y acceso</p>
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
