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

    console.log("[livekit-token] Config:", {
      hasKey: !!LIVEKIT_API_KEY,
      keyPrefix: LIVEKIT_API_KEY?.substring(0, 6),
      hasSecret: !!LIVEKIT_API_SECRET,
      secretLen: LIVEKIT_API_SECRET?.length,
      url: LIVEKIT_URL,
    });

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

    // Get user profile name
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const participantName = profile?.full_name || user.email || "Usuario";
    const participantIdentity = user.id;

    // Build LiveKit JWT token manually using jose
    // LiveKit expects: iss=API_KEY, sub=participant_identity, name=display_name
    // Video grants go under "video" key
    const secret = new TextEncoder().encode(LIVEKIT_API_SECRET);
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      sub: participantIdentity,
      iss: LIVEKIT_API_KEY,
      nbf: now,
      exp: now + 14400, // 4 hours
      name: participantName,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: canPublish,
        canSubscribe: true,
        canPublishData: true,
      },
    };

    console.log("[livekit-token] JWT payload:", JSON.stringify({
      sub: payload.sub.substring(0, 8) + "...",
      iss: payload.iss,
      name: payload.name,
      room: roomName,
      canPublish,
      role,
    }));

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(secret);

    // If dealer is going live, update room name in DB
    if (canPublish) {
      await admin
        .from("live_events")
        .update({ livekit_room_name: roomName })
        .eq("id", event_id);
    }

    console.log("[livekit-token] ✅ Token generated for room:", roomName, "role:", canPublish ? "publisher" : "subscriber");

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
    console.error("[livekit-token] ❌ Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

