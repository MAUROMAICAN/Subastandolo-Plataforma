import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVerifiedDealer } from "@/hooks/useVerifiedDealers";
import { useUserReviews } from "@/hooks/useReviews";
import { useBCVRate } from "@/hooks/useBCVRate";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerifiedBadge, { getDealerTier } from "@/components/VerifiedBadge";
import { Loader2, MapPin, Store, ImagePlus, ShieldCheck, Package, Star } from "lucide-react";

export default function DealerStorePage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const dealer = useVerifiedDealer(id);
    const { dealerStats } = useUserReviews(id);
    const bcvRate = useBCVRate();

    const [profile, setProfile] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string>("all");

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            setLoading(true);
            // Fetch profile
            const { data: prof } = await supabase.from("profiles").select("*").eq("id", id).single();
            setProfile(prof);
            // Fetch products
            const { data: prods } = await (supabase
                .from("marketplace_products")
                .select("id, title, price, price_usd, condition, stock, category_id, listing_type, images:marketplace_product_images(image_url, display_order), category:marketplace_categories(id, name)")
                .eq("seller_id", id)
                .eq("status", "active")
                .gt("stock", 0)
                .order("created_at", { ascending: false }) as any);
            setProducts(prods || []);
            setLoading(false);
        };
        fetchData();
    }, [id]);

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
            const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (updated) setProfile(updated);
        } catch (err: any) {
            console.error('Banner upload error:', err);
        } finally {
            setUploadingBanner(false);
        }
    };

    const isVerified = dealer && dealer.isVerified;
    const salesCount = dealer ? (dealer as any).salesCount : 0;
    const tier = isVerified ? getDealerTier(salesCount) : null;

    // Get unique categories from products
    const categories = products.reduce((acc: { id: string; name: string }[], p) => {
        const cat = (p.category as any);
        if (cat && !acc.find(c => c.id === cat.id)) acc.push({ id: cat.id, name: cat.name });
        return acc;
    }, []);

    const filteredProducts = activeCategory === "all"
        ? products
        : products.filter(p => (p.category as any)?.id === activeCategory);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <Navbar />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <Footer />
            </div>
        );
    }

    const dealerName = profile?.store_name || profile?.username || profile?.full_name || "Tienda";
    const bannerUrl = profile?.store_banner_url;
    const avatarUrl = profile?.avatar_url;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            {/* ── BANNER ── */}
            <div className="relative w-full h-44 sm:h-60 md:h-72 overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
                {bannerUrl ? (
                    <img src={bannerUrl} alt="Store banner" className="w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/20" />
                )}
                {/* Strong multi-layer gradient for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />

                {/* Banner upload — only for the dealer themselves */}
                {user && user.id === id && (
                    <label className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors z-10 backdrop-blur-sm border border-white/10">
                        {uploadingBanner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                        {uploadingBanner ? 'Subiendo...' : 'Personalizar banner'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
                    </label>
                )}

                {/* Store identity overlay */}
                <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-5">
                    <div className="container mx-auto max-w-6xl flex items-end gap-4">
                        {/* Avatar */}
                        <div className="h-18 w-18 sm:h-22 sm:w-22 rounded-xl border-3 border-white/20 shadow-2xl overflow-hidden bg-card shrink-0" style={{ height: '4.5rem', width: '4.5rem' }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={dealerName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-secondary">
                                    <Store className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-black text-white truncate" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' }}>{dealerName}</h1>
                                {isVerified && <VerifiedBadge size="md" salesCount={salesCount} />}
                            </div>
                            {profile?.city && (
                                <p className="text-white/80 text-xs sm:text-sm flex items-center gap-1 mt-1" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                                    <MapPin className="h-3.5 w-3.5" /> {profile.city}{profile.state ? `, ${profile.state}` : ""}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── STATS BAR ── */}
            <div className="border-b border-border bg-card/50">
                <div className="container mx-auto max-w-6xl px-4 sm:px-8 py-3 flex items-center gap-6 flex-wrap text-sm">
                    {isVerified && tier && (
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck className={`h-4 w-4 ${tier.colors.text}`} />
                            <span className={`font-bold ${tier.colors.text}`}>{tier.label}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                        <span><strong className="text-foreground">{products.length}</strong> productos</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Star className="h-3.5 w-3.5" />
                        <span><strong className="text-foreground">{salesCount}</strong> ventas</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span><strong className="text-foreground">{dealerStats.positivePercentage}%</strong> reputación</span>
                    </div>
                </div>
            </div>

            {/* ── CATEGORY TABS ── */}
            {categories.length > 1 && (
                <div className="border-b border-border bg-card/30">
                    <div className="container mx-auto max-w-6xl px-4 sm:px-8">
                        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
                            <button
                                onClick={() => setActiveCategory("all")}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                                    activeCategory === "all"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                                }`}
                            >
                                Todos los productos
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                                        activeCategory === cat.id
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── PRODUCTS GRID ── */}
            <main className="flex-1 container mx-auto max-w-6xl px-4 sm:px-8 py-6">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/5 dark:bg-primary/10 mb-4">
                            <Store className="h-10 w-10 text-primary/30 dark:text-[#A6E300]/30" />
                        </div>
                        <p className="text-lg font-bold text-foreground mb-2">Esta tienda aún no tiene productos publicados</p>
                        <p className="text-sm text-muted-foreground mb-4">Los productos aparecerán aquí cuando el vendedor los publique</p>
                        {user && user.id === id && (
                            <Link
                                to="/dealer"
                                className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-accent/20"
                            >
                                <Package className="h-4 w-4" />
                                Publicar mi primer producto
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        {filteredProducts.map((p) => {
                            const mainImg = p.images?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))?.[0]?.image_url;
                            return (
                                <Link key={p.id} to={`/producto/${p.id}`} className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300">
                                    <div className="aspect-square w-full bg-secondary/10 overflow-hidden">
                                        {mainImg ? (
                                            <img src={mainImg} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center"><Store className="h-8 w-8 text-muted-foreground/15" /></div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="text-xs sm:text-sm font-medium text-foreground leading-snug line-clamp-2 mb-2 group-hover:text-primary dark:group-hover:text-[#A6E300] transition-colors">{p.title}</p>
                                        <p className="text-base sm:text-lg font-black text-foreground">${Number(p.price || p.price_usd || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                        {bcvRate && bcvRate > 0 && (
                                            <p className="text-[10px] sm:text-[11px] text-muted-foreground">Bs. {(Number(p.price || p.price_usd || 0) * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        )}
                                        {p.condition && (
                                            <span className={`mt-1.5 inline-flex text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${
                                                ['new', 'nuevo'].includes(p.condition) ? 'bg-green-500/10 text-green-600 border-green-400/30' :
                                                ['used', 'usado_buen_estado'].includes(p.condition) ? 'bg-blue-500/10 text-blue-600 border-blue-400/30' :
                                                'bg-orange-500/10 text-orange-600 border-orange-400/30'
                                            }`}>
                                                {p.condition === 'new' || p.condition === 'nuevo' ? 'Nuevo' : p.condition === 'used' || p.condition === 'usado_buen_estado' ? 'Usado' : p.condition === 'usado_regular' ? 'Regular' : p.condition === 'para_reparar' ? 'Para reparar' : 'Usado'}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
