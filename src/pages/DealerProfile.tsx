import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useVerifiedDealer } from "@/hooks/useVerifiedDealers";
import { useUserReviews } from "@/hooks/useReviews";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import VerifiedBadge, { getDealerTier } from "@/components/VerifiedBadge";
import ReputationThermometer from "@/components/ReputationThermometer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, Star, User, Calendar, ShieldCheck, MessageCircle, Heart, Store, ImagePlus } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useDealerFollows } from "@/hooks/useDealerFollows";
import { useBCVRate } from "@/hooks/useBCVRate";

export default function DealerProfile() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
    const [dealerInfo, setDealerInfo] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const dealer = useVerifiedDealer(id);
    const { reviews, dealerStats, loading: reviewsLoading } = useUserReviews(id);
    const { isFollowing, loadingFollow, toggleFollow } = useDealerFollows(id);
    const bcvRate = useBCVRate();
    const [products, setProducts] = useState<any[]>([]);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    useEffect(() => {
        if (!id) return;

        const fetchProfile = async () => {
            setLoading(true);

            // Get profile
            const { data: profileData, error: profileErr } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", id)
                .single();

            if (profileErr || !profileData) {
                setError("Usuario no encontrado.");
                setLoading(false);
                return;
            }

            setProfile(profileData);

            // Try to get public dealer info (if any)
            const { data: dData } = await supabase
                .from("dealer_applications" as any)
                .select("business_name, instagram_url")
                .eq("user_id", id)
                .in("status", ["approved", "active"])
                .maybeSingle();

            if (dData) {
                setDealerInfo(dData);
            }

            setLoading(false);
        };

        fetchProfile();
        fetchProducts();
    }, [id]);

    const fetchProducts = async () => {
        if (!id) return;
        const { data } = await (supabase
            .from("marketplace_products")
            .select("id, title, price_usd, condition, images:marketplace_product_images(image_url, display_order)")
            .eq("dealer_id", id)
            .eq("status", "active")
            .gt("stock", 0)
            .order("created_at", { ascending: false }) as any);
        setProducts(data || []);
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        setUploadingBanner(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/store-banner-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('auction-images').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('auction-images').getPublicUrl(fileName);
            await supabase.from('profiles').update({ store_banner_url: publicUrl } as any).eq('id', user.id);
            // Refresh profile
            const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (updated) setProfile(updated);
        } catch (err: any) {
            console.error('Banner upload error:', err);
        } finally {
            setUploadingBanner(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
                <Footer />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <Navbar />
                <main className="flex-1 container max-w-lg mx-auto px-4 py-8 flex flex-col items-center justify-center text-center">
                    <User className="h-16 w-16 text-muted-foreground mb-4" />
                    <h1 className="text-xl font-bold mb-2">Perfil no encontrado</h1>
                    <p className="text-muted-foreground mb-6">{error || "El usuario que buscas no existe o ha sido eliminado."}</p>
                    <BackButton />
                </main>
                <Footer />
            </div>
        );
    }

    const isDealer = dealer && dealer.isVerified;
    const tier = getDealerTier(dealer?.salesCount || 0);
    const displayName = dealerInfo?.business_name || profile.full_name;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            <main className="flex-1 container max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
                <BackButton />

                {/* Profile Header */}
                <Card className="border border-border rounded-2xl overflow-hidden shadow-md mt-4 sm:mt-8">
                    {/* Cover background / Banner */}
                    <div className="h-32 sm:h-48 w-full relative overflow-hidden">
                        {(profile as any)?.store_banner_url ? (
                            <img src={(profile as any).store_banner_url} alt="Store banner" className="w-full h-full object-cover" />
                        ) : (
                            <div className="h-full w-full bg-gradient-to-r from-slate-800 to-slate-900" />
                        )}
                        <div className="absolute inset-0 bg-black/20" />
                        {/* Banner upload button — only for the dealer themselves */}
                        {user && user.id === id && (
                            <label className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors">
                                {uploadingBanner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                                {uploadingBanner ? 'Subiendo...' : 'Cambiar banner'}
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
                            </label>
                        )}
                    </div>

                    <CardContent className="px-6 sm:px-10 pb-8 relative bg-card">
                        <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-center sm:items-end -mt-12 sm:-mt-16 mb-6">

                            <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background shadow-xl bg-card shrink-0">
                                {profile.avatar_url ? (
                                    <img src={profile.avatar_url} alt={displayName} className="object-cover w-full h-full" />
                                ) : (
                                    <AvatarFallback className="text-3xl bg-secondary text-secondary-foreground font-bold">
                                        {displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                )}
                            </Avatar>

                            <div className="flex-1 text-center sm:text-left pt-2 sm:pt-0 pb-1">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 justify-center sm:justify-start">
                                    <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-foreground">{displayName}</h1>
                                    {isDealer && <VerifiedBadge size="lg" salesCount={dealer.salesCount} />}
                                </div>

                                {/* Follow button — only for logged-in users who are not the dealer themselves */}
                                {user && user.id !== id && (
                                    <button
                                        onClick={() => toggleFollow(id!)}
                                        disabled={loadingFollow}
                                        className={`mt-2 mb-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 ${isFollowing
                                                ? "bg-primary/10 border-primary/30 text-primary hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
                                                : "bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                                            }`}
                                    >
                                        {loadingFollow ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Heart className={`h-4 w-4 transition-all ${isFollowing ? "fill-primary text-primary" : ""}`} />
                                        )}
                                        {isFollowing ? "Siguiendo" : "Seguir dealer"}
                                    </button>
                                )}

                                {dealerInfo?.business_name && dealerInfo.business_name !== profile.full_name && (
                                    <p className="text-sm text-muted-foreground font-medium mb-2">Representante Legal: {profile.full_name}</p>
                                )}

                                <div className="flex flex-wrap text-sm items-center justify-center sm:justify-start gap-x-5 gap-y-2 mt-3 text-muted-foreground font-medium">
                                    <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1 rounded-full">
                                        <MapPin className="h-4 w-4 text-primary" />
                                        {profile.city && profile.state ? `${profile.city}, ${profile.state}` : "Ubicación no especificada"}
                                    </span>
                                    <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1 rounded-full">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        Miembro desde {new Date(profile.created_at).toLocaleDateString("es-VE", { month: "short", year: "numeric" })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Reputation Section */}
                        {tier && (
                            <div className="bg-secondary/40 border border-border/50 rounded-xl p-5 sm:p-6 mt-4 md:mt-6">
                                <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-1.5">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    Nivel de Vendedor
                                </span>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                    <div className="lg:col-span-4 flex flex-col pt-1">
                                        <div className="flex flex-col mb-1 border-l-4 pl-3 py-1" style={{ borderColor: tier.colors.text }}>
                                            <span className={`text-xl font-black ${tier.colors.text} leading-none mb-1`}>
                                                {tier.label}
                                            </span>
                                            <span className="text-sm font-medium text-muted-foreground">
                                                {tier.minSales >= 100 ? '¡Uno de los mejores del sitio!' : `${dealer?.salesCount || 0} ventas concretadas`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-8 space-y-6">
                                        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                                            <ReputationThermometer
                                                percentage={dealerStats.positivePercentage}
                                                totalReviews={dealerStats.totalReviews}
                                                size="lg"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 text-center divide-x divide-border/50">
                                            <div className="flex flex-col justify-center">
                                                <span className="text-2xl font-black text-foreground">{dealer?.salesCount || 0}</span>
                                                <span className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">Ventas<br className="hidden sm:block" />Concretadas</span>
                                            </div>
                                            <div className="flex flex-col justify-center px-2">
                                                <span className="text-2xl font-black text-foreground">{dealerStats.totalReviews > 0 ? `${Math.round(dealerStats.positivePercentage)}%` : 'N/A'}</span>
                                                <span className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">Lo<br className="hidden sm:block" />Recomiendan</span>
                                            </div>
                                            <div className="flex flex-col justify-center">
                                                <span className="text-2xl font-black text-foreground">
                                                    {new Date().getFullYear() - new Date(profile.created_at).getFullYear() || 1}
                                                </span>
                                                <span className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">Años en<br className="hidden sm:block" />Subastandolo</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Reviews Section */}
                <div className="space-y-4">
                    <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                        <Star className="h-5 w-5 text-warning fill-warning" />
                        Reseñas Compartidas ({dealerStats.totalReviews})
                    </h2>

                    {reviewsLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            <p>Este usuario aún no tiene reseñas.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {reviews.map((review) => (
                                <div key={review.id} className="bg-card border border-border rounded-xl p-4 flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-secondary shrink-0 overflow-hidden flex items-center justify-center">
                                        <span className="text-xs font-bold text-secondary-foreground">
                                            {(review.reviewer_name || "Usuario").substring(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className="font-semibold text-sm truncate">{review.reviewer_name || "Usuario Anónimo"}</p>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                {new Date(review.created_at).toLocaleDateString("es-VE")}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-0.5 mb-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={`h-3 w-3 ${star <= review.rating ? "text-warning fill-warning" : "text-muted stroke-muted-foreground"}`}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-sm text-foreground/90">{review.comment || "Sin comentario."}</p>
                                        {/* Seller reply */}
                                        {(review as any).reply_text && (
                                            <div className="mt-2 border-l-2 border-primary/20 pl-3 py-1.5 bg-primary/5 rounded-r-lg">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Store className="h-3 w-3 text-primary" />
                                                    <span className="text-[10px] font-bold text-primary">Respuesta del vendedor</span>
                                                    {(review as any).replied_at && (
                                                        <span className="text-[9px] text-muted-foreground">· {new Date((review as any).replied_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-foreground leading-relaxed">{(review as any).reply_text}</p>
                                            </div>
                                        )}
                                        {review.review_type === "buyer_to_dealer" && (
                                            <span className="inline-block mt-2 text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-sm">
                                                Como Comprador
                                            </span>
                                        )}
                                        {review.review_type === "dealer_to_buyer" && (
                                            <span className="inline-block mt-2 text-[10px] font-medium bg-accent/10 text-accent px-2 py-0.5 rounded-sm">
                                                Como Vendedor
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Products Section */}
                {products.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                            <Store className="h-5 w-5 text-primary dark:text-[#A6E300]" />
                            Productos en venta ({products.length})
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {products.map((p) => {
                                const mainImg = p.images?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))?.[0]?.image_url;
                                return (
                                    <Link key={p.id} to={`/producto/${p.id}`} className="group bg-card border border-border rounded-lg overflow-hidden hover:shadow-md hover:border-border/80 transition-all">
                                        <div className="aspect-square w-full bg-secondary/10 overflow-hidden">
                                            {mainImg ? (
                                                <img src={mainImg} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><Store className="h-6 w-6 text-muted-foreground/20" /></div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 mb-1.5 group-hover:text-primary dark:group-hover:text-[#A6E300] transition-colors">{p.title}</p>
                                            <p className="text-sm font-black text-foreground">${Number(p.price_usd).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                            {bcvRate && bcvRate > 0 && (
                                                <p className="text-[10px] text-muted-foreground">Bs. {(Number(p.price_usd) * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
