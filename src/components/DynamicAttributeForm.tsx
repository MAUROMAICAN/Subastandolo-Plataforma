import { useCategoryAttributes, type CategoryAttribute } from "@/hooks/useCategories";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface Props {
  categoryId: string | null;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export default function DynamicAttributeForm({ categoryId, values, onChange }: Props) {
  const { data: attributes = [], isLoading } = useCategoryAttributes(categoryId);

  if (!categoryId || isLoading) return null;
  if (attributes.length === 0) return null;

  const grouped = attributes.reduce<Record<string, CategoryAttribute[]>>((acc, attr) => {
    const group = attr.group_name || "Características";
    if (!acc[group]) acc[group] = [];
    acc[group].push(attr);
    return acc;
  }, {});

  const handleChange = (name: string, value: string) => {
    onChange({ ...values, [name]: value });
  };

  const handleMultiToggle = (name: string, optionValue: string) => {
    const current = values[name] ? values[name].split(",").filter(Boolean) : [];
    const updated = current.includes(optionValue)
      ? current.filter((v) => v !== optionValue)
      : [...current, optionValue];
    onChange({ ...values, [name]: updated.join(",") });
  };

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        📋 Características del producto
      </h3>

      {Object.entries(grouped).map(([groupName, attrs]) => (
        <div key={groupName} className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {groupName}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attrs.map((attr) => (
              <div key={attr.id} className="space-y-1.5">
                <label className="text-sm text-foreground flex items-center gap-1">
                  {attr.label}
                  {attr.required && <span className="text-destructive">*</span>}
                </label>

                {attr.type === "text" && (
                  <Input
                    placeholder={attr.placeholder || ""}
                    value={values[attr.name] || ""}
                    onChange={(e) => handleChange(attr.name, e.target.value)}
                    className="h-10 rounded-xl"
                  />
                )}

                {attr.type === "number" && (
                  <Input
                    type="number"
                    placeholder={attr.placeholder || ""}
                    value={values[attr.name] || ""}
                    onChange={(e) => handleChange(attr.name, e.target.value)}
                    className="h-10 rounded-xl"
                  />
                )}

                {attr.type === "select" && (
                  <Select
                    value={values[attr.name] || ""}
                    onValueChange={(v) => handleChange(attr.name, v)}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder={attr.placeholder || "Selecciona..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {(attr.options || []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {attr.type === "multiselect" && (
                  <div className="flex flex-wrap gap-1.5">
                    {(attr.options || []).map((opt) => {
                      const selected = (values[attr.name] || "").split(",").includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleMultiToggle(attr.name, opt.value)}
                          className={`
                            px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                            ${selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:border-primary/50"}
                          `}
                        >
                          {opt.label}
                          {selected && <X className="inline h-3 w-3 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {attr.type === "boolean" && (
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={values[attr.name] === "true"}
                      onCheckedChange={(checked) => handleChange(attr.name, checked ? "true" : "false")}
                    />
                    <span className="text-sm text-muted-foreground">
                      {values[attr.name] === "true" ? "Sí" : "No"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
