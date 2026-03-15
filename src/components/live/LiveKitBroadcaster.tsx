// @ts-nocheck — LiveKit types
import { useState, useCallback, useEffect, useRef } from "react";
import {
    LiveKitRoom,
    VideoTrack,
    useTracks,
    useLocalParticipant,
    useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import { RefreshCw, Mic, MicOff, Camera, CameraOff, Users, Loader2 } from "lucide-react";

interface LiveKitBroadcasterProps {
    token: string;
    serverUrl: string;
    onDisconnect?: () => void;
}

function BroadcasterView({ onDisconnect }: { onDisconnect?: () => void }) {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    const [isMuted, setIsMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [participantCount, setParticipantCount] = useState(0);
    const [cameraStarting, setCameraStarting] = useState(true);
    const cameraAttempted = useRef(false);

    // Track participant count
    useEffect(() => {
        const update = () => setParticipantCount(room.numParticipants);
        update();
        room.on(RoomEvent.ParticipantConnected, update);
        room.on(RoomEvent.ParticipantDisconnected, update);
        return () => {
            room.off(RoomEvent.ParticipantConnected, update);
            room.off(RoomEvent.ParticipantDisconnected, update);
        };
    }, [room]);

    // Log connection state changes
    useEffect(() => {
        const onStateChange = (state: ConnectionState) => {
            console.log("[BroadcasterView] Connection state:", state);
        };
        room.on(RoomEvent.ConnectionStateChanged, onStateChange);
        console.log("[BroadcasterView] Initial room state:", room.state, "url:", room.serverUrl);
        return () => {
            room.off(RoomEvent.ConnectionStateChanged, onStateChange);
        };
    }, [room]);

    // Explicitly enable camera + mic after room connects
    // This is more reliable on mobile than relying on LiveKitRoom's video={true}
    useEffect(() => {
        if (cameraAttempted.current) return;
        cameraAttempted.current = true;

        const enableMedia = async () => {
            try {
                console.log("[BroadcasterView] Enabling camera...");
                await localParticipant.setCameraEnabled(true, {
                    facingMode: "user",
                    resolution: { width: 640, height: 480 },
                });
                console.log("[BroadcasterView] ✅ Camera enabled!");
            } catch (err) {
                console.error("[BroadcasterView] ❌ Camera error:", err);
                // Retry once with lower constraints
                try {
                    console.log("[BroadcasterView] Retrying camera with minimal constraints...");
                    await localParticipant.setCameraEnabled(true);
                    console.log("[BroadcasterView] ✅ Camera enabled (retry)!");
                } catch (err2) {
                    console.error("[BroadcasterView] ❌ Camera failed completely:", err2);
                }
            }

            try {
                console.log("[BroadcasterView] Enabling microphone...");
                await localParticipant.setMicrophoneEnabled(true);
                console.log("[BroadcasterView] ✅ Microphone enabled!");
            } catch (err) {
                console.error("[BroadcasterView] ❌ Microphone error:", err);
            }

            setCameraStarting(false);
        };

        // Small delay to ensure room is fully ready
        setTimeout(enableMedia, 500);
    }, [localParticipant]);

    // Get local video track
    const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
    const localVideoTrack = tracks.find(
        (t) => t.participant.sid === localParticipant.sid && t.source === Track.Source.Camera
    );

    const toggleMic = useCallback(async () => {
        await localParticipant.setMicrophoneEnabled(isMuted);
        setIsMuted(!isMuted);
    }, [localParticipant, isMuted]);

    const toggleCam = useCallback(async () => {
        await localParticipant.setCameraEnabled(isCamOff);
        setIsCamOff(!isCamOff);
    }, [localParticipant, isCamOff]);

    const switchCamera = useCallback(async () => {
        const newMode = facingMode === "user" ? "environment" : "user";
        setFacingMode(newMode);
        await localParticipant.setCameraEnabled(false);
        await localParticipant.setCameraEnabled(true, {
            facingMode: newMode,
            resolution: { width: 640, height: 480 },
        });
    }, [localParticipant, facingMode]);

    return (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
            {/* Video */}
            {localVideoTrack ? (
                <VideoTrack
                    trackRef={localVideoTrack}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: facingMode === "user" ? "scaleX(-1)" : "none",
                    }}
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    {cameraStarting ? (
                        <>
                            <Loader2 className="h-10 w-10 text-accent animate-spin" />
                            <p className="text-white/50 text-xs">Activando cámara...</p>
                        </>
                    ) : (
                        <>
                            <CameraOff className="h-12 w-12 text-white/30" />
                            <button
                                onClick={async () => {
                                    setCameraStarting(true);
                                    try {
                                        await localParticipant.setCameraEnabled(true);
                                    } catch (e) {
                                        console.error("[BroadcasterView] Manual retry failed:", e);
                                    }
                                    setCameraStarting(false);
                                }}
                                className="text-accent text-xs font-bold underline"
                            >
                                Reintentar cámara
                            </button>
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

export default function LiveKitBroadcaster({ token, serverUrl, onDisconnect }: LiveKitBroadcasterProps) {
    console.log("[LiveKitBroadcaster] Rendering with serverUrl:", serverUrl, "token length:", token?.length);
    return (
        <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect={true}
            video={false}
            audio={false}
            onConnected={() => console.log("[LiveKitBroadcaster] ✅ Room connected!")}
            onDisconnected={() => {
                console.log("[LiveKitBroadcaster] ⚠️ Room disconnected");
                onDisconnect?.();
            }}
            onError={(err) => console.error("[LiveKitBroadcaster] ❌ Error:", err)}
        >
            <BroadcasterView onDisconnect={onDisconnect} />
        </LiveKitRoom>
    );
}
