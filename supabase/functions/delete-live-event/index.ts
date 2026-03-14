import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Get user from JWT - robust auth that always works
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user's JWT using service role client
    const authClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error("[delete-live-event] Auth error:", authError);
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id } = await req.json();
    if (!event_id) throw new Error("event_id es requerido");

    // Admin client for all operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify event belongs to this dealer
    const { data: event, error: evError } = await supabaseAdmin
      .from("live_events")
      .select("id, dealer_id")
      .eq("id", event_id)
      .single();

    if (evError || !event) throw new Error("Evento no encontrado");
    if (event.dealer_id !== user.id) throw new Error("No tienes permiso");

    // Delete ALL related data (order matters for FK constraints)
    const { data: products } = await supabaseAdmin
      .from("live_event_products")
      .select("id")
      .eq("event_id", event_id);
    
    if (products && products.length > 0) {
      const productIds = products.map((p: { id: string }) => p.id);
      await supabaseAdmin.from("live_bids").delete().in("product_id", productIds);
    }

    await supabaseAdmin.from("live_chat_bans").delete().eq("event_id", event_id);
    await supabaseAdmin.from("live_reports").delete().eq("event_id", event_id);
    await supabaseAdmin.from("live_moderation_log").delete().eq("event_id", event_id);
    await supabaseAdmin.from("live_chat").delete().eq("event_id", event_id);
    await supabaseAdmin.from("live_event_products").delete().eq("event_id", event_id);

    const { error: delError } = await supabaseAdmin
      .from("live_events")
      .delete()
      .eq("id", event_id);

    if (delError) throw new Error(`Error eliminando: ${delError.message}`);

    console.log("[delete-live-event] Success, deleted event:", event_id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[delete-live-event] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
