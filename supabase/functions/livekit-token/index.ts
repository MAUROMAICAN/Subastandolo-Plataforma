import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@5.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: verify user JWT using service role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user token
    const token = authHeader.replace("Bearer ", "");
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) throw new Error("No autorizado");

    const { event_id, role } = await req.json();
    if (!event_id) throw new Error("event_id requerido");

    // Get LiveKit credentials
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      throw new Error("LiveKit no configurado. Faltan LIVEKIT_API_KEY, LIVEKIT_API_SECRET o LIVEKIT_URL");
    }

    // Verify event exists
    const { data: event } = await admin
      .from("live_events")
      .select("id, dealer_id, status")
      .eq("id", event_id)
      .single();

    if (!event) throw new Error("Evento no encontrado");

    const roomName = `live-${event_id}`;
    const isDealer = event.dealer_id === user.id;
    const canPublish = role === "publisher" && isDealer;

    // Build LiveKit JWT token manually using jose
    const secret = new TextEncoder().encode(LIVEKIT_API_SECRET);
    const now = Math.floor(Date.now() / 1000);

    const jwt = await new SignJWT({
      sub: user.id,
      iss: LIVEKIT_API_KEY,
      nbf: now,
      exp: now + 14400, // 4 hours
      name: user.email || "Usuario",
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: canPublish,
        canSubscribe: true,
        canPublishData: true,
      },
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .sign(secret);

    // If dealer is going live, update room name in DB
    if (canPublish) {
      await admin
        .from("live_events")
        .update({ livekit_room_name: roomName })
        .eq("id", event_id);
    }

    return new Response(JSON.stringify({
      token: jwt,
      url: LIVEKIT_URL,
      room: roomName,
      role: canPublish ? "publisher" : "subscriber",
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
