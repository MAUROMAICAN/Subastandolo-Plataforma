import { useState } from "react";
import { useCategories, type Category } from "@/hooks/useCategories";
import {
  ChevronRight, Search, X, ChevronLeft,
  Smartphone, Laptop, Tv, Refrigerator,
  Shirt, Footprints, Watch, Sparkles,
  Car, Dumbbell, Gamepad2, Sofa,
  Wrench, Baby, Briefcase, Package,
  ShoppingBag,
} from "lucide-react";
import { Input } from "@/components/ui/input";

// Professional icon mapping by slug prefix
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "celulares": <Smartphone className="h-5 w-5" />,
  "smartphones": <Smartphone className="h-5 w-5" />,
  "smartwatches": <Watch className="h-5 w-5" />,
  "computacion": <Laptop className="h-5 w-5" />,
  "laptops": <Laptop className="h-5 w-5" />,
  "electronica": <Tv className="h-5 w-5" />,
  "televisores": <Tv className="h-5 w-5" />,
  "electrodomesticos": <Refrigerator className="h-5 w-5" />,
  "ropa": <Shirt className="h-5 w-5" />,
  "calzado": <Footprints className="h-5 w-5" />,
  "relojes": <Watch className="h-5 w-5" />,
  "perfumes": <Sparkles className="h-5 w-5" />,
  "vehiculos": <Car className="h-5 w-5" />,
  "deportes": <Dumbbell className="h-5 w-5" />,
  "gaming": <Gamepad2 className="h-5 w-5" />,
  "hogar": <Sofa className="h-5 w-5" />,
  "herramientas": <Wrench className="h-5 w-5" />,
  "bebes": <Baby className="h-5 w-5" />,
  "bolsos": <Briefcase className="h-5 w-5" />,
  "otros": <Package className="h-5 w-5" />,
};

function getCategoryIcon(slug: string): React.ReactNode {
  // Try exact match first, then try prefix match
  if (CATEGORY_ICONS[slug]) return CATEGORY_ICONS[slug];
  const prefix = Object.keys(CATEGORY_ICONS).find(key => slug.startsWith(key));
  return prefix ? CATEGORY_ICONS[prefix] : <ShoppingBag className="h-5 w-5" />;
}

interface Props {
  selectedCategoryId: string | null;
  onSelect: (category: Category) => void;
  onClear: () => void;
}

export default function CategorySelector({ selectedCategoryId, onSelect, onClear }: Props) {
  const { categories, isLoading, getRootCategories, getChildren, getPath } = useCategories();
  const [browsePath, setBrowsePath] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const currentParentId = browsePath.length > 0 ? browsePath[browsePath.length - 1] : null;
  const displayedCategories = currentParentId
    ? getChildren(currentParentId)
    : getRootCategories();

  const filtered = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : displayedCategories;

  const breadcrumb = browsePath.map((id) => categories.find((c) => c.id === id)!).filter(Boolean);
  const selectedPath = selectedCategoryId ? getPath(selectedCategoryId) : [];

  const handleCategoryClick = (cat: Category) => {
    const children = getChildren(cat.id);
    if (children.length > 0 && !search.trim()) {
      setBrowsePath((p) => [...p, cat.id]);
    } else {
      onSelect(cat);
    }
  };

  const goBack = () => {
    setBrowsePath((p) => p.slice(0, -1));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show selected badge if already chosen
  if (selectedCategoryId && selectedPath.length > 0) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoría seleccionada</label>
        <div className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-secondary/30">
          <div className="h-9 w-9 rounded-lg bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center text-primary dark:text-[#A6E300] shrink-0">
            {getCategoryIcon(selectedPath[selectedPath.length - 1].slug)}
          </div>
          <div className="flex items-center gap-1.5 text-sm flex-1 flex-wrap min-w-0">
            {selectedPath.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                <span className={i === selectedPath.length - 1
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground text-xs"
                }>
                  {p.name}
                </span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onClear(); setBrowsePath([]); setSearch(""); }}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {browsePath.length > 0 ? "Selecciona subcategoría" : "Selecciona la categoría"}
      </label>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar categoría..."
          className="pl-9 h-10 rounded-lg border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Back button + Breadcrumb */}
      {breadcrumb.length > 0 && !search && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-xs font-medium text-primary dark:text-[#A6E300] hover:underline"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Volver
          </button>
          <span className="text-xs text-muted-foreground/50">|</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />}
                <span className={i === breadcrumb.length - 1 ? "font-medium text-foreground" : ""}>
                  {crumb.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
        {filtered.map((cat) => {
          const hasChildren = getChildren(cat.id).length > 0 && !search.trim();
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-transparent hover:border-border hover:bg-secondary/40 transition-all text-left group"
            >
              <div className="h-9 w-9 rounded-lg bg-secondary/60 group-hover:bg-primary/10 dark:group-hover:bg-[#A6E300]/10 flex items-center justify-center text-muted-foreground group-hover:text-primary dark:group-hover:text-[#A6E300] transition-colors shrink-0">
                {getCategoryIcon(cat.slug)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary dark:group-hover:text-[#A6E300] transition-colors">
                  {cat.name}
                </p>
                {search.trim() && cat.level > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {getPath(cat.id).map((p) => p.name).join(" › ")}
                  </p>
                )}
                {!search.trim() && cat.description && cat.level === 0 && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {cat.description}
                  </p>
                )}
              </div>
              {hasChildren && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary dark:group-hover:text-[#A6E300] shrink-0 transition-colors" />
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No se encontraron categorías{search ? ` para "${search}"` : ""}
        </p>
      )}
    </div>
  );
}
