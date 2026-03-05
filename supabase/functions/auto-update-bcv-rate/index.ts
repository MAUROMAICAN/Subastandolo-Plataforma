import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetches live BCV rate from external sources and upserts to site_settings.
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

    const endpoints = [
        {
            url: "https://pydolarve.org/api/v2/dollar?page=bcv",
            extract: (d: any) => d?.monitors?.usd?.price,
            name: "pydolarve.org",
        },
        {
            url: "https://ve.dolarapi.com/v1/dolares/oficial",
            extract: (d: any) => d?.promedio,
            name: "ve.dolarapi.com",
        },
    ];

    let rate: number | null = null;
    let source = "";

    for (const ep of endpoints) {
        try {
            const res = await fetch(ep.url, {
                signal: AbortSignal.timeout(6000),
                headers: { "User-Agent": "Subastandolo/1.0" },
            });
            if (!res.ok) continue;
            const data = await res.json();
            const value = ep.extract(data);
            if (value && !isNaN(Number(value)) && Number(value) > 0) {
                rate = Number(value);
                source = ep.name;
                break;
            }
        } catch (e) {
            console.error(`Error fetching from ${ep.name}:`, e);
        }
    }

    if (!rate) {
        return new Response(
            JSON.stringify({ error: "Could not fetch rate from any source", rate: null }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Upsert to site_settings (realtime will push to all connected clients)
    const { error } = await supabase
        .from("site_settings")
        .upsert(
            {
                setting_key: "bcv_rate",
                setting_value: rate.toFixed(2),
                setting_label: `Tasa BCV (auto-actualizada desde ${source})`,
            },
            { onConflict: "setting_key" }
        );

    if (error) {
        console.error("DB upsert error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({ rate, source, updated_at: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
});
