import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceRoleOrAdmin, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth guard: only service role or admin can release funds ──
  if (!await isServiceRoleOrAdmin(req)) return unauthorized(corsHeaders);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find auctions where:
    // - payment_status = 'escrow'
    // - delivery_status = 'delivered'
    // - delivered_at is more than 72 hours ago
    // - funds_frozen = false (no active dispute)
    // - funds_released_at is null
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { data: eligible, error } = await supabaseAdmin
      .from("auctions")
      .select("id, title, created_by")
      .eq("payment_status", "escrow")
      .eq("delivery_status", "delivered")
      .eq("funds_frozen", false)
      .is("funds_released_at", null)
      .lt("delivered_at", cutoff);

    if (error) throw error;

    const released: string[] = [];
    for (const auction of eligible || []) {
      // Check no open dispute exists for this auction
      const { data: disputes } = await supabaseAdmin
        .from("disputes")
        .select("id")
        .eq("auction_id", auction.id)
        .in("status", ["open", "mediation"]);

      if (disputes && disputes.length > 0) continue;

      await supabaseAdmin
        .from("auctions")
        .update({
          payment_status: "released",
          funds_released_at: new Date().toISOString(),
        })
        .eq("id", auction.id);

      released.push(auction.id);
    }

    return new Response(
      JSON.stringify({ success: true, released_count: released.length, released_ids: released }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
