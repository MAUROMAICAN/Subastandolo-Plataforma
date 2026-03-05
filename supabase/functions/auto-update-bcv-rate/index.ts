import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetches the live BCV (Banco Central de Venezuela) exchange rate from
 * multiple reliable sources and upserts it to site_settings.
 *
 * Sources tried in order (first success wins):
 *  1. ve.dolarapi.com  — official/BCV rate (most reliable, free, no auth)
 *  2. bcv-api.rafnixg.dev — BCV-specific API (free, no auth required)
 *  3. open.er-api.com — global exchange rate, USD→VES
 *  4. api.exchangerate-api.com — additional fallback, USD→VES
 *
 * Called by the admin panel "Actualizar BCV" button or a scheduled cron.
 */
serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const errors: string[] = [];
    let rate: number | null = null;
    let source = "";

    // ── Source 1: ve.dolarapi.com (tasa oficial BCV) ──────────────────────
    try {
        const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
            signal: AbortSignal.timeout(7000),
            headers: { "Accept": "application/json", "User-Agent": "Subastandolo/2.0" },
        });
        if (res.ok) {
            const data = await res.json();
            const value = data?.promedio ?? data?.venta ?? data?.compra;
            if (value && !isNaN(Number(value)) && Number(value) > 0) {
                rate = Number(value);
                source = "ve.dolarapi.com";
            } else {
                errors.push("dolarapi.com: no valid rate in response");
            }
        } else {
            errors.push(`dolarapi.com HTTP ${res.status}`);
        }
    } catch (e) {
        errors.push(`dolarapi.com: ${(e as Error).message}`);
    }

    // ── Source 2: bcv-api.rafnixg.dev ─────────────────────────────────────
    if (!rate) {
        try {
            const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
            const res = await fetch(`https://bcv-api.rafnixg.dev/rates/${today}`, {
                signal: AbortSignal.timeout(7000),
                headers: { "Accept": "application/json", "User-Agent": "Subastandolo/2.0" },
            });
            if (res.ok) {
                const data = await res.json();
                // Response shape: { date, rates: { USD: number, EUR: number, ... } }
                const usdRate = data?.rates?.USD ?? data?.USD ?? data?.usd;
                if (usdRate && !isNaN(Number(usdRate)) && Number(usdRate) > 0) {
                    rate = Number(usdRate);
                    source = "bcv-api.rafnixg.dev";
                } else {
                    errors.push("rafnixg.dev: no valid USD rate in response");
                }
            } else {
                errors.push(`rafnixg.dev HTTP ${res.status}`);
            }
        } catch (e) {
            errors.push(`rafnixg.dev: ${(e as Error).message}`);
        }
    }

    // ── Source 3: open.er-api.com (free, no key, USD→VES) ─────────────────
    if (!rate) {
        try {
            const res = await fetch("https://open.er-api.com/v6/latest/USD", {
                signal: AbortSignal.timeout(7000),
                headers: { "Accept": "application/json" },
            });
            if (res.ok) {
                const data = await res.json();
                const value = data?.rates?.VES ?? data?.rates?.VEF;
                if (value && !isNaN(Number(value)) && Number(value) > 0) {
                    rate = Number(value);
                    source = "open.er-api.com";
                } else {
                    errors.push("open.er-api.com: VES/VEF not found in rates");
                }
            } else {
                errors.push(`open.er-api.com HTTP ${res.status}`);
            }
        } catch (e) {
            errors.push(`open.er-api.com: ${(e as Error).message}`);
        }
    }

    // ── Source 4: exchangerate-api.com free tier ───────────────────────────
    if (!rate) {
        try {
            const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
                signal: AbortSignal.timeout(7000),
                headers: { "Accept": "application/json" },
            });
            if (res.ok) {
                const data = await res.json();
                const value = data?.rates?.VES ?? data?.rates?.VEF;
                if (value && !isNaN(Number(value)) && Number(value) > 0) {
                    rate = Number(value);
                    source = "exchangerate-api.com";
                } else {
                    errors.push("exchangerate-api.com: VES/VEF not found in rates");
                }
            } else {
                errors.push(`exchangerate-api.com HTTP ${res.status}`);
            }
        } catch (e) {
            errors.push(`exchangerate-api.com: ${(e as Error).message}`);
        }
    }

    if (!rate) {
        console.error("All BCV rate sources failed:", JSON.stringify(errors));
        return new Response(
            JSON.stringify({
                error: "No se pudo obtener la tasa BCV de ninguna fuente",
                sources_tried: errors,
            }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // ── Upsert to site_settings (realtime pushes to all clients) ───────────
    const { error: dbError } = await supabase
        .from("site_settings")
        .upsert(
            {
                setting_key: "bcv_rate",
                setting_value: rate.toFixed(2),
                setting_label: `Tasa BCV (auto desde ${source})`,
            },
            { onConflict: "setting_key" }
        );

    if (dbError) {
        console.error("DB upsert error:", dbError);
        return new Response(
            JSON.stringify({ error: dbError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`BCV rate updated: ${rate} (from ${source})`);

    return new Response(
        JSON.stringify({ rate, source, updated_at: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
});
