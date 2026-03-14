import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { getCallerUser, unauthorized } = await import("../_shared/auth.ts");
  const user = await getCallerUser(req);
  if (!user) return unauthorized(corsHeaders);

  try {
    const { event_id } = await req.json();
    if (!event_id) throw new Error("event_id es requerido");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify event belongs to this dealer
    const { data: event, error: evError } = await supabaseAdmin
      .from("live_events")
      .select("id, dealer_id")
      .eq("id", event_id)
      .single();

    if (evError || !event) throw new Error("Evento no encontrado");
    if (event.dealer_id !== user.id) throw new Error("No tienes permiso");

    // Delete ALL related data (order matters for FK constraints)
    // 1. Bids on products
    const { data: products } = await supabaseAdmin
      .from("live_event_products")
      .select("id")
      .eq("event_id", event_id);
    
    if (products && products.length > 0) {
      const productIds = products.map((p: { id: string }) => p.id);
      await supabaseAdmin.from("live_bids").delete().in("product_id", productIds);
    }

    // 2. Chat bans
    await supabaseAdmin.from("live_chat_bans").delete().eq("event_id", event_id);
    // 3. Reports
    await supabaseAdmin.from("live_reports").delete().eq("event_id", event_id);
    // 4. Moderation log
    await supabaseAdmin.from("live_moderation_log").delete().eq("event_id", event_id);
    // 5. Chat messages
    await supabaseAdmin.from("live_chat").delete().eq("event_id", event_id);
    // 6. Products
    await supabaseAdmin.from("live_event_products").delete().eq("event_id", event_id);
    // 7. The event itself
    const { error: delError } = await supabaseAdmin
      .from("live_events")
      .delete()
      .eq("id", event_id);

    if (delError) throw new Error(`Error eliminando evento: ${delError.message}`);

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
