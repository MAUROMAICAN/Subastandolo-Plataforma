import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon: string;
  level: number;
  position: number;
  is_active: boolean;
  description: string | null;
}

export interface CategoryAttribute {
  id: string;
  category_id: string;
  name: string;
  label: string;
  type: "text" | "number" | "select" | "multiselect" | "boolean";
  options: { value: string; label: string }[];
  required: boolean;
  position: number;
  placeholder: string | null;
  group_name: string;
}

export function useCategories() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["marketplace-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_categories" as any)
        .select("*")
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return (data || []) as unknown as Category[];
    },
    staleTime: 1000 * 60 * 30, // 30 min cache — categories rarely change
  });

  const getRootCategories = () =>
    categories.filter((c) => c.parent_id === null);

  const getChildren = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  const getPath = (categoryId: string): Category[] => {
    const path: Category[] = [];
    let current = categories.find((c) => c.id === categoryId);
    while (current) {
      path.unshift(current);
      current = current.parent_id
        ? categories.find((c) => c.id === current!.parent_id)
        : undefined;
    }
    return path;
  };

  const isLeaf = (categoryId: string) =>
    !categories.some((c) => c.parent_id === categoryId);

  return { categories, isLoading, getRootCategories, getChildren, getPath, isLeaf };
}

export function useCategoryAttributes(categoryId: string | null) {
  return useQuery({
    queryKey: ["category-attributes", categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      const { data, error } = await supabase
        .from("category_attributes" as any)
        .select("*")
        .eq("category_id", categoryId)
        .order("position");
      if (error) throw error;
      return (data || []) as unknown as CategoryAttribute[];
    },
    enabled: !!categoryId,
    staleTime: 1000 * 60 * 30,
  });
}
