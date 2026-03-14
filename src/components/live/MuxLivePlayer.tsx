import MuxPlayerComponent from "@mux/mux-player-react";
import { Users, Radio } from "lucide-react";

interface MuxLivePlayerProps {
    playbackId: string | null;
    title?: string;
    viewerCount?: number;
    isLive?: boolean;
}

export default function MuxLivePlayer({ playbackId, title, viewerCount = 0, isLive = false }: MuxLivePlayerProps) {
    if (!playbackId) {
        return (
            <div className="aspect-video bg-nav rounded-2xl flex flex-col items-center justify-center gap-3 relative">
                {isLive && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white" />
                        EN VIVO
                    </div>
                )}
                <div className="absolute top-3 right-3">
                    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                        <Users className="h-3.5 w-3.5" />
                        {viewerCount}
                    </div>
                </div>
                <Radio className="h-12 w-12 text-red-500 animate-pulse" />
                <p className="text-foreground font-bold text-sm">{isLive ? "🔴 Transmisión en vivo" : "Esperando transmisión..."}</p>
                <p className="text-muted-foreground text-xs text-center px-8">
                    {isLive ? "La subasta está activa. El dealer está transmitiendo." : "El dealer aún no ha iniciado la transmisión."}
                </p>
            </div>
        );
    }

    return (
        <div className="relative rounded-2xl overflow-hidden bg-black">
            {/* Mux Player */}
            <MuxPlayerComponent
                playback-id={playbackId}
                stream-type="live"
                autoPlay="muted"
                title={title}
                style={{ width: "100%", aspectRatio: "16/9" }}
                primary-color="#A6E300"
                accent-color="#A6E300"
            />

            {/* Live badge overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
                {isLive && (
                    <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white" />
                        EN VIVO
                    </div>
                )}
            </div>

            {/* Viewer count overlay */}
            <div className="absolute top-3 right-3">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                    <Users className="h-3.5 w-3.5" />
                    {viewerCount}
                </div>
            </div>
        </div>
    );
}
