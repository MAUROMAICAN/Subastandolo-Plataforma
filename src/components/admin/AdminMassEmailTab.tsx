import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Loader2, Send, Mail, Check, AlertTriangle, Flame, PartyPopper,
    Zap, Megaphone, Wrench, Eye, Users
} from "lucide-react";

interface TemplateOption {
    key: string;
    name: string;
    subject: string;
    description: string;
    icon: any;
    accentColor: string;
    accentBg: string;
    hasCustomMessage?: boolean;
}

const TEMPLATES: TemplateOption[] = [
    {
        key: "nuevas_subastas",
        name: "Nuevas Subastas",
        subject: "🔥 ¡Estamos activos con nuevas subastas!",
        description: "Anuncia que hay subastas activas con CTA directo a explorar",
        icon: Flame,
        accentColor: "#EAB308",
        accentBg: "bg-amber-500/10",
    },
    {
        key: "bienvenida_general",
        name: "Gracias por estar",
        subject: "🎉 ¡Gracias por ser parte de Subastandolo!",
        description: "Correo de agradecimiento y engagement a la comunidad",
        icon: PartyPopper,
        accentColor: "#22c55e",
        accentBg: "bg-green-500/10",
    },
    {
        key: "oferta_flash",
        name: "Oferta Flash",
        subject: "⚡ ¡Oferta Flash! Subastas por tiempo limitado",
        description: "Urgencia para subastas especiales con precios bajos",
        icon: Zap,
        accentColor: "#ef4444",
        accentBg: "bg-red-500/10",
    },
    {
        key: "anuncio",
        name: "Anuncio Personalizado",
        subject: "📢 Anuncio importante — Subastandolo",
        description: "Escribe tu propio mensaje para enviar a todos",
        icon: Megaphone,
        accentColor: "#3b82f6",
        accentBg: "bg-blue-500/10",
        hasCustomMessage: true,
    },
    {
        key: "mantenimiento",
        name: "Mantenimiento",
        subject: "🛠️ Mantenimiento programado",
        description: "Informa sobre mantenimiento y mejoras del sistema",
        icon: Wrench,
        accentColor: "#6b7280",
        accentBg: "bg-gray-500/10",
    },
];

const AdminMassEmailTab = () => {
    const { toast } = useToast();
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [customMessage, setCustomMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [result, setResult] = useState<{ total: number; sent: number; failed: number } | null>(null);

    const selected = TEMPLATES.find(t => t.key === selectedTemplate);

    const handleSend = async () => {
        if (!selectedTemplate) return;
        setSending(true);
        setResult(null);
        setShowConfirm(false);

        try {
            const { data, error } = await supabase.functions.invoke("send-mass-email", {
                body: {
                    templateKey: selectedTemplate,
                    customMessage: selected?.hasCustomMessage ? customMessage : undefined,
                },
            });

            if (error) throw error;

            setResult(data);
            toast({
                title: data.failed > 0 ? "⚠️ Envío parcial" : "✅ ¡Correos enviados!",
                description: `${data.sent} de ${data.total} correos enviados exitosamente.`,
                variant: data.failed > 0 ? "destructive" : "default",
            });
        } catch (e: any) {
            toast({
                title: "Error al enviar",
                description: e.message || "No se pudieron enviar los correos",
                variant: "destructive",
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
                    <Mail className="h-6 w-6 text-primary" /> Correo Masivo
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Envía correos profesionales a todos los usuarios registrados
                </p>
            </div>

            {/* Step 1: Template selector */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                    Selecciona el correo
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TEMPLATES.map(t => (
                        <button
                            key={t.key}
                            onClick={() => { setSelectedTemplate(t.key); setResult(null); setShowConfirm(false); }}
                            className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 ${selectedTemplate === t.key
                                ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                                : "border-border hover:border-primary/40 hover:bg-secondary/30"
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`${t.accentBg} p-2.5 rounded-lg shrink-0`}>
                                    <t.icon className="h-5 w-5" style={{ color: t.accentColor }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm text-foreground leading-tight">{t.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                                </div>
                            </div>
                            {selectedTemplate === t.key && (
                                <div className="absolute top-2 right-2">
                                    <Check className="h-4 w-4 text-primary" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2: Custom message (if applicable) */}
            {selected?.hasCustomMessage && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                        Escribe tu mensaje
                    </h3>
                    <Textarea
                        value={customMessage}
                        onChange={e => setCustomMessage(e.target.value)}
                        placeholder="Escribe el mensaje personalizado que quieres enviar a todos los usuarios..."
                        className="min-h-[120px] text-sm"
                    />
                </div>
            )}

            {/* Step 3: Preview + Send */}
            {selected && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {selected.hasCustomMessage ? "3" : "2"}
                        </span>
                        Vista previa y envío
                    </h3>

                    {/* Email preview card */}
                    <Card className="overflow-hidden">
                        <div className="px-4 py-3 bg-secondary/30 border-b border-border flex items-center gap-2.5">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Vista previa del correo</span>
                        </div>
                        <CardContent className="p-4 space-y-3">
                            {/* Subject line */}
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0 mt-0.5">Asunto:</span>
                                <span className="text-sm font-semibold text-foreground">{selected.subject}</span>
                            </div>

                            {/* Simulated email body */}
                            <div className="rounded-xl overflow-hidden border border-border">
                                {/* Logo header */}
                                <div className="bg-[#111827] px-6 py-5 text-center">
                                    <span className="text-white font-bold text-lg tracking-tight">SUBASTANDOLO</span>
                                </div>
                                {/* Accent banner */}
                                <div
                                    className="px-6 py-5 text-center"
                                    style={{ background: `linear-gradient(135deg, ${selected.accentColor}, ${selected.accentColor}dd)` }}
                                >
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/15 text-xl mb-2">
                                        {selected.subject.slice(0, 2)}
                                    </div>
                                    <p className="font-bold text-white text-base">{selected.name}</p>
                                    <p className="text-white/70 text-xs mt-1">{selected.description}</p>
                                </div>
                                {/* Body placeholder */}
                                <div className="bg-white dark:bg-card px-6 py-5 space-y-2">
                                    <p className="text-sm text-foreground">¡Hola! 👋</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {selected.hasCustomMessage && customMessage
                                            ? customMessage
                                            : selected.key === "nuevas_subastas"
                                                ? "Tenemos nuevas subastas activas en la plataforma con productos increíbles a precios que tú decides..."
                                                : selected.key === "bienvenida_general"
                                                    ? "Queríamos darte las gracias por ser parte de Subastandolo, la plataforma de subastas más segura..."
                                                    : selected.key === "oferta_flash"
                                                        ? "Tenemos ofertas especiales por tiempo limitado. Subastas que inician con precios increíbles..."
                                                        : selected.key === "mantenimiento"
                                                            ? "Realizaremos un mantenimiento programado para implementar mejoras y optimizaciones..."
                                                            : "Tenemos noticias importantes que queremos compartir contigo..."}
                                    </p>
                                    <div className="pt-2 text-center">
                                        <span
                                            className="inline-block px-6 py-2.5 rounded-lg text-xs font-bold text-white"
                                            style={{ background: selected.accentColor }}
                                        >
                                            Ver en Subastandolo →
                                        </span>
                                    </div>
                                </div>
                                {/* Footer */}
                                <div className="bg-secondary/20 px-6 py-3 text-center border-t border-border">
                                    <p className="text-[10px] text-muted-foreground">SUBASTANDOLO · subastandolo.com</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Confirm + Send */}
                    {!showConfirm ? (
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={() => setShowConfirm(true)}
                                disabled={sending || (selected.hasCustomMessage && !customMessage.trim())}
                                className="gap-2"
                                size="lg"
                            >
                                <Send className="h-4 w-4" />
                                Enviar a todos los usuarios
                            </Button>
                            {result && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <Check className="h-4 w-4 text-green-500" />
                                    Último envío: {result.sent}/{result.total} exitosos
                                </span>
                            )}
                        </div>
                    ) : (
                        <Card className="border-2 border-amber-500/50 bg-amber-500/5">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-sm text-foreground">¿Enviar correo masivo?</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Se enviará el correo <strong>"{selected.name}"</strong> a <strong>todos los usuarios registrados</strong> en la plataforma.
                                            Esta acción no se puede deshacer.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pl-8">
                                    <Button
                                        onClick={handleSend}
                                        disabled={sending}
                                        variant="destructive"
                                        size="sm"
                                        className="gap-2"
                                    >
                                        {sending ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Enviando...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-3.5 w-3.5" />
                                                Sí, enviar ahora
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() => setShowConfirm(false)}
                                        variant="ghost"
                                        size="sm"
                                        disabled={sending}
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Results */}
                    {result && (
                        <Card className={result.failed > 0 ? "border-red-500/30" : "border-green-500/30"}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    {result.failed > 0 ? (
                                        <AlertTriangle className="h-5 w-5 text-red-500" />
                                    ) : (
                                        <Check className="h-5 w-5 text-green-500" />
                                    )}
                                    <div>
                                        <p className="font-semibold text-sm text-foreground">
                                            {result.failed > 0 ? "Envío parcial" : "¡Envío completado!"}
                                        </p>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Users className="h-3 w-3" /> Total: {result.total}
                                            </span>
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                                <Check className="h-3 w-3" /> Enviados: {result.sent}
                                            </span>
                                            {result.failed > 0 && (
                                                <span className="text-xs text-red-600 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Fallidos: {result.failed}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminMassEmailTab;
