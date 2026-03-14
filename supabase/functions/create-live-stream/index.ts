import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: must be a dealer (authenticated user)
  const { getCallerUser, unauthorized } = await import("../_shared/auth.ts");
  const user = await getCallerUser(req);
  if (!user) return unauthorized(corsHeaders);

  try {
    const { event_id } = await req.json();
    if (!event_id) throw new Error("event_id es requerido");

    const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID");
    const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET");
    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) throw new Error("Mux API keys no configuradas");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify event belongs to this dealer
    const { data: event, error: evError } = await supabaseAdmin
      .from("live_events")
      .select("id, dealer_id, status, mux_live_stream_id")
      .eq("id", event_id)
      .single();

    if (evError || !event) throw new Error("Evento no encontrado");
    if (event.dealer_id !== user.id) throw new Error("No tienes permiso para este evento");
    if (event.mux_live_stream_id) throw new Error("Este evento ya tiene un stream creado");

    // Create live stream via Mux API
    const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    const muxRes = await fetch("https://api.mux.com/video/v1/live-streams", {
      method: "POST",
      headers: {
        Authorization: `Basic ${muxAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        playback_policy: ["public"],
        new_asset_settings: { playback_policy: ["public"] },
        reduced_latency: true,
        latency_mode: "low",
      }),
    });

    if (!muxRes.ok) {
      const errText = await muxRes.text();
      throw new Error(`Mux API error: ${errText}`);
    }

    const muxData = await muxRes.json();
    const liveStream = muxData.data;

    // Update event with Mux data
    const { error: updateError } = await supabaseAdmin
      .from("live_events")
      .update({
        mux_live_stream_id: liveStream.id,
        mux_stream_key: liveStream.stream_key,
        mux_playback_id: liveStream.playback_ids?.[0]?.id || null,
        status: "live",
        started_at: new Date().toISOString(),
      })
      .eq("id", event_id);

    if (updateError) throw new Error(`Error actualizando evento: ${updateError.message}`);

    return new Response(JSON.stringify({
      success: true,
      stream_key: liveStream.stream_key,
      playback_id: liveStream.playback_ids?.[0]?.id,
      rtmp_url: "rtmps://global-live.mux.com:443/app",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
