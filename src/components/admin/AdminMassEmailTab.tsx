import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Loader2, Send, Mail, Check, AlertTriangle, Flame, PartyPopper,
    Zap, Megaphone, Wrench, Eye, Users, TestTube
} from "lucide-react";

// ─── Email HTML builder (mirrors edge function exactly) ──────────────────────
const APP_URL = "https://subastandolo.com";
const HEADER_IMG = "https://subastandolo.com/email-header.png";

function emailLayout(accentGradient: string, accentTextColor: string, emoji: string, heading: string, subheading: string, body: string) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>:root { color-scheme: light only; } body { margin:0; padding:0; }</style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f4f6" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0;border-radius:12px 12px 0 0;overflow:hidden;text-align:center;">
            <img src="${HEADER_IMG}" alt="Subastandolo" width="580" style="width:100%;max-width:580px;height:auto;display:block;border:0;outline:0;border-radius:12px 12px 0 0;" />
          </td>
        </tr>
        <tr>
          <td style="background:${accentGradient};padding:28px 32px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:60px;height:60px;line-height:60px;font-size:28px;margin-bottom:12px;">${emoji}</div>
            <h1 style="margin:0;color:${accentTextColor};font-size:22px;font-weight:800;letter-spacing:-0.3px;line-height:1.2;">${heading}</h1>
            <p style="margin:8px 0 0;color:${accentTextColor};opacity:0.72;font-size:14px;font-weight:500;">${subheading}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:0;">
            <div style="padding:28px 32px;">
              ${body}
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              Este mensaje fue enviado por <strong style="color:#6b7280;">SUBASTANDOLO</strong><br>
              <a href="${APP_URL}" style="color:#EAB308;text-decoration:none;">subastandolo.com</a> · El mejor postor siempre gana 🔨
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaBtn(href: string, label: string, bg: string, text: string) {
    return `<div style="text-align:center;margin:28px 0;"><a href="${href}" style="display:inline-block;background:${bg};color:${text};font-weight:700;font-size:15px;padding:15px 44px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">${label}</a></div>`;
}

function infoBox(bg: string, border: string, content: string) {
    return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:16px 20px;margin:20px 0;">${content}</div>`;
}

// ─── Template definitions ──────────────────────────────────────────────────
interface TemplateOption {
    key: string;
    name: string;
    subject: string;
    description: string;
    icon: any;
    accentColor: string;
    accentBg: string;
    hasCustomMessage?: boolean;
    buildHtml: (customMsg?: string) => string;
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
        buildHtml: () => emailLayout(
            "linear-gradient(135deg,#EAB308,#F59E0B)", "#1a1a2e",
            "🔥", "¡Nuevas subastas disponibles!", "Productos increíbles esperan por ti",
            `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 👋</p>
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
         Tenemos <strong style="color:#111827;">nuevas subastas activas</strong> en la plataforma con productos increíbles 
         a precios que tú decides. Tecnología, hogar, moda y mucho más — todo verificado y con envío seguro.
       </p>
       ${infoBox("#fffbeb", "#fde68a",
                `<table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#374151;font-size:13px;"><span style="display:inline-block;width:24px;">🏷️</span> <strong>Precios desde $1</strong> — Tú pones el precio</td></tr>
            <tr><td style="padding:6px 0;color:#374151;font-size:13px;"><span style="display:inline-block;width:24px;">🛡️</span> <strong>Compra protegida</strong> — Tu dinero resguardado</td></tr>
            <tr><td style="padding:6px 0;color:#374151;font-size:13px;"><span style="display:inline-block;width:24px;">🚚</span> <strong>Envío a todo el país</strong> — Rastreo incluido</td></tr>
          </table>`
            )}
       ${ctaBtn(`${APP_URL}/explorar`, "🔨 Ver Subastas Ahora", "#EAB308", "#1a1a2e")}
       <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">No te quedes sin pujar — las subastas cierran en tiempo real ⏰</p>`
        ),
    },
    {
        key: "bienvenida_general",
        name: "Gracias por estar",
        subject: "🎉 ¡Gracias por ser parte de Subastandolo!",
        description: "Correo de agradecimiento y engagement a la comunidad",
        icon: PartyPopper,
        accentColor: "#22c55e",
        accentBg: "bg-green-500/10",
        buildHtml: () => emailLayout(
            "linear-gradient(135deg,#22c55e,#15803d)", "#fff",
            "🎉", "¡Gracias por estar aquí!", "Eres parte de la mejor comunidad de subastas",
            `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 👋</p>
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
         Queríamos darte las gracias por ser parte de <strong style="color:#111827;">Subastandolo</strong>,
         la plataforma de subastas más segura y emocionante de Venezuela.
         Cada día sumamos más productos, más dealers verificados y más oportunidades para ti.
       </p>
       ${infoBox("#f0fdf4", "#bbf7d0",
                `<p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
            💚 <strong>Nuestra promesa:</strong> transparencia total, compra protegida, 
            y precios que decides tú. ¡Gracias por confiar en nosotros!
          </p>`
            )}
       ${ctaBtn(APP_URL, "🏠 Ir a Subastandolo", "#22c55e", "#ffffff")}
       <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Tu opinión importa — escríbenos a soporte@subastandolo.com</p>`
        ),
    },
    {
        key: "oferta_flash",
        name: "Oferta Flash",
        subject: "⚡ ¡Oferta Flash! Subastas por tiempo limitado",
        description: "Urgencia para subastas especiales con precios bajos",
        icon: Zap,
        accentColor: "#ef4444",
        accentBg: "bg-red-500/10",
        buildHtml: () => emailLayout(
            "linear-gradient(135deg,#ef4444,#dc2626)", "#fff",
            "⚡", "¡Oferta Flash!", "Subastas especiales por tiempo limitado",
            `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 🔥</p>
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
         Tenemos <strong style="color:#ef4444;">ofertas especiales por tiempo limitado</strong>. 
         Subastas que inician con precios increíblemente bajos y cierran pronto — 
         esta es tu oportunidad de conseguir algo extraordinario.
       </p>
       ${infoBox("#fef2f2", "#fecaca",
                `<p style="margin:0;color:#374151;font-size:14px;font-weight:600;">
            ⏰ <strong style="color:#ef4444;">¡Date prisa!</strong> Estas subastas no durarán mucho. 
            Ingresa ahora y puja antes que los demás.
          </p>`
            )}
       ${ctaBtn(`${APP_URL}/explorar`, "🔨 Ver Ofertas Flash", "#ef4444", "#ffffff")}
       <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Las subastas flash cierran en tiempo real — ¡no pierdas tu oportunidad!</p>`
        ),
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
        buildHtml: (customMsg?: string) => emailLayout(
            "linear-gradient(135deg,#3b82f6,#1d4ed8)", "#fff",
            "📢", "Anuncio Importante", "Información que no querrás perderte",
            `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 👋</p>
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
         ${customMsg || "Tenemos noticias importantes que queremos compartir contigo. Visita la plataforma para más detalles."}
       </p>
       ${ctaBtn(APP_URL, "🔗 Ir a Subastandolo", "#3b82f6", "#ffffff")}
       <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Gracias por ser parte de Subastandolo 💛</p>`
        ),
    },
    {
        key: "mantenimiento",
        name: "Mantenimiento",
        subject: "🛠️ Mantenimiento programado",
        description: "Informa sobre mantenimiento y mejoras del sistema",
        icon: Wrench,
        accentColor: "#6b7280",
        accentBg: "bg-gray-500/10",
        buildHtml: () => emailLayout(
            "linear-gradient(135deg,#6b7280,#4b5563)", "#fff",
            "🛠️", "Mantenimiento Programado", "Mejoras para una mejor experiencia",
            `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 👋</p>
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
         Te informamos que realizaremos un <strong style="color:#111827;">mantenimiento programado</strong> 
         en la plataforma para implementar mejoras y optimizaciones. 
         Durante este período, es posible que algunos servicios no estén disponibles temporalmente.
       </p>
       ${infoBox("#f9fafb", "#e5e7eb",
                `<table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#374151;font-size:13px;"><span style="display:inline-block;width:24px;">⚙️</span> Optimización de velocidad y rendimiento</td></tr>
            <tr><td style="padding:6px 0;color:#374151;font-size:13px;"><span style="display:inline-block;width:24px;">🔒</span> Mejoras de seguridad</td></tr>
            <tr><td style="padding:6px 0;color:#374151;font-size:13px;"><span style="display:inline-block;width:24px;">✨</span> Nuevas funcionalidades</td></tr>
          </table>`
            )}
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:16px 0 0;">
         Pedimos disculpas por cualquier inconveniente. ¡Volveremos mejor que nunca!
       </p>
       ${ctaBtn(APP_URL, "🏠 Ir a Subastandolo", "#6b7280", "#ffffff")}`
        ),
    },
];

// ─── Component ─────────────────────────────────────────────────────────────
const AdminMassEmailTab = () => {
    const { toast } = useToast();
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [customMessage, setCustomMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);
    const [result, setResult] = useState<{ total: number; sent: number; failed: number } | null>(null);

    const selected = TEMPLATES.find(t => t.key === selectedTemplate);

    // Build the actual email HTML for the live preview
    const previewHtml = useMemo(() => {
        if (!selected) return "";
        return selected.buildHtml(selected.hasCustomMessage ? customMessage : undefined);
    }, [selected, customMessage]);

    const handleSendTest = async () => {
        if (!selectedTemplate || !testEmail.trim()) return;
        setSendingTest(true);

        try {
            const { error } = await supabase.functions.invoke("send-mass-email", {
                body: {
                    templateKey: selectedTemplate,
                    customMessage: selected?.hasCustomMessage ? customMessage : undefined,
                    testEmail: testEmail.trim(),
                },
            });

            if (error) throw error;

            toast({
                title: "✅ Correo de prueba enviado",
                description: `Se envió a ${testEmail.trim()}`,
            });
        } catch (e: any) {
            toast({
                title: "Error",
                description: e.message || "No se pudo enviar",
                variant: "destructive",
            });
        } finally {
            setSendingTest(false);
        }
    };

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

            {/* Step 3: Live HTML Preview + Send */}
            {selected && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {selected.hasCustomMessage ? "3" : "2"}
                        </span>
                        Vista previa y envío
                    </h3>

                    {/* Subject line */}
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">Asunto:</span>
                        <span className="text-sm font-semibold text-foreground">{selected.subject}</span>
                    </div>

                    {/* Real email HTML rendered in sandboxed iframe */}
                    <Card className="overflow-hidden">
                        <div className="px-4 py-2.5 bg-secondary/30 border-b border-border flex items-center gap-2.5">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Vista previa — así le llegará al usuario</span>
                        </div>
                        <CardContent className="p-0">
                            <iframe
                                srcDoc={previewHtml}
                                sandbox="allow-same-origin"
                                title="Vista previa del correo"
                                className="w-full border-0"
                                style={{ height: "620px", background: "#f3f4f6" }}
                            />
                        </CardContent>
                    </Card>

                    {/* Test email */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Input
                            type="email"
                            placeholder="email@ejemplo.com"
                            value={testEmail}
                            onChange={e => setTestEmail(e.target.value)}
                            className="w-64 text-sm"
                        />
                        <Button
                            onClick={handleSendTest}
                            disabled={sendingTest || !testEmail.trim() || (selected.hasCustomMessage && !customMessage.trim())}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                        >
                            {sendingTest ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
                            ) : (
                                <><TestTube className="h-3.5 w-3.5" /> Enviar prueba</>
                            )}
                        </Button>
                    </div>

                    {/* Confirm + Send */}
                    {!showConfirm ? (
                        <div className="flex items-center gap-3 flex-wrap">
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
