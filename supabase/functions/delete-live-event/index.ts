import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Safe delete helper - ignores errors from non-existent tables
async function safeDelete(admin: any, table: string, column: string, value: string | string[]) {
  try {
    if (Array.isArray(value)) {
      await admin.from(table).delete().in(column, value);
    } else {
      await admin.from(table).delete().eq(column, value);
    }
  } catch (e) {
    console.warn(`[delete-live-event] skipped ${table}:`, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user JWT
    const authClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) throw new Error("No autorizado");

    const { event_id } = await req.json();
    if (!event_id) throw new Error("event_id requerido");

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify ownership
    const { data: event } = await admin
      .from("live_events")
      .select("id, dealer_id")
      .eq("id", event_id)
      .single();

    if (!event) throw new Error("Evento no encontrado");
    if (event.dealer_id !== user.id) throw new Error("Sin permiso");

    // Get product IDs for bid cleanup
    const { data: products } = await admin
      .from("live_event_products")
      .select("id")
      .eq("event_id", event_id);

    if (products && products.length > 0) {
      const ids = products.map((p: { id: string }) => p.id);
      await safeDelete(admin, "live_bids", "product_id", ids);
    }

    // Delete related data (safe - won't fail if table missing)
    await safeDelete(admin, "live_chat_bans", "event_id", event_id);
    await safeDelete(admin, "live_reports", "event_id", event_id);
    await safeDelete(admin, "live_moderation_log", "event_id", event_id);
    await safeDelete(admin, "live_chat", "event_id", event_id);
    await safeDelete(admin, "live_event_products", "event_id", event_id);

    // Delete event
    const { error: delErr } = await admin.from("live_events").delete().eq("id", event_id);
    if (delErr) throw new Error(delErr.message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[delete-live-event]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 200, // Return 200 with error in body so client can read it
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
