import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

// Auto-fetch BCV rate from public API (fallback if no manual rate set)
const useApiBCVRate = () => {
    const [rate, setRate] = useState<number | null>(null);
    useEffect(() => {
        const fetchRate = async () => {
            // Primary: pydolarve.org (may be intermittently down)
            // Secondary: ve.dolarapi.com as fallback
            const endpoints = [
                { url: "https://pydolarve.org/api/v2/dollar?page=bcv", extract: (d: any) => d?.monitors?.usd?.price },
                { url: "https://ve.dolarapi.com/v1/dolares/oficial", extract: (d: any) => d?.promedio },
            ];
            for (const ep of endpoints) {
                try {
                    const res = await fetch(ep.url, { signal: AbortSignal.timeout(5000) });
                    if (!res.ok) continue;
                    const data = await res.json();
                    const value = ep.extract(data);
                    if (value && !isNaN(Number(value))) {
                        setRate(Number(value));
                        return; // got a value, stop trying
                    }
                } catch { /* try next */ }
            }
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
    const tickerSpeed = parseInt(getSetting("ticker_speed", "50"), 10);

    const text = message?.trim();

    // If both are empty/invalid, don't render the top bar at all
    if (!text && (!bcvRate || isNaN(bcvRate) || bcvRate <= 0)) {
        return null;
    }

    // Create a gap
    const gap = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0";

    return (
        <div className="relative bg-[#244299] overflow-hidden border-b border-white/10" style={{ height: "34px" }}>
            <div className="flex items-center h-full">
                {/* BCV Rate - fixed left badge */}
                {bcvRate && !isNaN(bcvRate) && bcvRate > 0 && (
                    <div className="shrink-0 flex items-center gap-1.5 px-4 h-full border-r border-white/10 bg-[#244299] z-10 relative">
                        <TrendingUp className="h-3 w-3 text-accent" />
                        <span className="text-[11px] font-bold text-white/90 whitespace-nowrap">
                            BCV: <span className="text-accent">{bcvRate.toFixed(2)}</span> Bs/$
                        </span>
                    </div>
                )}

                {/* Scrolling announcement (Seamless infinite loop) */}
                {text && (
                    <div className="flex-1 overflow-hidden relative h-full flex items-center">
                        <div
                            className="flex items-center whitespace-nowrap text-[11px] font-medium text-white/70 tracking-wide w-max"
                            style={{
                                animation: `ticker-scroll ${tickerSpeed}s linear infinite`,
                                willChange: "transform"
                            }}
                        >
                            {/* We output the text numerous times in two identical wrapper blocks so it loops seamlessly at -50% */}
                            <div className="flex items-center shrink-0">
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                            </div>
                            <div className="flex items-center shrink-0">
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                                <span>{text}{gap}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); } 
        }
      `}</style>
        </div>
    );
};

export default AnnouncementTicker;
