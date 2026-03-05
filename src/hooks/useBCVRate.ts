import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";

/**
 * Returns the current BCV (Banco Central de Venezuela) exchange rate in Bs/USD.
 * Priority: admin manual rate in site_settings → live fetch from external APIs.
 * When fetching from external APIs, the result is persisted to site_settings via
 * the auto-update-bcv-rate edge function so ALL connected clients receive it
 * through the realtime channel on site_settings.
 */
export function useBCVRate(): number | null {
    const { getSetting } = useSiteSettings();
    const [apiRate, setApiRate] = useState<number | null>(null);

    useEffect(() => {
        const fetchAndPersist = async () => {
            // 1. Try the edge function — it fetches live BCV and saves to site_settings
            //    site_settings realtime will then auto-push the new rate to all clients
            try {
                const { data, error } = await supabase.functions.invoke("auto-update-bcv-rate");
                if (!error && data?.rate && !isNaN(Number(data.rate))) {
                    setApiRate(Number(data.rate));
                    return;
                }
            } catch { /* fall through to direct fetch */ }

            // 2. Fallback: direct fetch if edge function fails (offline / unreachable)
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

        fetchAndPersist();
        // Refresh every 5 minutes
        const interval = setInterval(fetchAndPersist, 5 * 60 * 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Manual rate in site_settings takes priority over live API rate
    const manualRate = getSetting("bcv_rate", "");
    if (manualRate) {
        const parsed = parseFloat(manualRate);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return apiRate;
}
