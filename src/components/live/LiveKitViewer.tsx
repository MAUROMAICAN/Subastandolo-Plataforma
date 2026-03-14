// @ts-nocheck — LiveKit types
import { useState, useEffect } from "react";
import {
    LiveKitRoom,
    VideoTrack,
    useTracks,
    useRoomContext,
} from "@livekit/components-react";
import { Track, RoomEvent } from "livekit-client";
import { Users, Radio, Loader2 } from "lucide-react";

interface LiveKitViewerProps {
    token: string;
    serverUrl: string;
    isLive?: boolean;
    viewerCount?: number;
}

function ViewerContent({ isLive, viewerCount }: { isLive?: boolean; viewerCount?: number }) {
    const room = useRoomContext();
    const [participants, setParticipants] = useState(viewerCount || 0);

    useEffect(() => {
        const update = () => setParticipants(room.numParticipants);
        update();
        room.on(RoomEvent.ParticipantConnected, update);
        room.on(RoomEvent.ParticipantDisconnected, update);
        return () => {
            room.off(RoomEvent.ParticipantConnected, update);
            room.off(RoomEvent.ParticipantDisconnected, update);
        };
    }, [room]);

    // Get remote video tracks (dealer's camera)
    const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
        onlySubscribed: true,
    });
    const remoteVideo = tracks.find((t) => t.participant.sid !== room.localParticipant.sid);

    if (!remoteVideo) {
        return (
            <div className="aspect-video bg-nav rounded-2xl flex flex-col items-center justify-center gap-3 relative">
                {isLive && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white" />
                        EN VIVO
                    </div>
                )}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                    <Users className="h-3.5 w-3.5" />
                    {participants}
                </div>
                <Loader2 className="h-10 w-10 text-accent animate-spin" />
                <p className="text-muted-foreground text-sm">Conectando con el dealer...</p>
            </div>
        );
    }

    return (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
            <VideoTrack
                trackRef={remoteVideo}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {isLive && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    EN VIVO
                </div>
            )}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                <Users className="h-3.5 w-3.5" />
                {participants}
            </div>
        </div>
    );
}

export default function LiveKitViewer({ token, serverUrl, isLive, viewerCount }: LiveKitViewerProps) {
    return (
        <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect={true}
            video={false}
            audio={false}
        >
            <ViewerContent isLive={isLive} viewerCount={viewerCount} />
        </LiveKitRoom>
    );
}
