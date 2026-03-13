import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, FolderTree, Plus, Trash2, ChevronDown, ChevronRight, Pencil, Check, X, GripVertical, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon: string;
  level: number;
  position: number;
  is_active: boolean;
  description: string | null;
  product_count?: number;
}

export default function AdminCategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // New category form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📦");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { toast } = useToast();

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from("marketplace_categories" as any)
        .select("*")
        .order("position") as any);
      if (error) throw error;

      // Count products per category
      const { data: products } = await (supabase
        .from("marketplace_products")
        .select("category_id")
        .eq("status", "active") as any);

      const countMap: Record<string, number> = {};
      (products || []).forEach((p: any) => {
        countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      });

      setCategories((data || []).map((c: any) => ({
        ...c,
        product_count: countMap[c.id] || 0,
      })));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const roots = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    setSavingId(id);
    try {
      await (supabase.from("marketplace_categories" as any).update({ is_active: active } as any).eq("id", id) as any);
      setCategories(prev => prev.map(c => c.id === id ? { ...c, is_active: active } : c));
      toast({ title: active ? "✅ Categoría activada" : "⏸️ Categoría desactivada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSavingId(editingId);
    try {
      const slug = editName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await (supabase.from("marketplace_categories" as any).update({ name: editName.trim(), icon: editIcon, slug } as any).eq("id", editingId) as any);
      setCategories(prev => prev.map(c => c.id === editingId ? { ...c, name: editName.trim(), icon: editIcon, slug } : c));
      toast({ title: "✅ Categoría actualizada" });
      setEditingId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setSavingId(id);
    try {
      await (supabase.from("marketplace_categories" as any).delete().eq("id", id) as any);
      setCategories(prev => prev.filter(c => c.id !== id && c.parent_id !== id));
      toast({ title: "🗑️ Categoría eliminada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const level = newParentId ? 1 : 0;
      const position = categories.filter(c => c.parent_id === newParentId).length;
      const { error } = await (supabase.from("marketplace_categories" as any).insert({
        name: newName.trim(),
        slug,
        icon: newIcon,
        parent_id: newParentId,
        level,
        position,
        is_active: true,
      } as any) as any);
      if (error) throw error;
      toast({ title: "✅ Categoría creada" });
      setNewName(""); setNewIcon("📦"); setNewParentId(null); setShowAdd(false);
      fetchCategories();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const renderCategory = (cat: Category, depth = 0) => {
    const children = getChildren(cat.id);
    const isExpanded = expandedIds.has(cat.id);
    const isEditing = editingId === cat.id;

    return (
      <div key={cat.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2.5 border-b border-border/40 hover:bg-secondary/30 transition-colors group ${depth > 0 ? "pl-10" : ""} ${!cat.is_active ? "opacity-50" : ""}`}
        >
          {/* Expand toggle */}
          {children.length > 0 ? (
            <button onClick={() => toggleExpand(cat.id)} className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <div className="h-6 w-6 shrink-0" />
          )}

          {/* Icon */}
          {isEditing ? (
            <Input value={editIcon} onChange={e => setEditIcon(e.target.value)} className="w-12 h-7 text-center text-sm p-0 rounded-sm" maxLength={4} />
          ) : (
            <span className="text-base shrink-0">{cat.icon}</span>
          )}

          {/* Name */}
          {isEditing ? (
            <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-sm flex-1 rounded-sm" autoFocus />
          ) : (
            <span className="text-sm font-medium text-foreground flex-1 truncate">{cat.name}</span>
          )}

          {/* Product count */}
          {!isEditing && cat.product_count != null && cat.product_count > 0 && (
            <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
              <Package className="h-2.5 w-2.5 mr-0.5" />{cat.product_count}
            </Badge>
          )}

          {/* Level badge */}
          {!isEditing && depth === 0 && (
            <Badge variant="outline" className="text-[9px] shrink-0">
              {children.length} sub
            </Badge>
          )}

          {/* Edit actions */}
          {isEditing ? (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={handleSaveEdit} disabled={savingId === cat.id}>
                {savingId === cat.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleStartEdit(cat)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar "{cat.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {children.length > 0
                        ? `Esto eliminará también ${children.length} subcategoría(s). Los productos en estas categorías quedarán sin categoría.`
                        : "Los productos en esta categoría quedarán sin categoría."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(cat.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Active toggle */}
          <Switch
            checked={cat.is_active}
            onCheckedChange={(v) => handleToggleActive(cat.id, v)}
            disabled={savingId === cat.id}
            className="shrink-0"
          />
        </div>
        {/* Children */}
        {isExpanded && children.map(child => renderCategory(child, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary dark:text-[#A6E300]" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-primary dark:text-accent" />
          <div>
            <h3 className="font-heading font-bold text-sm">Categorías del Marketplace</h3>
            <p className="text-[10px] text-muted-foreground">{roots.length} categorías raíz · {categories.length} total</p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground rounded-sm text-xs h-8 gap-1.5"
          onClick={() => { setShowAdd(!showAdd); setNewParentId(null); }}
        >
          <Plus className="h-3.5 w-3.5" /> Nueva Categoría
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 space-y-3 animate-fade-in">
          <p className="text-xs font-bold text-foreground">Crear Nueva Categoría</p>
          <div className="grid grid-cols-[60px_1fr] gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Icono</Label>
              <Input value={newIcon} onChange={e => setNewIcon(e.target.value)} className="h-9 text-center text-lg rounded-sm" maxLength={4} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Nombre</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Electrónica" className="h-9 rounded-sm text-sm" autoFocus />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Categoría padre (opcional)</Label>
            <select
              value={newParentId || ""}
              onChange={e => setNewParentId(e.target.value || null)}
              className="w-full h-9 rounded-sm border border-input bg-background px-3 text-sm"
            >
              <option value="">Sin padre (categoría raíz)</option>
              {roots.map(r => (
                <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="rounded-sm text-xs bg-primary text-primary-foreground" onClick={handleAdd} disabled={adding || !newName.trim()}>
              {adding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />} Crear
            </Button>
            <Button size="sm" variant="outline" className="rounded-sm text-xs" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Category tree */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="bg-secondary/30 px-3 py-2 border-b border-border flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="flex-1">Categoría</span>
          <span className="w-16 text-center">Activa</span>
        </div>
        {roots.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No hay categorías</div>
        ) : (
          roots.map(cat => renderCategory(cat))
        )}
      </div>
    </div>
  );
}
