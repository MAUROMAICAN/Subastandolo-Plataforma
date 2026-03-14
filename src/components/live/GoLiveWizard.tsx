// @ts-nocheck — live_* tables not yet in generated Supabase types
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import LiveKitBroadcaster from "@/components/live/LiveKitBroadcaster";
import {
    Radio, X, Camera, CameraOff, ChevronRight, ChevronLeft,
    ExternalLink, RefreshCw, Loader2,
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

    // Step 3: Live with LiveKit!
    const [creating, setCreating] = useState(false);
    const [eventId, setEventId] = useState<string | null>(null);
    const [livekitToken, setLivekitToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            setCameraError(null);
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

    useEffect(() => {
        if (videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream;
        }
    }, [cameraStream]);

    useEffect(() => {
        if (step === 2) startCamera();
        return () => {
            if (step !== 2 && step !== 3 && cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
            }
        };
    }, [step, facingMode]);

    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    const toggleCamera = () => {
        setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    };

    const allRulesAccepted = rulesAccepted.every(Boolean);

    // Go live! Creates event + gets LiveKit token
    const goLive = async () => {
        if (!user || !title.trim()) return;
        setCreating(true);
        let createdEventId: string | null = null;

        try {
            // Stop the preview camera (LiveKit will use its own)
            if (cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
                setCameraStream(null);
            }

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
            createdEventId = newEvent.id;
            setEventId(newEvent.id);

            // 2. Get LiveKit token as publisher
            const { data: tokenData, error: tokenError } = await supabase.functions.invoke("livekit-token", {
                body: { event_id: newEvent.id, role: "publisher" },
            });

            if (tokenError) throw new Error("Error de conexión: " + (tokenError.message || "intenta de nuevo"));
            if (tokenData?.error) throw new Error(tokenData.error);
            if (!tokenData?.token || !tokenData?.url) throw new Error("No se recibió token de LiveKit");

            setLivekitToken(tokenData.token);
            setLivekitUrl(tokenData.url);
            setStep(3);

            toast({ title: "🔴 ¡Estás EN VIVO!" });
            onLiveStarted();
        } catch (err: any) {
            console.error("[goLive] error:", err);
            toast({ title: "Error al iniciar live", description: err.message, variant: "destructive" });
            // Clean up: delete orphan event if token failed
            if (createdEventId) {
                await supabase.from("live_events").delete().eq("id", createdEventId);
            }
            setCreating(false);
        }
    };

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
                    {step !== 3 && (
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    )}
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
                                            Conectando...
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

                    {/* ─── STEP 3: LIVE with LiveKit Broadcaster ─── */}
                    {step === 3 && livekitToken && livekitUrl && (
                        <div className="space-y-4 animate-fade-in">
                            {/* LiveKit camera broadcasting */}
                            <LiveKitBroadcaster
                                token={livekitToken}
                                serverUrl={livekitUrl}
                                onDisconnect={() => {
                                    toast({ title: "Transmisión desconectada" });
                                }}
                            />

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
