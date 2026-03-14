import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Store, ChevronRight, X, Gavel, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/hooks/useCategories";
import { useBCVRate } from "@/hooks/useBCVRate";
import {
  Smartphone, Laptop, Tv, Refrigerator,
  Shirt, Footprints, Watch, Sparkles,
  Car, Dumbbell, Gamepad2, Sofa,
  Wrench, Baby, Briefcase, Package, ShoppingBag,
} from "lucide-react";

// Icon mapping (same as CategorySelector)
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "celulares": <Smartphone className="h-4 w-4" />,
  "computacion": <Laptop className="h-4 w-4" />,
  "electronica": <Tv className="h-4 w-4" />,
  "electrodomesticos": <Refrigerator className="h-4 w-4" />,
  "ropa": <Shirt className="h-4 w-4" />,
  "calzado": <Footprints className="h-4 w-4" />,
  "relojes": <Watch className="h-4 w-4" />,
  "perfumes": <Sparkles className="h-4 w-4" />,
  "vehiculos": <Car className="h-4 w-4" />,
  "deportes": <Dumbbell className="h-4 w-4" />,
  "gaming": <Gamepad2 className="h-4 w-4" />,
  "hogar": <Sofa className="h-4 w-4" />,
  "herramientas": <Wrench className="h-4 w-4" />,
  "bebes": <Baby className="h-4 w-4" />,
  "bolsos": <Briefcase className="h-4 w-4" />,
  "otros": <Package className="h-4 w-4" />,
};

function getCatIcon(slug: string) {
  const prefix = Object.keys(CATEGORY_ICONS).find(key => slug.startsWith(key));
  return prefix ? CATEGORY_ICONS[prefix] : <ShoppingBag className="h-4 w-4" />;
}

const CONDITION_MAP: Record<string, string> = {
  nuevo: "Nuevo",
  usado_buen_estado: "Usado",
  usado_regular: "Regular",
  para_reparar: "Para reparar",
  new: "Nuevo",
  used: "Usado",
};

export default function MarketplaceHome() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const bcvRate = useBCVRate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getRootCategories, getChildren } = useCategories();
  const rootCategories = getRootCategories();

  const activeCatId = searchParams.get("cat") || null;
  const activeSubCatId = searchParams.get("sub") || null;

  // Get subcategories for active parent
  const subcategories = activeCatId ? getChildren(activeCatId) : [];
  const activeCategory = rootCategories.find(c => c.id === activeCatId);

  useEffect(() => {
    fetchProducts();
  }, [activeCatId, activeSubCatId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("marketplace_products")
        .select(`
          id, title, price, stock, condition, image_url, created_at, category_id, seller_id,
          listing_type, current_price, starting_price, end_time, listing_tier,
          images:marketplace_product_images(image_url, display_order),
          category:marketplace_categories(id, name, slug)
        `)
        .eq("status", "active")
        .gt("stock", 0)
        .order("created_at", { ascending: false })
        .limit(60);

      // Filter by subcategory (specific) or parent category (all children)
      if (activeSubCatId) {
        query = query.eq("category_id", activeSubCatId);
      } else if (activeCatId) {
        // Get all child category IDs
        const childIds = getChildren(activeCatId).map(c => c.id);
        if (childIds.length > 0) {
          query = query.in("category_id", [activeCatId, ...childIds]);
        } else {
          query = query.eq("category_id", activeCatId);
        }
      }

      const { data, error } = await (query as any);
      if (error) throw error;

      // Fetch seller names separately (seller_id references auth.users, not profiles directly)
      const sellerIds = [...new Set((data || []).map((p: any) => p.seller_id).filter(Boolean))];
      let sellerMap: Record<string, string> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", sellerIds);
        sellerMap = (sellers || []).reduce((acc: any, s: any) => ({ ...acc, [s.id]: s.full_name }), {});
      }

      const enriched = (data || []).map((p: any) => ({
        ...p,
        images: p.images?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)) || [],
        mainImage: p.image_url || p.images?.[0]?.image_url || null,
        sellerName: sellerMap[p.seller_id] || "Vendedor",
      }));
      // Sort: premium first, then standard, then free
      const tierOrder: Record<string, number> = { premium: 0, standard: 1, free: 2 };
      enriched.sort((a: any, b: any) => {
        const tA = tierOrder[(a as any).listing_tier || 'free'] ?? 2;
        const tB = tierOrder[(b as any).listing_tier || 'free'] ?? 2;
        if (tA !== tB) return tA - tB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setProducts(enriched);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = searchTerm.trim()
    ? products.filter(p =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.seller?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : products;

  const selectCategory = (catId: string | null) => {
    const params = new URLSearchParams();
    if (catId) params.set("cat", catId);
    setSearchParams(params);
  };

  const selectSubCategory = (subId: string) => {
    const params = new URLSearchParams();
    if (activeCatId) params.set("cat", activeCatId);
    params.set("sub", subId);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearchTerm("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Search Header */}
      <section className="bg-card border-b border-border">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/tienda" className="shrink-0" onClick={() => clearFilters()}>
              <h1 className="text-xl font-heading font-bold text-foreground">Tienda</h1>
            </Link>
            <div className="flex-1 relative max-w-2xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar productos, marcas y más..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 rounded-lg border-border bg-background text-sm"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category Navigation — dropdown on mobile, pills on desktop */}

          {/* Mobile: clean dropdown */}
          <div className="md:hidden space-y-2">
            <select
              value={activeCatId || ""}
              onChange={(e) => selectCategory(e.target.value || null)}
              className="w-full h-10 rounded-lg border border-border bg-background text-foreground text-sm font-medium px-3 appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="">Todas las categorías</option>
              {rootCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {subcategories.length > 0 && (
              <select
                value={activeSubCatId || ""}
                onChange={(e) => {
                  if (e.target.value) selectSubCategory(e.target.value);
                  else if (activeCatId) selectCategory(activeCatId);
                }}
                className="w-full h-10 rounded-lg border border-border bg-background text-foreground text-sm font-medium px-3 appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                <option value="">Todas en {activeCategory?.name}</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Desktop: pills */}
          <div className="hidden md:flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => selectCategory(null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!activeCatId
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                }`}
            >
              Todas
            </button>
            {rootCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeCatId === cat.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                  }`}
              >
                {getCatIcon(cat.slug)}
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Subcategory chips — desktop only */}
          {subcategories.length > 0 && (
            <div className="hidden md:flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground mr-1 uppercase tracking-wider font-semibold">
                {activeCategory?.name}
              </span>
              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => selectSubCategory(sub.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${activeSubCatId === sub.id
                    ? "bg-primary/10 text-primary dark:text-[#A6E300] border-primary/30 dark:border-[#A6E300]/30"
                    : "bg-transparent text-muted-foreground border-border/50 hover:border-primary/20 hover:text-foreground"
                    }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Breadcrumb + Results count */}
      <div className="container mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/tienda" className="hover:text-foreground" onClick={() => clearFilters()}>Tienda</Link>
          {activeCategory && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{activeCategory.name}</span>
            </>
          )}
          {activeSubCatId && subcategories.find(s => s.id === activeSubCatId) && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{subcategories.find(s => s.id === activeSubCatId)?.name}</span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {filteredProducts.length} resultado{filteredProducts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Products Grid */}
      <main className="flex-1 container mx-auto px-4 pb-12 max-w-7xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Cargando productos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-16 w-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
              <Search className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h2 className="text-lg font-heading font-bold mb-2">No se encontraron productos</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {searchTerm ? `No hay resultados para "${searchTerm}"` : "No hay productos disponibles en esta categoría."}
            </p>
            {(searchTerm || activeCatId) && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-lg">
                <X className="h-3.5 w-3.5 mr-1.5" /> Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map((product) => {
              const mainImg = product.mainImage || product.images?.[0]?.image_url;
              return (
                <Link to={`/producto/${product.id}`} key={product.id} className="group flex">
                  <div className="w-full flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:shadow-md hover:border-border/80 transition-all duration-200">
                    {/* Image */}
                    <div className="relative aspect-square w-full bg-secondary/10 overflow-hidden">
                      {mainImg ? (
                        <img
                          src={mainImg}
                          alt={product.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store className="h-8 w-8 text-muted-foreground/20" />
                        </div>
                      )}
                      {/* Condition badge */}
                      {product.condition && product.condition !== "nuevo" && product.condition !== "new" && (
                        <span className="absolute top-2 left-2 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {CONDITION_MAP[product.condition] || product.condition}
                        </span>
                      )}
                      {/* Listing type badge */}
                      {product.listing_type === 'auction' && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Gavel className="h-2.5 w-2.5" /> Subasta
                        </span>
                      )}
                      {product.listing_type === 'accepts_offers' && (
                        <span className="absolute top-2 right-2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <MessageSquare className="h-2.5 w-2.5" /> Ofertas
                        </span>
                      )}
                      {/* Premium tier badge */}
                      {(product as any).listing_tier === 'premium' && (
                        <span className="absolute bottom-2 left-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                          ✨ Premium
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 flex-1 flex flex-col">
                      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 mb-2 group-hover:text-primary dark:group-hover:text-[#A6E300] transition-colors">
                        {product.title}
                      </p>
                      <div className="mt-auto">
                        <p className="text-lg font-black text-foreground">
                          ${Number(product.listing_type === 'auction' && product.current_price > 0 ? product.current_price : product.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </p>
                        {product.listing_type === 'auction' && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            {product.current_price > 0 ? 'Puja actual' : 'Precio inicial'}
                          </p>
                        )}
                        {bcvRate && bcvRate > 0 && (
                          <p className="text-[11px] text-muted-foreground font-medium">
                            Bs. {(Number(product.price) * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        )}
                        {product.stock > 1 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {product.stock} disponibles
                          </p>
                        )}
                      </div>
                    </div>
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
