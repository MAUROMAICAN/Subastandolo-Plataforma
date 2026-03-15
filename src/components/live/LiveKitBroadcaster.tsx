// LiveKitBroadcaster — uses raw livekit-client for full control on mobile
import { useState, useCallback, useEffect, useRef } from "react";
import { Room, RoomEvent, Track, ConnectionState } from "livekit-client";
import { RefreshCw, Mic, MicOff, Camera, CameraOff, Users, Loader2 } from "lucide-react";

interface LiveKitBroadcasterProps {
    token: string;
    serverUrl: string;
    onDisconnect?: () => void;
}

export default function LiveKitBroadcaster({ token, serverUrl }: LiveKitBroadcasterProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const roomRef = useRef<Room | null>(null);
    const [hasVideo, setHasVideo] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [participantCount, setParticipantCount] = useState(0);
    const [status, setStatus] = useState("Conectando...");
    const [error, setError] = useState<string | null>(null);
    const connectAttempted = useRef(false);
    const pendingTrack = useRef<MediaStreamTrack | null>(null);

    // Attach video track to the <video> element
    const attachVideo = useCallback((track: MediaStreamTrack) => {
        if (videoRef.current) {
            const stream = new MediaStream([track]);
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
            pendingTrack.current = null;
            console.log("[LiveKitBroadcaster] ✅ Video attached to element");
        } else {
            // Video element not rendered yet — store the track for later
            pendingTrack.current = track;
            console.log("[LiveKitBroadcaster] Video element not ready, storing track");
        }
    }, []);

    // When hasVideo changes to true, attach any pending track
    useEffect(() => {
        if (hasVideo && pendingTrack.current && videoRef.current) {
            const stream = new MediaStream([pendingTrack.current]);
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
            pendingTrack.current = null;
            console.log("[LiveKitBroadcaster] ✅ Pending track attached after render");
        }
    }, [hasVideo]);

    useEffect(() => {
        if (connectAttempted.current) return;
        connectAttempted.current = true;

        const room = new Room({
            videoCaptureDefaults: {
                facingMode: "user",
                resolution: { width: 480, height: 854 },
            },
            publishDefaults: {
                videoCodec: "h264",
            },
        });
        roomRef.current = room;

        console.log("[LiveKitBroadcaster] Connecting to:", serverUrl);

        // Connection state
        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
            console.log("[LiveKitBroadcaster] Connection state:", state);
        });

        // Participant count
        room.on(RoomEvent.ParticipantConnected, () => {
            setParticipantCount(room.remoteParticipants.size);
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
            setParticipantCount(room.remoteParticipants.size);
        });

        // Connect and enable media
        const connect = async () => {
            try {
                await room.connect(serverUrl, token);
                console.log("[LiveKitBroadcaster] ✅ room.connect() succeeded!");

                // Enable camera
                try {
                    await room.localParticipant.setCameraEnabled(true);
                    console.log("[LiveKitBroadcaster] ✅ Camera enabled!");
                    setHasVideo(true);
                    setStatus("📡 Transmitiendo");

                    // Small delay to let React render the video element
                    setTimeout(() => {
                        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
                        if (camPub?.track) {
                            attachVideo(camPub.track.mediaStreamTrack);
                        }
                    }, 100);
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
            room.disconnect();
            roomRef.current = null;
        };
    }, [token, serverUrl, attachVideo]);

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
            setTimeout(() => {
                const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
                if (camPub?.track) attachVideo(camPub.track.mediaStreamTrack);
            }, 100);
        }
        setHasVideo(enable);
    }, [isCamOff, attachVideo]);

    const switchCamera = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;
        const newMode = facingMode === "user" ? "environment" : "user";
        setFacingMode(newMode);

        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track) {
            try {
                await (camPub.track as any).restartTrack({
                    facingMode: newMode,
                });
                console.log("[LiveKitBroadcaster] Camera switched to:", newMode);
                setTimeout(() => {
                    if (camPub.track) attachVideo(camPub.track.mediaStreamTrack);
                }, 200);
            } catch (err) {
                console.error("[LiveKitBroadcaster] Switch failed, fallback:", err);
                await room.localParticipant.setCameraEnabled(false);
                await room.localParticipant.setCameraEnabled(true, {
                    facingMode: newMode,
                    resolution: { width: 640, height: 480 },
                });
                setTimeout(() => {
                    const newPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
                    if (newPub?.track) attachVideo(newPub.track.mediaStreamTrack);
                }, 200);
            }
        }
    }, [facingMode, attachVideo]);

    const retryCamera = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;
        setError(null);
        setStatus("Reintentando cámara...");
        try {
            await room.localParticipant.setCameraEnabled(true);
            setHasVideo(true);
            setStatus("📡 Transmitiendo");
            setTimeout(() => {
                const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
                if (camPub?.track) attachVideo(camPub.track.mediaStreamTrack);
            }, 100);
        } catch (err: any) {
            setError("No se pudo activar la cámara: " + err.message);
        }
    }, [attachVideo]);

    return (
        <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '70vh' }}>
            {/* Video — always rendered, visibility controlled by hasVideo */}
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
                    display: hasVideo ? "block" : "none",
                }}
            />

            {/* Loading/error overlay when no video */}
            {!hasVideo && (
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
