import { useState } from "react";
import { useCategories, type Category } from "@/hooks/useCategories";
import { ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  selectedCategoryId: string | null;
  onSelect: (category: Category) => void;
  onClear: () => void;
}

export default function CategorySelector({ selectedCategoryId, onSelect, onClear }: Props) {
  const { categories, isLoading, getRootCategories, getChildren, getPath, isLeaf } = useCategories();
  const [browsePath, setBrowsePath] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // Currently browsing this level
  const currentParentId = browsePath.length > 0 ? browsePath[browsePath.length - 1] : null;
  const displayedCategories = currentParentId
    ? getChildren(currentParentId)
    : getRootCategories();

  // Search filter
  const filtered = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : displayedCategories;

  // Breadcrumb path
  const breadcrumb = browsePath.map((id) => categories.find((c) => c.id === id)!).filter(Boolean);

  // Selected category path
  const selectedPath = selectedCategoryId ? getPath(selectedCategoryId) : [];

  const handleCategoryClick = (cat: Category) => {
    const children = getChildren(cat.id);
    if (children.length > 0 && !search.trim()) {
      // Drill down
      setBrowsePath((p) => [...p, cat.id]);
    } else {
      // Leaf — select
      onSelect(cat);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) {
      setBrowsePath([]);
    } else {
      setBrowsePath((p) => p.slice(0, index + 1));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Show selected badge if already chosen
  if (selectedCategoryId && selectedPath.length > 0) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Categoría</label>
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
          <span className="text-xl">{selectedPath[selectedPath.length - 1].icon}</span>
          <div className="flex items-center gap-1 text-sm flex-1 flex-wrap">
            {selectedPath.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <span className={i === selectedPath.length - 1 ? "font-semibold text-primary" : "text-muted-foreground"}>
                  {p.name}
                </span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onClear(); setBrowsePath([]); setSearch(""); }}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Selecciona la categoría del producto
      </label>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar categoría..."
          className="pl-9 h-10 rounded-xl"
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

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && !search && (
        <div className="flex items-center gap-1 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => handleBreadcrumbClick(-1)}
            className="text-primary hover:underline font-medium"
          >
            Todas
          </button>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(i)}
                className={
                  i === breadcrumb.length - 1
                    ? "font-semibold text-foreground"
                    : "text-primary hover:underline"
                }
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Category grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
        {filtered.map((cat) => {
          const hasChildren = getChildren(cat.id).length > 0 && !search.trim();
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat)}
              className="flex items-center gap-2 px-3 py-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left group"
            >
              <span className="text-2xl flex-shrink-0">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {cat.name}
                </p>
                {search.trim() && cat.level > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {getPath(cat.id).map((p) => p.name).join(" > ")}
                  </p>
                )}
              </div>
              {hasChildren && (
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No se encontraron categorías{search ? ` para "${search}"` : ""}
        </p>
      )}
    </div>
  );
}
