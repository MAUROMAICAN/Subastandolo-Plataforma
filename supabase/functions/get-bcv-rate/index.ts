import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("site_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["bcv_rate", "commission_percentage"]);

    if (error) throw error;

    const settings: Record<string, string | null> = {};
    for (const row of data || []) {
      settings[row.setting_key] = row.setting_value;
    }

    const rate = parseFloat(settings["bcv_rate"] || "");
    const commission = parseFloat(settings["commission_percentage"] || "0");

    if (isNaN(rate)) {
      return new Response(
        JSON.stringify({ error: "Tasa BCV no configurada", rate: null, commission: 0 }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ rate, commission, last_update: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching BCV rate:", error);
    return new Response(
      JSON.stringify({ error: error.message, rate: null, commission: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
