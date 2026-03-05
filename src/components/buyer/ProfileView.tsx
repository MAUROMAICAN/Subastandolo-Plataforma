import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, User, MapPin, CreditCard, Lock, CheckCircle2, ChevronDown, ChevronUp, Shield, Phone } from "lucide-react";
import ProfileAvatarUpload from "@/components/ProfileAvatarUpload";
import ProfileCompletionBar from "@/components/ProfileCompletionBar";

const STATES = [
    "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo",
    "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "Lara",
    "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre",
    "Táchira", "Trujillo", "Vargas", "Yaracuy", "Zulia",
];

interface ProfileViewProps {
    profile: any;
    user: any;
    refreshProfile: () => void;
    onBack: () => void;
}

/** A field that is locked once the profile is complete */
function LockedField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                {icon} {label}
            </label>
            <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-secondary/30 dark:bg-white/5">
                <span className="flex-1 text-sm text-foreground truncate">{value || "—"}</span>
                <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            </div>
        </div>
    );
}

export default function ProfileView({ profile, user, refreshProfile, onBack }: ProfileViewProps) {
    const { toast } = useToast();

    // Determine if profile core identity is already locked
    const isLocked = !!(
        profile?.first_name &&
        profile?.last_name &&
        profile?.username &&
        profile?.cedula_number &&
        profile?.cedula_photo_url
    );

    // Always-editable fields
    const [phone, setPhone] = useState<string>(profile?.phone || "");
    const [city, setCity] = useState<string>(profile?.city || "");
    const [profileState, setProfileState] = useState<string>(profile?.state || "");
    const [updating, setUpdating] = useState(false);

    // Only used when profile is NOT yet locked
    const [firstName, setFirstName] = useState<string>(profile?.first_name || "");
    const [lastName, setLastName] = useState<string>(profile?.last_name || "");
    const [username, setUsername] = useState<string>(profile?.username || "");
    const [cedulaNumber, setCedulaNumber] = useState<string>(profile?.cedula_number || "");
    const [cedulaPhotoUrl, setCedulaPhotoUrl] = useState<string | null>(profile?.cedula_photo_url || null);
    const [cedulaFile, setCedulaFile] = useState<File | null>(null);
    const [cedulaPreview, setCedulaPreview] = useState<string | null>(null);
    const [cedulaFileName, setCedulaFileName] = useState<string | null>(null);
    const cedulaFileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Collapsed/expand state for locked profile
    const [expanded, setExpanded] = useState(false);

    const composedFullName = isLocked
        ? profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
        : [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

    const liveProfile = {
        full_name: composedFullName,
        avatar_url: profile?.avatar_url,
        city,
        state: profileState,
        cedula_number: isLocked ? profile?.cedula_number : cedulaNumber,
        cedula_photo_url: isLocked ? profile?.cedula_photo_url : cedulaPhotoUrl,
    };

    // ―― Cedula upload (only needed when not locked) ――
    const handleCedulaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCedulaFile(file);
        setCedulaFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => setCedulaPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const uploadCedulaPhoto = async (): Promise<string | null> => {
        if (!cedulaFile || !user) return cedulaPhotoUrl;
        setUploading(true);
        const ext = cedulaFile.name.split(".").pop() || "jpg";
        const path = `cedula/${user.id}/cedula.${ext}`;
        const { error } = await supabase.storage
            .from("profile-docs")
            .upload(path, cedulaFile, { upsert: true });
        setUploading(false);
        if (error) {
            toast({ title: "⚠️ Error subiendo foto de cédula", description: error.message, variant: "destructive" });
            return null;
        }
        const { data: urlData } = supabase.storage.from("profile-docs").getPublicUrl(path);
        return urlData.publicUrl + `?t=${Date.now()}`;
    };

    // ―― Submit: locked profile only saves phone + city + state ――
    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setUpdating(true);

        if (isLocked) {
            // Only update editable fields
            const { error } = await supabase.from("profiles").update({
                phone: phone.trim() || null,
                city: city.trim() || null,
                state: profileState || null,
            } as any).eq("id", user.id);

            if (error) {
                toast({ title: "❌ Error guardando", description: error.message, variant: "destructive" });
                console.error("Profile update error:", error);
            } else {
                toast({ title: "✅ Guardado", description: "Teléfono y dirección actualizados." });
                refreshProfile();
            }
        } else {
            // Full update — new profile
            let finalCedulaUrl = cedulaPhotoUrl;
            if (cedulaFile) {
                const uploaded = await uploadCedulaPhoto();
                if (uploaded === null) {
                    toast({ title: "⚠️ No se guardó el perfil", description: "Falló la subida de la foto de cédula.", variant: "destructive" });
                    setUpdating(false);
                    return;
                }
                finalCedulaUrl = uploaded;
                setCedulaPhotoUrl(uploaded);
                setCedulaFile(null);
                setCedulaFileName(null);
            }

            const { error } = await supabase.from("profiles").update({
                first_name: firstName.trim() || null,
                last_name: lastName.trim() || null,
                full_name: composedFullName || null,
                username: username.trim() || null,
                phone: phone.trim() || null,
                city: city.trim() || null,
                state: profileState || null,
                cedula_number: cedulaNumber.trim() || null,
                cedula_photo_url: finalCedulaUrl || null,
            } as any).eq("id", user.id);

            if (error) {
                toast({ title: "❌ Error guardando perfil", description: error.message, variant: "destructive" });
                console.error("Profile update error:", error);
            } else {
                toast({ title: "✅ ¡Perfil completado!", description: "Tus datos han sido guardados." });
                setCedulaPhotoUrl(finalCedulaUrl);
                refreshProfile();
            }
        }
        setUpdating(false);
    };

    return (
        <main className="container mx-auto px-4 py-4 max-w-2xl pb-28">
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary dark:hover:text-white mb-6"
            >
                <ArrowLeft className="h-3 w-3" /> Volver a mi panel
            </button>

            <h1 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-primary dark:text-[#A6E300]" />
                Mi Perfil
            </h1>

            {/* Completion bar */}
            <Card className="border border-border rounded-xl mb-5 p-5">
                <ProfileCompletionBar profile={liveProfile} />
            </Card>

            {/* Avatar */}
            <Card className="border border-border rounded-xl mb-5 overflow-hidden">
                <div className="p-5 flex items-start gap-5">
                    <div className="shrink-0">
                        <ProfileAvatarUpload
                            avatarUrl={profile?.avatar_url || null}
                            userName={profile?.full_name || "Usuario"}
                            onAvatarChange={() => refreshProfile()}
                            size="md"
                            hidePolicies
                        />
                    </div>
                    <div className="flex-1 min-w-0 pt-1 space-y-2">
                        <div>
                            <p className="font-heading font-bold text-sm leading-tight truncate">
                                {profile?.full_name || "Sin nombre"}
                            </p>
                            {profile?.username && (
                                <p className="text-[11px] text-primary dark:text-[#A6E300] font-mono mt-0.5">@{profile.username}</p>
                            )}
                            <p className={`text-[11px] mt-0.5 font-medium ${profile?.avatar_url ? "text-green-500 dark:text-[#A6E300]" : "text-muted-foreground"}`}>
                                {profile?.avatar_url ? "✓ Foto guardada" : "Sin foto de perfil"}
                            </p>
                        </div>
                        <div className="bg-secondary/50 dark:bg-white/5 rounded-lg p-2.5 text-[10px] text-muted-foreground leading-relaxed space-y-0.5">
                            <p className="font-semibold text-foreground mb-1">📌 Políticas de imagen</p>
                            <p>• Solo fotos personales o logos de emprendimiento</p>
                            <p>• Sin cédulas, QR, redes sociales ni datos privados</p>
                            <p className="font-medium">JPG, PNG, WebP · Máx 2MB</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* ══════════════════════════════════════════
                LOCKED PROFILE (complete)
            ══════════════════════════════════════════ */}
            {isLocked ? (
                <div className="space-y-4">
                    {/* Verified identity banner */}
                    <div className="flex items-center gap-3 bg-green-500/10 dark:bg-[#A6E300]/10 border border-green-500/30 dark:border-[#A6E300]/30 rounded-xl px-4 py-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-[#A6E300] shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-green-600 dark:text-[#A6E300]">Perfil verificado ✓</p>
                            <p className="text-[10px] text-muted-foreground">Tus datos de identidad están bloqueados para proteger tu cuenta.</p>
                        </div>
                    </div>

                    {/* Editable section */}
                    <form onSubmit={onSubmit} className="space-y-4">
                        <Card className="border border-border rounded-xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-heading font-bold flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-primary dark:text-[#A6E300]" />
                                    Datos de Contacto
                                    <span className="ml-auto text-[10px] font-normal text-green-500 dark:text-[#A6E300] flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Editable
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                                    <Input
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="0412-0000000"
                                        className="rounded-lg"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> Estado
                                        </label>
                                        <select
                                            value={profileState}
                                            onChange={e => setProfileState(e.target.value)}
                                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm dark:bg-zinc-900 dark:text-white"
                                        >
                                            <option value="">Selecciona estado...</option>
                                            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> Ciudad
                                        </label>
                                        <Input
                                            value={city}
                                            onChange={e => setCity(e.target.value)}
                                            placeholder="Tu ciudad"
                                            className="rounded-lg"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Button
                            type="submit"
                            disabled={updating}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm h-11"
                        >
                            {updating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</> : "Guardar Cambios"}
                        </Button>
                    </form>

                    {/* Collapsible locked identity info */}
                    <Card className="border border-border rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setExpanded(v => !v)}
                            className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                        >
                            <span className="flex items-center gap-2 text-sm font-semibold">
                                <Lock className="h-4 w-4 text-muted-foreground" />
                                Datos de Identidad (bloqueados)
                            </span>
                            {expanded
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </button>

                        {expanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-border">
                                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                    <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>
                                        Estos datos no pueden ser modificados directamente.
                                        Si necesitas hacer un cambio, <strong>contacta al soporte</strong> y un agente habilitará la edición.
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <LockedField label="Nombres" value={profile?.first_name} icon={<User className="h-3 w-3" />} />
                                    <LockedField label="Apellidos" value={profile?.last_name} icon={<User className="h-3 w-3" />} />
                                </div>
                                <LockedField label="@Nombre de Usuario" value={profile?.username ? `@${profile.username}` : ""} />
                                <LockedField label="Número de Cédula" value={profile?.cedula_number} icon={<CreditCard className="h-3 w-3" />} />

                                {/* Cedula photo — only a confirmation, no preview for privacy */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <CreditCard className="h-3 w-3" /> Foto de Cédula
                                    </label>
                                    <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-secondary/30 dark:bg-white/5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 dark:text-[#A6E300]" />
                                        <span className="text-sm text-muted-foreground">Foto cargada y verificada</span>
                                        <Lock className="h-3 w-3 text-muted-foreground/50 ml-auto" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                /* ══════════════════════════════════════════
                   INCOMPLETE PROFILE — Full form
                ══════════════════════════════════════════ */
                <form onSubmit={onSubmit} className="space-y-4">
                    <Card className="border border-border rounded-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-heading font-bold flex items-center gap-2">
                                <User className="h-4 w-4 text-primary dark:text-[#A6E300]" />
                                Datos Personales
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Nombres *</label>
                                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ej: Carlos Alberto" className="rounded-lg" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Apellidos *</label>
                                    <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Ej: González Pérez" className="rounded-lg" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <span className="text-primary dark:text-[#A6E300] font-bold">@</span> Nombre de Usuario
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">@</span>
                                    <Input
                                        value={username}
                                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                                        placeholder="carlospro"
                                        className="rounded-lg pl-7 font-mono"
                                        maxLength={30}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">Solo letras, números, puntos o guiones.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0412-0000000" className="rounded-lg" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> Estado *
                                    </label>
                                    <select
                                        value={profileState}
                                        onChange={e => setProfileState(e.target.value)}
                                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm dark:bg-zinc-900 dark:text-white"
                                    >
                                        <option value="">Selecciona estado...</option>
                                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> Ciudad *
                                    </label>
                                    <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Tu ciudad" className="rounded-lg" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Identity / cedula */}
                    <Card className="border border-border rounded-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-heading font-bold flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-primary dark:text-[#A6E300]" />
                                Identidad (Cédula)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Número de Cédula *</label>
                                <Input
                                    value={cedulaNumber}
                                    onChange={e => setCedulaNumber(e.target.value.toUpperCase())}
                                    placeholder="Ej: V-12345678"
                                    className="rounded-lg font-mono"
                                    maxLength={15}
                                />
                                <p className="text-[10px] text-muted-foreground">Formato: V-XXXXXXXX o E-XXXXXXXX</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Foto de tu Cédula *</label>
                                <input ref={cedulaFileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleCedulaFile} />

                                {(cedulaPreview || cedulaPhotoUrl) ? (
                                    <div className="relative w-full max-w-xs">
                                        <img src={cedulaPreview || cedulaPhotoUrl!} alt="Cédula" className="w-full rounded-xl border border-border object-cover max-h-40" />
                                        <button
                                            type="button"
                                            onClick={() => { setCedulaFile(null); setCedulaPreview(null); setCedulaFileName(null); }}
                                            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs px-2 py-1 rounded-lg border border-border"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border border-border rounded-xl p-3 bg-secondary/10 dark:bg-white/5">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => cedulaFileInputRef.current?.click()}
                                                className="shrink-0 py-2.5 px-4 rounded-lg text-xs font-black bg-primary text-primary-foreground hover:bg-primary/80 active:scale-95 transition-all dark:bg-[#A6E300] dark:text-black"
                                            >
                                                Seleccionar foto
                                            </button>
                                            <span className="text-xs min-w-0 truncate">
                                                {cedulaFileName ? (
                                                    <span className="text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                        <span className="shrink-0">✓</span>
                                                        <span className="truncate">{cedulaFileName}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground italic">Ningún archivo seleccionado</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <p className="text-[10px] text-muted-foreground">📌 Tu cédula se usa solo para verificar identidad y se almacena de forma segura.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        type="submit"
                        disabled={updating}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm h-11"
                    >
                        {updating ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />{uploading ? "Subiendo foto..." : "Guardando..."}</>
                        ) : "Guardar Perfil"}
                    </Button>
                </form>
            )}
        </main>
    );
}
