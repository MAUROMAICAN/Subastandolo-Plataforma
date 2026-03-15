// @ts-nocheck — LiveKit types
import { useState, useCallback, useEffect } from "react";
import {
    LiveKitRoom,
    VideoTrack,
    useTracks,
    useLocalParticipant,
    useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
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
        // Restart camera with new facing mode
        await localParticipant.setCameraEnabled(false);
        await localParticipant.setCameraEnabled(true, {
            facingMode: newMode,
            resolution: { width: 1280, height: 720 },
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
                <div className="w-full h-full flex items-center justify-center">
                    <CameraOff className="h-12 w-12 text-white/30" />
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
                    {/* Toggle mic */}
                    <button
                        onClick={toggleMic}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isMuted ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30"
                        }`}
                    >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>

                    {/* Switch camera */}
                    <button
                        onClick={switchCamera}
                        className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>

                    {/* Toggle camera */}
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
    return (
        <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect={true}
            video={true}
            audio={true}
            onConnected={() => console.log("[LiveKitBroadcaster] ✅ Room connected!")}
            onDisconnected={() => {
                console.log("[LiveKitBroadcaster] ⚠️ Room disconnected");
                onDisconnect?.();
            }}
            onError={(err) => console.error("[LiveKitBroadcaster] ❌ Error:", err)}
            options={{
                videoCaptureDefaults: {
                    facingMode: "user",
                    resolution: { width: 1280, height: 720 },
                },
                publishDefaults: {
                    videoCodec: "h264",
                },
            }}
        >
            <BroadcasterView onDisconnect={onDisconnect} />
        </LiveKitRoom>
    );
}
