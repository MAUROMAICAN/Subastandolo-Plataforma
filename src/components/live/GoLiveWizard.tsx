// @ts-nocheck — live_* tables not yet in generated Supabase types
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import LiveKitBroadcaster from "./LiveKitBroadcaster";
import {
    Radio, X, Camera, CameraOff, ChevronRight, ChevronLeft,
    ExternalLink, RefreshCw, Loader2, Mic, MicOff, Square, Users,
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

    // Step 2 & 3: Camera
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [rulesAccepted, setRulesAccepted] = useState<boolean[]>(RULES.map(() => false));
    const [isMuted, setIsMuted] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Step 3: Live state
    const [creating, setCreating] = useState(false);
    const [eventId, setEventId] = useState<string | null>(null);
    const [livekitToken, setLivekitToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
    const [livekitStatus, setLivekitStatus] = useState<"connecting" | "connected" | "error" | "idle">("idle");
    const [cameraReady, setCameraReady] = useState(false);
    const [ending, setEnding] = useState(false);

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
            setCameraError("No se puede acceder a la cámara. Verifica los permisos.");
        }
    }, [facingMode]);

    useEffect(() => {
        if (videoRef.current && cameraStream) {
            videoRef.current.srcObject = cameraStream;
        }
    }, [cameraStream]);

    useEffect(() => {
        if (step === 2) startCamera();
    }, [step, facingMode]);

    // Cleanup camera on unmount
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

    const toggleMic = () => {
        if (cameraStream) {
            cameraStream.getAudioTracks().forEach((t) => {
                t.enabled = isMuted; // toggle
            });
            setIsMuted(!isMuted);
        }
    };

    const allRulesAccepted = rulesAccepted.every(Boolean);

    // Go live! Creates event + gets LiveKit token, then LiveKitBroadcaster handles the rest
    const goLive = async () => {
        if (!user || !title.trim()) return;
        setCreating(true);
        let createdEventId: string | null = null;

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
            createdEventId = newEvent.id;
            setEventId(newEvent.id);

            // 2. Get LiveKit token
            setLivekitStatus("connecting");
            console.log("[GoLive] Requesting LiveKit token for event:", newEvent.id);
            const { data: tokenData, error: tokenError } = await supabase.functions.invoke("livekit-token", {
                body: { event_id: newEvent.id, role: "publisher" },
            });

            console.log("[GoLive] Token response:", {
                hasToken: !!tokenData?.token,
                tokenLength: tokenData?.token?.length,
                url: tokenData?.url,
                room: tokenData?.room,
                role: tokenData?.role,
                error: tokenError || tokenData?.error,
            });

            if (tokenError || tokenData?.error || !tokenData?.token) {
                console.warn("[LiveKit] Token error:", tokenError || tokenData?.error);
                setLivekitStatus("error");
            } else {
                // Stop the preview camera — wait for it to fully release before LiveKitBroadcaster opens its own
                if (cameraStream) {
                    cameraStream.getTracks().forEach((t) => t.stop());
                    setCameraStream(null);
                }

                setLivekitToken(tokenData.token);
                setLivekitUrl(tokenData.url);
                setLivekitStatus("connected");
                console.log("[LiveKit] ✅ Token received, waiting for camera release...");

                // Give the browser time to fully release the camera hardware
                setTimeout(() => {
                    setCameraReady(true);
                    console.log("[LiveKit] ✅ Camera released, LiveKitBroadcaster ready");
                }, 800);
            }

            setStep(3);
            toast({ title: "🔴 ¡Estás EN VIVO!" });
            onLiveStarted();
        } catch (err: any) {
            console.error("[goLive] error:", err);
            toast({ title: "Error al iniciar live", description: err.message, variant: "destructive" });
            if (createdEventId) {
                await supabase.from("live_events").delete().eq("id", createdEventId);
            }
            setCreating(false);
        }
    };

    // End live stream
    const endLive = async () => {
        setEnding(true);
        try {
            // Stop preview camera if still running
            if (cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
                setCameraStream(null);
            }

            // Update event status
            if (eventId) {
                await supabase.from("live_events").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", eventId);
            }

            toast({ title: "Transmisión finalizada" });
            onClose();
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
        setEnding(false);
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
                                            className="w-full h-full object-cover"
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

                    {/* ─── STEP 3: LIVE! Using LiveKitBroadcaster ─── */}
                    {step === 3 && (
                        <div className="space-y-4 animate-fade-in">
                            {/* LiveKit Broadcaster — handles camera, mic, and connection */}
                            {livekitToken && livekitUrl && cameraReady ? (
                                <div className="relative">
                                    <LiveKitBroadcaster
                                        token={livekitToken}
                                        serverUrl={livekitUrl}
                                        onDisconnect={() => {
                                            console.log("[LiveKit] Room disconnected — showing reconnect state");
                                            setLivekitStatus("error");
                                            setCameraReady(false);
                                        }}
                                    />
                                    {/* LiveKit status overlay */}
                                    <div className="absolute top-2 right-12">
                                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-green-600 text-white">
                                            📡 Transmitiendo
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex flex-col items-center justify-center gap-3">
                                    {livekitStatus === "connecting" ? (
                                        <>
                                            <Loader2 className="h-10 w-10 text-accent animate-spin" />
                                            <p className="text-white text-sm">Conectando con LiveKit...</p>
                                        </>
                                    ) : livekitStatus === "error" ? (
                                        <>
                                            <CameraOff className="h-10 w-10 text-red-400" />
                                            <p className="text-red-400 text-sm font-bold">⚠️ Error conectando stream</p>
                                            <p className="text-white/50 text-xs">La transmisión se creó pero no se pudo conectar el video</p>
                                        </>
                                    ) : (
                                        <>
                                            <Radio className="h-10 w-10 text-red-500 animate-pulse" />
                                            <p className="text-white text-sm">Preparando transmisión...</p>
                                        </>
                                    )}
                                    {/* EN VIVO badge even without stream */}
                                    <div className="absolute top-2 left-2">
                                        <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                            EN VIVO
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* View live room */}
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

                            {/* End live button */}
                            <button
                                onClick={endLive}
                                disabled={ending}
                                className="w-full flex items-center justify-center gap-2 bg-red-600/20 text-red-400 border border-red-500/30 font-bold py-3 rounded-xl hover:bg-red-600/30 transition-colors"
                            >
                                {ending ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Finalizando...</>
                                ) : (
                                    <><Square className="h-4 w-4" /> Finalizar transmisión</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
