import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetches the official BCV (Banco Central de Venezuela) exchange rate.
 *
 * Strategy (sources tried IN ORDER — first success wins):
 *  1. bcv.org.ve (oficial) — HTML scraping of the actual BCV website (most accurate, zero lag)
 *  2. monitordedivisavenezuela.com — tracks BCV oficial in real time
 *  3. ve.dolarapi.com — free REST API (may have 1-2 day lag, last resort)
 *  4. open.er-api.com — global exchange rate, USD→VES fallback
 *
 * IMPORTANT: The BCV publishes rates only on weekdays. The Friday rate is
 * the official rate for the entire weekend and Monday (until next publication).
 * This is correct behavior: do NOT treat weekend unchanged rate as a bug.
 *
 * Called by:
 *  - Vercel cron: api/update-bcv-rate.js (Mon-Fri 9AM VET)
 *  - Admin panel "Actualizar BCV" button
 *  - Manual invocation
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

    // ── Source 1: bcv.org.ve HTML scraping (MOST ACCURATE — zero lag) ────────
    try {
        const res = await fetch("https://www.bcv.org.ve/", {
            signal: AbortSignal.timeout(10000),
            headers: {
                "Accept": "text/html,application/xhtml+xml",
                "User-Agent": "Mozilla/5.0 (compatible; Subastandolo/2.0)",
                "Accept-Language": "es-VE,es;q=0.9",
            },
        });
        if (res.ok) {
            const html = await res.text();
            // BCV rate appears in the HTML as: id="dolar" ... <strong>457,07</strong>
            // Try multiple patterns to handle site layout changes
            const patterns = [
                /<section[^>]*id=["']dolar["'][^>]*>[\s\S]*?<strong>([\d,\.]+)<\/strong>/i,
                /id="dolar"[\s\S]{0,500}?<strong>([\d,.]+)<\/strong>/i,
                /"dolar"[\s\S]{0,800}?([\d]{3,4}[,\.]\d{2})/,
            ];
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    const raw = match[1].replace(",", ".");
                    const parsed = parseFloat(raw);
                    if (!isNaN(parsed) && parsed > 100 && parsed < 5000) {
                        rate = parsed;
                        source = "bcv.org.ve (scraping oficial)";
                        console.log(`[BCV] Scraped from bcv.org.ve: ${rate}`);
                        break;
                    }
                }
            }
            if (!rate) {
                errors.push("bcv.org.ve: pattern not found in HTML (layout may have changed)");
            }
        } else {
            errors.push(`bcv.org.ve HTTP ${res.status}`);
        }
    } catch (e) {
        errors.push(`bcv.org.ve: ${(e as Error).message}`);
    }

    // ── Source 2: monitordedivisavenezuela.com (tracks BCV oficial in real time) ──
    if (!rate) {
        try {
            const res = await fetch("https://monitordedivisavenezuela.com/", {
                signal: AbortSignal.timeout(8000),
                headers: {
                    "Accept": "text/html,application/xhtml+xml",
                    "User-Agent": "Mozilla/5.0 (compatible; Subastandolo/2.0)",
                },
            });
            if (res.ok) {
                const html = await res.text();
                // Usually shows: BCV ... 457,07
                const patterns = [
                    /bcv[\s\S]{0,300}?([\d]{3,4}[,\.]\d{2})/i,
                    /oficial[\s\S]{0,200}?([\d]{3,4}[,\.]\d{2})/i,
                ];
                for (const pattern of patterns) {
                    const match = html.match(pattern);
                    if (match) {
                        const raw = match[1].replace(",", ".");
                        const parsed = parseFloat(raw);
                        if (!isNaN(parsed) && parsed > 100 && parsed < 5000) {
                            rate = parsed;
                            source = "monitordedivisavenezuela.com";
                            console.log(`[BCV] Rate from monitordivisa: ${rate}`);
                            break;
                        }
                    }
                }
                if (!rate) errors.push("monitordedivisavenezuela.com: no BCV rate found");
            } else {
                errors.push(`monitordedivisavenezuela.com HTTP ${res.status}`);
            }
        } catch (e) {
            errors.push(`monitordedivisavenezuela.com: ${(e as Error).message}`);
        }
    }

    // ── Source 3: ve.dolarapi.com (free API, can have 1-2 day lag) ──────────
    if (!rate) {
        try {
            const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
                signal: AbortSignal.timeout(7000),
                headers: { "Accept": "application/json", "User-Agent": "Subastandolo/2.0" },
            });
            if (res.ok) {
                const data = await res.json();
                const value = data?.promedio ?? data?.venta ?? data?.compra;
                if (value && !isNaN(Number(value)) && Number(value) > 100) {
                    rate = Number(value);
                    source = "ve.dolarapi.com (puede tener lag de 1-2 días)";
                    console.log(`[BCV] Rate from dolarapi (may be stale): ${rate}`);
                } else {
                    errors.push("dolarapi.com: no valid rate in response");
                }
            } else {
                errors.push(`dolarapi.com HTTP ${res.status}`);
            }
        } catch (e) {
            errors.push(`dolarapi.com: ${(e as Error).message}`);
        }
    }

    // ── Source 4: open.er-api.com (global rate fallback, USD→VES) ──────────
    if (!rate) {
        try {
            const res = await fetch("https://open.er-api.com/v6/latest/USD", {
                signal: AbortSignal.timeout(7000),
                headers: { "Accept": "application/json" },
            });
            if (res.ok) {
                const data = await res.json();
                const value = data?.rates?.VES;
                if (value && !isNaN(Number(value)) && Number(value) > 100) {
                    rate = Number(value);
                    source = "open.er-api.com (VES/USD global)";
                } else {
                    errors.push("open.er-api.com: VES not found in rates");
                }
            } else {
                errors.push(`open.er-api.com HTTP ${res.status}`);
            }
        } catch (e) {
            errors.push(`open.er-api.com: ${(e as Error).message}`);
        }
    }

    if (!rate) {
        console.error("[BCV] All sources failed:", JSON.stringify(errors));
        return new Response(
            JSON.stringify({
                error: "No se pudo obtener la tasa BCV de ninguna fuente",
                sources_tried: errors,
            }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Sanity check: BCV rate should be between 100 and 5000 Bs/USD
    if (rate < 100 || rate > 5000) {
        return new Response(
            JSON.stringify({ error: `Tasa fuera de rango esperado: ${rate}`, source }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // ── Upsert to site_settings (realtime pushes to all clients) ─────────────
    const { error: dbError } = await supabase
        .from("site_settings")
        .upsert(
            {
                setting_key: "bcv_rate",
                setting_value: rate.toFixed(2),
                setting_label: `Tasa BCV (${source}) — ${new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas" })}`,
            },
            { onConflict: "setting_key" }
        );

    if (dbError) {
        console.error("[BCV] DB upsert error:", dbError);
        return new Response(
            JSON.stringify({ error: dbError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`[BCV] Rate saved: ${rate} Bs/USD (from: ${source})`);

    return new Response(
        JSON.stringify({
            rate,
            source,
            updated_at: new Date().toISOString(),
            errors_from_other_sources: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
});
