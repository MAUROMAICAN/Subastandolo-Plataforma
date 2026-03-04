import { useEffect, useState } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

/**
 * Returns the current BCV (Banco Central de Venezuela) exchange rate in Bs/USD.
 * Priority: admin manual rate → pydolarve.org API → ve.dolarapi.com fallback.
 */
export function useBCVRate(): number | null {
    const { getSetting } = useSiteSettings();
    const [apiRate, setApiRate] = useState<number | null>(null);

    useEffect(() => {
        const fetchRate = async () => {
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
                        setApiRate(Number(value));
                        return;
                    }
                } catch { /* try next */ }
            }
        };
        fetchRate();
        const interval = setInterval(fetchRate, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const manualRate = getSetting("bcv_rate", "");
    if (manualRate) {
        const parsed = parseFloat(manualRate);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return apiRate;
}
