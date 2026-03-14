import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: must be the dealer who owns the event
  const { getCallerUser, unauthorized } = await import("../_shared/auth.ts");
  const user = await getCallerUser(req);
  if (!user) return unauthorized(corsHeaders);

  try {
    const { event_id } = await req.json();
    if (!event_id) throw new Error("event_id es requerido");

    const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID");
    const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET");

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
    if (event.status === "ended") throw new Error("Este evento ya finalizó");

    // Disable Mux live stream if we have API keys and a stream ID
    if (MUX_TOKEN_ID && MUX_TOKEN_SECRET && event.mux_live_stream_id) {
      try {
        const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
        await fetch(`https://api.mux.com/video/v1/live-streams/${event.mux_live_stream_id}`, {
          method: "PUT",
          headers: {
            Authorization: `Basic ${muxAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "disabled" }),
        });
      } catch (muxErr) {
        console.warn("[end-live-stream] Mux disable error:", muxErr);
      }
    }

    // Mark all remaining active products as unsold
    await supabaseAdmin
      .from("live_event_products")
      .update({ status: "unsold", ended_at: new Date().toISOString() })
      .eq("event_id", event_id)
      .in("status", ["pending", "active"]);

    // Update event status
    const { error: updateError } = await supabaseAdmin
      .from("live_events")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", event_id);

    if (updateError) throw new Error(`Error finalizando evento: ${updateError.message}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
