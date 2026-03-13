import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Store, User, Info, Eye } from "lucide-react";
import { Link } from "react-router-dom";

export default function DealerProfileTab() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [username, setUsername] = useState("");
    const [storeName, setStoreName] = useState("");
    const [originalUsername, setOriginalUsername] = useState("");
    const [originalStoreName, setOriginalStoreName] = useState("");

    useEffect(() => {
        if (!user?.id) return;
        const fetchProfile = async () => {
            setLoading(true);
            const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
            if (data) {
                const prof = data as any;
                setUsername(prof.username || "");
                setStoreName(prof.store_name || "");
                setOriginalUsername(prof.username || "");
                setOriginalStoreName(prof.store_name || "");
            }
            setLoading(false);
        };
        fetchProfile();
    }, [user?.id]);

    const hasChanges = username !== originalUsername || storeName !== originalStoreName;

    const handleSave = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            const { error } = await supabase.from("profiles").update({
                username: username.trim() || null,
                store_name: storeName.trim() || null,
            } as any).eq("id", user.id);
            if (error) throw error;
            setOriginalUsername(username.trim());
            setOriginalStoreName(storeName.trim());
            toast({ title: "✅ Perfil actualizado", description: "Tu información de tienda ha sido guardada." });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-heading font-bold text-foreground">Identidad de tu Tienda</h2>
                <p className="text-sm text-muted-foreground mt-1">Personaliza cómo te ven los compradores cuando visitan tu tienda.</p>
            </div>

            {/* Info banner */}
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4 flex gap-3">
                <Info className="h-5 w-5 text-primary dark:text-[#A6E300] shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong className="text-foreground">¿Cómo se usa esta información?</strong></p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li><strong>Nombre de usuario</strong> — Se muestra en tus subastas y productos. Si no lo configuras, se usará tu nombre real.</li>
                        <li><strong>Nombre de tienda</strong> (opcional) — Aparece como título en tu <strong>página de tienda</strong>. Ideal si tienes una marca o negocio. Si lo dejas vacío, se usará tu nombre de usuario.</li>
                    </ul>
                </div>
            </div>

            {/* Fields */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
                {/* Username */}
                <div className="space-y-2">
                    <Label htmlFor="dealer-username" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        Nombre de usuario
                    </Label>
                    <Input
                        id="dealer-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ej: keyko_oficial, juanelectronics..."
                        className="max-w-md"
                        maxLength={30}
                    />
                    <p className="text-[11px] text-muted-foreground">Máx. 30 caracteres. Se mostrará en tus publicaciones.</p>
                </div>

                {/* Store Name */}
                <div className="space-y-2">
                    <Label htmlFor="dealer-store-name" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Store className="h-3.5 w-3.5 text-muted-foreground" />
                        Nombre de tu tienda <span className="text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Input
                        id="dealer-store-name"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="Ej: Keyko Venezuela, Electrónicos J&M..."
                        className="max-w-md"
                        maxLength={50}
                    />
                    <p className="text-[11px] text-muted-foreground">Máx. 50 caracteres. Se usará como título en tu página de tienda.</p>
                </div>

                {/* Save */}
                <div className="flex items-center gap-3 pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="rounded-xl gap-1.5 font-bold"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar cambios
                    </Button>

                    {user?.id && (
                        <Link
                            to={`/tienda-vendedor/${user.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-[#A6E300] hover:underline"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Ver mi tienda
                        </Link>
                    )}
                </div>
            </div>

            {/* Preview */}
            <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Vista previa</p>
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
                        <Store className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <div>
                        <p className="font-heading font-black text-lg text-foreground">{storeName || username || "Tu tienda"}</p>
                        <p className="text-xs text-muted-foreground">por {username || "tu nombre de usuario"}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
