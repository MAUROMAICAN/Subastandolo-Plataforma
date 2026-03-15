// @ts-nocheck — LiveKit types
// LiveKitViewer — uses raw livekit-client for reliable remote track viewing
import { useState, useEffect, useRef } from "react";
import { Room, RoomEvent, Track, ConnectionState, RemoteTrackPublication } from "livekit-client";
import { Users, Loader2 } from "lucide-react";

interface LiveKitViewerProps {
    token: string;
    serverUrl: string;
    isLive?: boolean;
    viewerCount?: number;
}

export default function LiveKitViewer({ token, serverUrl, isLive, viewerCount }: LiveKitViewerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const roomRef = useRef<Room | null>(null);
    const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
    const [participants, setParticipants] = useState(viewerCount || 0);
    const [status, setStatus] = useState("Conectando con el dealer...");
    const connectAttempted = useRef(false);

    const attachRemoteVideo = (track: MediaStreamTrack) => {
        if (videoRef.current) {
            const stream = new MediaStream([track]);
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
            setHasRemoteVideo(true);
            console.log("[LiveKitViewer] ✅ Remote video attached");
        }
    };

    useEffect(() => {
        if (connectAttempted.current) return;
        connectAttempted.current = true;

        const room = new Room();
        roomRef.current = room;

        console.log("[LiveKitViewer] Connecting to:", serverUrl, "token length:", token?.length);

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
            console.log("[LiveKitViewer] Connection state:", state);
            if (state === ConnectionState.Connected) {
                setStatus("Conectado, esperando video del dealer...");
            }
        });

        room.on(RoomEvent.ParticipantConnected, () => {
            setParticipants(room.remoteParticipants.size);
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
            setParticipants(room.remoteParticipants.size);
        });

        // When a remote track is subscribed (dealer's camera)
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log("[LiveKitViewer] Track subscribed:", track.kind, track.source, "from:", participant.identity);
            if (track.kind === Track.Kind.Video && track.source === Track.Source.Camera) {
                attachRemoteVideo(track.mediaStreamTrack);
            }
            // Auto-play audio
            if (track.kind === Track.Kind.Audio) {
                const audioEl = track.attach();
                document.body.appendChild(audioEl);
                console.log("[LiveKitViewer] ✅ Audio attached");
            }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
            console.log("[LiveKitViewer] Track unsubscribed:", track.kind, track.source);
            if (track.kind === Track.Kind.Video) {
                setHasRemoteVideo(false);
                if (videoRef.current) videoRef.current.srcObject = null;
            }
            // Clean up audio elements
            track.detach().forEach((el) => el.remove());
        });

        const connect = async () => {
            try {
                await room.connect(serverUrl, token);
                console.log("[LiveKitViewer] ✅ Connected! Participants:", room.remoteParticipants.size);
                setParticipants(room.remoteParticipants.size);

                // Check if dealer is already publishing
                room.remoteParticipants.forEach((participant) => {
                    participant.trackPublications.forEach((pub) => {
                        if (pub.track && pub.source === Track.Source.Camera) {
                            console.log("[LiveKitViewer] Found existing camera track from:", participant.identity);
                            attachRemoteVideo(pub.track.mediaStreamTrack);
                        }
                    });
                });
            } catch (err: any) {
                console.error("[LiveKitViewer] ❌ Connection failed:", err);
                setStatus("Error de conexión: " + err.message);
            }
        };

        connect();

        return () => {
            room.disconnect();
            roomRef.current = null;
        };
    }, [token, serverUrl]);

    return (
        <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '70vh' }}>
            {/* Video element — always rendered */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: hasRemoteVideo ? "block" : "none",
                }}
            />

            {/* Loading state when no remote video */}
            {!hasRemoteVideo && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-10 w-10 text-accent animate-spin" />
                    <p className="text-muted-foreground text-sm">{status}</p>
                </div>
            )}

            {/* Live badge */}
            {isLive && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    EN VIVO
                </div>
            )}

            {/* Viewer count */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                <Users className="h-3.5 w-3.5" />
                {participants}
            </div>
        </div>
    );
}
