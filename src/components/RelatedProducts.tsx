import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Store, ChevronRight } from "lucide-react";
import { useBCVRate } from "@/hooks/useBCVRate";

interface Props {
  productId: string;
  sellerId: string;
  categoryId: string;
  sellerName: string;
}

interface RelatedProduct {
  id: string;
  title: string;
  price: number;
  mainImage: string | null;
  condition: string;
}

export default function RelatedProducts({ productId, sellerId, categoryId, sellerName }: Props) {
  const [sellerProducts, setSellerProducts] = useState<RelatedProduct[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<RelatedProduct[]>([]);
  const bcvRate = useBCVRate();

  useEffect(() => {
    fetchRelated();
  }, [productId, sellerId, categoryId]);

  const fetchRelated = async () => {
    // Fetch other products from same seller
    const { data: sp } = await (supabase
      .from("marketplace_products")
      .select("id, title, price, condition, image_url, images:marketplace_product_images(image_url, display_order)")
      .eq("seller_id", sellerId)
      .eq("status", "active")
      .gt("stock", 0)
      .neq("id", productId)
      .order("created_at", { ascending: false })
      .limit(6) as any);

    setSellerProducts((sp || []).map((p: any) => ({
      ...p,
      mainImage: p.image_url || p.images?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))?.[0]?.image_url || null,
    })));

    // Fetch products from same category (excluding seller's own and current)
    if (categoryId) {
      const { data: cp } = await (supabase
        .from("marketplace_products")
        .select("id, title, price, condition, image_url, images:marketplace_product_images(image_url, display_order)")
        .eq("category_id", categoryId)
        .eq("status", "active")
        .gt("stock", 0)
        .neq("id", productId)
        .neq("seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(6) as any);

      setCategoryProducts((cp || []).map((p: any) => ({
        ...p,
        mainImage: p.image_url || p.images?.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))?.[0]?.image_url || null,
      })));
    }
  };

  const ProductCard = ({ p }: { p: RelatedProduct }) => (
    <Link to={`/producto/${p.id}`} className="group shrink-0 w-44 md:w-48 flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:shadow-md hover:border-border/80 transition-all">
      <div className="relative aspect-square w-full bg-secondary/10 overflow-hidden">
        {p.mainImage ? (
          <img src={p.mainImage} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Store className="h-6 w-6 text-muted-foreground/20" /></div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 mb-1.5 group-hover:text-primary dark:group-hover:text-[#A6E300] transition-colors">{p.title}</p>
        <div className="mt-auto">
          <p className="text-sm font-black text-foreground">${Number(p.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
          {bcvRate && bcvRate > 0 && (
            <p className="text-[10px] text-muted-foreground">Bs. {(Number(p.price) * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          )}
        </div>
      </div>
    </Link>
  );

  if (sellerProducts.length === 0 && categoryProducts.length === 0) return null;

  return (
    <div className="space-y-8">

      {/* Seller Products */}
      {sellerProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-bold">Productos del vendedor</h3>
            <Link to={`/dealer/${sellerId}`} className="text-xs font-semibold text-primary dark:text-[#A6E300] hover:underline flex items-center gap-0.5">
              Ver todos <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {sellerProducts.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Category Products */}
      {categoryProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-bold">También te puede interesar</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {categoryProducts.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
