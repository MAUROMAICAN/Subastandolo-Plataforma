// LiveKitBroadcaster — uses raw livekit-client for full control on mobile
import { useState, useCallback, useEffect, useRef } from "react";
import { Room, RoomEvent, Track, ConnectionState, LocalVideoTrack } from "livekit-client";
import { RefreshCw, Mic, MicOff, Camera, CameraOff, Users, Loader2 } from "lucide-react";

interface LiveKitBroadcasterProps {
    token: string;
    serverUrl: string;
    onDisconnect?: () => void;
}

export default function LiveKitBroadcaster({ token, serverUrl, onDisconnect }: LiveKitBroadcasterProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const roomRef = useRef<Room | null>(null);
    const [connected, setConnected] = useState(false);
    const [hasVideo, setHasVideo] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [participantCount, setParticipantCount] = useState(0);
    const [status, setStatus] = useState("Conectando...");
    const [error, setError] = useState<string | null>(null);
    const connectAttempted = useRef(false);

    useEffect(() => {
        if (connectAttempted.current) return;
        connectAttempted.current = true;

        const room = new Room({
            videoCaptureDefaults: {
                facingMode: "user",
                resolution: { width: 640, height: 480 },
            },
            publishDefaults: {
                videoCodec: "h264",
            },
        });
        roomRef.current = room;

        console.log("[LiveKitBroadcaster] Connecting to:", serverUrl);
        console.log("[LiveKitBroadcaster] Token length:", token?.length);

        // Connection state
        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
            console.log("[LiveKitBroadcaster] Connection state:", state);
            if (state === ConnectionState.Connected) {
                setConnected(true);
                setStatus("Conectado! Activando cámara...");
            } else if (state === ConnectionState.Disconnected) {
                setConnected(false);
                setStatus("Desconectado");
            } else if (state === ConnectionState.Reconnecting) {
                setStatus("Reconectando...");
            }
        });

        // Participant count
        room.on(RoomEvent.ParticipantConnected, () => {
            setParticipantCount(room.remoteParticipants.size);
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
            setParticipantCount(room.remoteParticipants.size);
        });

        // Track published
        room.on(RoomEvent.LocalTrackPublished, (pub) => {
            console.log("[LiveKitBroadcaster] Track published:", pub.source);
            if (pub.source === Track.Source.Camera && pub.track) {
                setHasVideo(true);
                setStatus("📡 Transmitiendo");
                attachVideo(pub.track.mediaStreamTrack);
            }
        });

        // Connect
        const connect = async () => {
            try {
                console.log("[LiveKitBroadcaster] room.connect() starting...");
                await room.connect(serverUrl, token);
                console.log("[LiveKitBroadcaster] ✅ room.connect() succeeded!");
                setConnected(true);

                // Enable camera
                try {
                    console.log("[LiveKitBroadcaster] Enabling camera...");
                    await room.localParticipant.setCameraEnabled(true);
                    console.log("[LiveKitBroadcaster] ✅ Camera enabled!");
                    setHasVideo(true);
                    setStatus("📡 Transmitiendo");

                    // Attach video to element
                    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
                    if (camPub?.track) {
                        attachVideo(camPub.track.mediaStreamTrack);
                    }
                } catch (camErr: any) {
                    console.error("[LiveKitBroadcaster] ❌ Camera error:", camErr);
                    setError("No se pudo activar la cámara: " + camErr.message);
                }

                // Enable mic
                try {
                    await room.localParticipant.setMicrophoneEnabled(true);
                    console.log("[LiveKitBroadcaster] ✅ Mic enabled!");
                } catch (micErr: any) {
                    console.error("[LiveKitBroadcaster] ❌ Mic error:", micErr);
                }
            } catch (err: any) {
                console.error("[LiveKitBroadcaster] ❌ Connection failed:", err);
                setError("Error conectando: " + err.message);
                setStatus("Error");
            }
        };

        connect();

        return () => {
            console.log("[LiveKitBroadcaster] Cleanup — disconnecting room");
            room.disconnect();
            roomRef.current = null;
        };
    }, [token, serverUrl]);

    const attachVideo = (track: MediaStreamTrack) => {
        if (videoRef.current) {
            const stream = new MediaStream([track]);
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
        }
    };

    const toggleMic = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;
        await room.localParticipant.setMicrophoneEnabled(isMuted);
        setIsMuted(!isMuted);
    }, [isMuted]);

    const toggleCam = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;
        const enable = isCamOff;
        await room.localParticipant.setCameraEnabled(enable);
        setIsCamOff(!isCamOff);
        if (enable) {
            const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
            if (camPub?.track) {
                attachVideo(camPub.track.mediaStreamTrack);
            }
        }
        setHasVideo(enable);
    }, [isCamOff]);

    const switchCamera = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;
        const newMode = facingMode === "user" ? "environment" : "user";
        setFacingMode(newMode);
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.setCameraEnabled(true, {
            facingMode: newMode,
            resolution: { width: 640, height: 480 },
        });
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track) {
            attachVideo(camPub.track.mediaStreamTrack);
        }
    }, [facingMode]);

    const retryCamera = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;
        setError(null);
        setStatus("Reintentando cámara...");
        try {
            await room.localParticipant.setCameraEnabled(true);
            const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
            if (camPub?.track) {
                attachVideo(camPub.track.mediaStreamTrack);
            }
            setHasVideo(true);
            setStatus("📡 Transmitiendo");
        } catch (err: any) {
            setError("No se pudo activar la cámara: " + err.message);
        }
    }, []);

    return (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
            {/* Video */}
            {hasVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: facingMode === "user" ? "scaleX(-1)" : "none",
                    }}
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    {error ? (
                        <>
                            <CameraOff className="h-10 w-10 text-red-400" />
                            <p className="text-red-400 text-xs text-center px-4">{error}</p>
                            <button
                                onClick={retryCamera}
                                className="text-accent text-xs font-bold underline mt-2"
                            >
                                Reintentar cámara
                            </button>
                        </>
                    ) : (
                        <>
                            <Loader2 className="h-10 w-10 text-accent animate-spin" />
                            <p className="text-white/50 text-xs">{status}</p>
                        </>
                    )}
                </div>
            )}

            {/* Live badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                EN VIVO
            </div>

            {/* Viewer count */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                <Users className="h-3.5 w-3.5" />
                {participantCount}
            </div>

            {/* Controls bar */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={toggleMic}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isMuted ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30"
                        }`}
                    >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>

                    <button
                        onClick={switchCamera}
                        className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>

                    <button
                        onClick={toggleCam}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isCamOff ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30"
                        }`}
                    >
                        {isCamOff ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
