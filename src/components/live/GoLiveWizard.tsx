// @ts-nocheck — live_* tables not yet in generated Supabase types
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
    Radio, X, Camera, CameraOff, ChevronRight, ChevronLeft,
    Copy, ExternalLink, Check, AlertTriangle, Smartphone, Monitor,
    RefreshCw, Loader2,
} from "lucide-react";

interface GoLiveWizardProps {
    onClose: () => void;
    onLiveStarted: () => void;
}

const CATEGORIES = [
    "Electrónica", "Coleccionables", "Moda", "Hogar",
    "Deportes", "Joyería", "Arte", "Otros",
];

const RULES = [
    "No mostraré desnudos ni contenido sexual",
    "No usaré lenguaje ofensivo ni discriminatorio",
    "Los productos serán visibles en cámara en todo momento",
    "No promoveré ventas fuera de la plataforma",
    "Acepto que mi transmisión puede ser moderada o cortada",
];

export default function GoLiveWizard({ onClose, onLiveStarted }: GoLiveWizardProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [step, setStep] = useState(1);

    // Step 1: Event details
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");

    // Step 2: Camera preview + rules
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [rulesAccepted, setRulesAccepted] = useState<boolean[]>(RULES.map(() => false));
    const videoRef = useRef<HTMLVideoElement>(null);

    // Step 3: Live!
    const [creating, setCreating] = useState(false);
    const [streamKey, setStreamKey] = useState<string | null>(null);
    const [playbackId, setPlaybackId] = useState<string | null>(null);
    const [eventId, setEventId] = useState<string | null>(null);
    const [copied, setCopied] = useState<"rtmp" | "key" | null>(null);

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            setCameraError(null);
            // Stop existing stream
            if (cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true,
            });
            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            setCameraError("No se puede acceder a la cámara. Verifica los permisos del navegador.");
        }
    }, [facingMode]);

    // Attach stream to video element when it changes
    useEffect(() => {
        if (videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream;
        }
    }, [cameraStream]);

    // Start camera on step 2
    useEffect(() => {
        if (step === 2) startCamera();
        return () => {
            if (step !== 2 && step !== 3 && cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
            }
        };
    }, [step, facingMode]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    // Toggle camera direction (mobile)
    const toggleCamera = () => {
        setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    };

    // All rules accepted?
    const allRulesAccepted = rulesAccepted.every(Boolean);

    // Go live! (creates event + updates to live status)
    const goLive = async () => {
        if (!user || !title.trim()) return;
        setCreating(true);

        try {
            // 1. Create event in database with status "live"
            const { data: newEvent, error: createError } = await supabase
                .from("live_events")
                .insert({
                    dealer_id: user.id,
                    title: title.trim(),
                    description: null,
                    category: category || null,
                    scheduled_at: new Date().toISOString(),
                    status: "live",
                    started_at: new Date().toISOString(),
                })
                .select("id")
                .single();

            if (createError || !newEvent) throw new Error(createError?.message || "Error creando evento");

            setEventId(newEvent.id);
            toast({ title: "🔴 ¡Estás EN VIVO!", description: "Redirigiendo a tu sala..." });
            onLiveStarted();

            // 2. Try creating Mux stream in background (fire-and-forget)
            supabase.functions.invoke("create-live-stream", {
                body: { event_id: newEvent.id },
            }).catch(() => {});

            // 3. Redirect to live room
            window.location.href = `/live/${newEvent.id}`;
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
            setCreating(false);
        }
    };

    const copyToClipboard = (text: string, type: "rtmp" | "key") => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const rtmpUrl = "rtmps://global-live.mux.com:443/app";
    const fullStreamUrl = streamKey ? `${rtmpUrl}/${streamKey}` : "";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                        <h2 className="text-lg font-heading font-bold text-foreground">
                            {step === 1 && "Ir en Vivo"}
                            {step === 2 && "Preparar Transmisión"}
                            {step === 3 && "🔴 ¡EN VIVO!"}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex gap-1 px-4 pt-3">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                                s <= step ? "bg-accent" : "bg-secondary"
                            }`}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* ─── STEP 1: Title & Category ─── */}
                    {step === 1 && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-sm text-muted-foreground">
                                ¿Qué vas a subastar hoy? Ponle un título llamativo.
                            </p>
                            <div>
                                <label className="text-xs text-muted-foreground font-bold mb-1 block">
                                    Título del evento *
                                </label>
                                <input
                                    type="text"
                                    placeholder="ej: Subasta de Perfumes Originales"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                                    autoFocus
                                    maxLength={100}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground font-bold mb-1 block">
                                    Categoría
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {CATEGORIES.map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategory(cat === category ? "" : cat)}
                                            className={`text-xs px-2 py-2 rounded-xl border font-semibold transition-all ${
                                                category === cat
                                                    ? "bg-accent text-accent-foreground border-accent"
                                                    : "bg-secondary/30 text-muted-foreground border-border hover:border-accent/50"
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!title.trim()}
                                className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-heading font-bold py-3 rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-colors"
                            >
                                Siguiente <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* ─── STEP 2: Camera + Rules ─── */}
                    {step === 2 && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Camera preview */}
                            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                                {cameraError ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                        <CameraOff className="h-10 w-10 text-red-400 mb-2" />
                                        <p className="text-xs text-red-400">{cameraError}</p>
                                        <button
                                            onClick={startCamera}
                                            className="text-xs text-accent font-bold mt-2 underline"
                                        >
                                            Reintentar
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover mirror"
                                            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                                        />
                                        <div className="absolute top-2 right-2 flex gap-2">
                                            <button
                                                onClick={toggleCamera}
                                                className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                                title="Cambiar cámara"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="absolute bottom-2 left-2">
                                            <span className="text-[10px] bg-black/60 text-white px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                                <Camera className="h-3 w-3" /> Vista previa
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Rules checklist */}
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-foreground">
                                    Acepta las reglas de transmisión:
                                </p>
                                {RULES.map((rule, i) => (
                                    <label
                                        key={i}
                                        className="flex items-start gap-2 cursor-pointer group"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={rulesAccepted[i]}
                                            onChange={() => {
                                                const next = [...rulesAccepted];
                                                next[i] = !next[i];
                                                setRulesAccepted(next);
                                            }}
                                            className="mt-0.5 accent-[#A6E300] w-4 h-4 rounded"
                                        />
                                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                            {rule}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); } setStep(1); }}
                                    className="flex items-center gap-1 text-sm text-muted-foreground font-bold px-4 py-3 rounded-xl hover:bg-secondary/30 active:bg-secondary/50 min-w-[80px]"
                                >
                                    <ChevronLeft className="h-5 w-5" /> Atrás
                                </button>
                                <button
                                    onClick={goLive}
                                    disabled={!allRulesAccepted || creating}
                                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white font-heading font-bold py-3 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Creando stream...
                                        </>
                                    ) : (
                                        <>
                                            <Radio className="h-4 w-4" />
                                            🔴 ¡Ir en Vivo!
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── STEP 3: Live! ─── */}
                    {step === 3 && streamKey && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Camera still rolling */}
                            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                    style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                                />
                                <div className="absolute top-2 left-2">
                                    <span className="text-[10px] bg-red-600 text-white px-2 py-1 rounded-full font-bold flex items-center gap-1 animate-pulse">
                                        🔴 EN VIVO
                                    </span>
                                </div>
                            </div>

                            {/* Connection instructions */}
                            <div className="bg-nav border border-white/10 rounded-xl p-4 space-y-3">
                                <p className="text-xs text-white/50 font-bold uppercase tracking-wider">
                                    Conecta tu cámara
                                </p>

                                {/* Mobile: Larix Broadcaster */}
                                <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Smartphone className="h-4 w-4 text-accent" />
                                        <span className="text-xs font-bold text-accent">Desde el Teléfono (Recomendado)</span>
                                    </div>
                                    <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
                                        <li>Descarga <strong className="text-foreground">Larix Broadcaster</strong> (gratis)</li>
                                        <li>Copia la URL completa de abajo</li>
                                        <li>En Larix: Settings → Connections → + → pega la URL</li>
                                        <li>¡Dale play y estarás en vivo!</li>
                                    </ol>
                                    <div className="mt-2 flex items-center gap-2">
                                        <code className="text-[10px] text-accent bg-black/30 px-2 py-1.5 rounded-lg flex-1 truncate">
                                            {fullStreamUrl}
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(fullStreamUrl, "key")}
                                            className="text-white/50 hover:text-accent shrink-0"
                                        >
                                            {copied === "key" ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Desktop: OBS */}
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Monitor className="h-4 w-4 text-blue-400" />
                                        <span className="text-xs font-bold text-blue-400">Desde la PC (OBS)</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-white/40 block">Servidor</label>
                                            <div className="flex items-center gap-1">
                                                <code className="text-[10px] text-blue-300 bg-black/30 px-2 py-1 rounded flex-1 truncate">
                                                    {rtmpUrl}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(rtmpUrl, "rtmp")}
                                                    className="text-white/50 hover:text-blue-400"
                                                >
                                                    {copied === "rtmp" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-white/40 block">Stream Key</label>
                                            <div className="flex items-center gap-1">
                                                <code className="text-[10px] text-blue-300 bg-black/30 px-2 py-1 rounded flex-1 truncate">
                                                    {streamKey}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(streamKey, "key")}
                                                    className="text-white/50 hover:text-blue-400"
                                                >
                                                    {copied === "key" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* View live room link */}
                            {eventId && (
                                <a
                                    href={`/live/${eventId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-heading font-bold py-3 rounded-xl hover:bg-accent/90 transition-colors"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Ver mi sala en vivo
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
