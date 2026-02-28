import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

// Auto-fetch BCV rate from public API (fallback if no manual rate set)
const useApiBCVRate = () => {
    const [rate, setRate] = useState<number | null>(null);
    useEffect(() => {
        const fetchRate = async () => {
            try {
                const res = await fetch("https://pydolarve.org/api/v2/dollar?page=bcv", {
                    signal: AbortSignal.timeout(5000),
                });
                const data = await res.json();
                if (data?.monitors?.usd?.price) setRate(data.monitors.usd.price);
            } catch { /* silent fail */ }
        };
        fetchRate();
        const interval = setInterval(fetchRate, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);
    return rate;
};

interface AnnouncementTickerProps {
    message?: string;
}

const AnnouncementTicker = ({ message }: AnnouncementTickerProps) => {
    const { getSetting } = useSiteSettings();
    const apiRate = useApiBCVRate();

    // Manual rate from admin panel takes priority over API
    const manualRate = getSetting("bcv_rate", "");
    const bcvRate = manualRate ? parseFloat(manualRate) : apiRate;

    const defaultMessage =
        "🚀 GRAN INAUGURACIÓN 1 DE MARZO 2026 · ¡NO TE PIERDAS LAS MEJORES SUBASTAS ONLINE EN VENEZUELA! · SUBASTANDOLO - LA FORMA INTELIGENTE DE COMPRAR Y VENDER · ";
    const text = message && message.trim() ? message : defaultMessage;
    const repeated = `${text}     ${text}     ${text}`;

    return (
        <div className="relative bg-primary overflow-hidden border-b border-white/10" style={{ height: "34px" }}>
            <div className="flex items-center h-full">
                {/* BCV Rate - fixed left badge */}
                {bcvRate && !isNaN(bcvRate) && bcvRate > 0 && (
                    <div className="shrink-0 flex items-center gap-1.5 px-4 h-full border-r border-white/10 bg-white/5 z-10">
                        <TrendingUp className="h-3 w-3 text-accent" />
                        <span className="text-[11px] font-bold text-white/90 whitespace-nowrap">
                            BCV: <span className="text-accent">{bcvRate.toFixed(2)}</span> Bs/$
                        </span>
                    </div>
                )}

                {/* Scrolling announcement */}
                <div className="flex-1 overflow-hidden relative">
                    <div
                        className="flex items-center h-[34px] whitespace-nowrap text-[11px] font-medium text-white/70 tracking-wide"
                        style={{ animation: "ticker-scroll 50s linear infinite", width: "max-content" }}
                    >
                        {repeated}
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
      `}</style>
        </div>
    );
};

export default AnnouncementTicker;
