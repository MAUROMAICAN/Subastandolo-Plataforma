import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.6.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: verify user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) throw new Error("No autorizado");

    const { event_id, role } = await req.json();
    if (!event_id) throw new Error("event_id requerido");

    // Get LiveKit credentials
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      throw new Error("LiveKit no está configurado");
    }

    // Verify event exists
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: event } = await admin
      .from("live_events")
      .select("id, dealer_id, status")
      .eq("id", event_id)
      .single();

    if (!event) throw new Error("Evento no encontrado");

    const roomName = `live-${event_id}`;
    const isDealer = event.dealer_id === user.id;
    const participantRole = role === "publisher" && isDealer ? "publisher" : "subscriber";

    // Generate LiveKit access token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user.id,
      name: user.email || "Usuario",
      ttl: "4h",
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: participantRole === "publisher",
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // If dealer is going live, update room name in DB
    if (participantRole === "publisher") {
      await admin
        .from("live_events")
        .update({ livekit_room_name: roomName })
        .eq("id", event_id);
    }

    return new Response(JSON.stringify({
      token,
      url: LIVEKIT_URL,
      room: roomName,
      role: participantRole,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[livekit-token]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
