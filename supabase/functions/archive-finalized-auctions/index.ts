import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const appUrl = "https://subastandolo.com";

    // Find finalized auctions that don't have an archived_at yet
    // and notify their winners
    const { data: auctions, error } = await supabase
      .from("auctions")
      .select("id, title, image_url, current_price, winner_id")
      .eq("status", "finalized")
      .is("archived_at", null)
      .not("winner_id", "is", null);

    if (error) throw error;

    let notified = 0;
    for (const auction of auctions || []) {
      if (!auction.winner_id) continue;

      // Get winner email
      const { data: winnerUser } = await supabase.auth.admin.getUserById(auction.winner_id);
      const winnerEmail = winnerUser?.user?.email;
      if (!winnerEmail) continue;

      const { data: winnerProf } = await supabase.from("profiles").select("full_name").eq("id", auction.winner_id).single();
      const winnerName = winnerProf?.full_name || "Ganador";
      const auctionUrl = `${appUrl}/auction/${auction.id}`;
      const title = auction.title || "la subasta";
      const amount = auction.current_price
        ? `$${Number(auction.current_price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
        : "";

      const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
    <div style="background:linear-gradient(135deg,#EAB308,#F59E0B);padding:40px 30px;text-align:center;">
      <div style="font-size:52px;margin-bottom:12px;">🏆</div>
      <h1 style="margin:0;color:#1a1a2e;font-size:26px;font-weight:800;">¡Felicidades, ganaste!</h1>
      <p style="margin:8px 0 0;color:#1a1a2e;font-size:14px;font-weight:600;">Eres el ganador de la subasta. ¡Procede al pago!</p>
    </div>
    ${auction.image_url ? `<div style="background:#1a1a2e;padding:20px 30px;"><img src="${auction.image_url}" alt="${title}" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px;display:block;" /></div>` : ""}
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 6px;">¡Hola, <strong style="color:#EAB308;">${winnerName}</strong>! 🎉</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Eres el ganador de <strong style="color:#fff;">"${title}"</strong>.
        ${amount ? `Tu puja ganadora: <strong style="color:#22c55e;">${amount}</strong>.` : ""}
        Para asegurar tu compra, realiza el pago a la cuenta oficial de Subastandolo.
      </p>
      ${amount ? `<div style="background:#1a1a2e;border:1px solid #22c55e33;border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:24px;"><p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Monto ganador</p><p style="margin:0;color:#22c55e;font-size:32px;font-weight:900;">${amount}</p></div>` : ""}
      <div style="text-align:center;margin:28px 0;">
        <a href="${auctionUrl}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:800;font-size:16px;padding:16px 48px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(34,197,94,0.35);">
          💳 Proceder al Pago
        </a>
      </div>
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #EAB308;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;line-height:1.6;">
          🏦 <strong style="color:#EAB308;">Cuenta BANESCO:</strong> 01340178171781043753 · RIF J413098075 · UNIFORMES KRONUS C.A<br>
          <span style="font-size:12px;color:#6b7280;">⚠️ Solo paga a esta cuenta oficial. Nunca pagues directo al vendedor.</span>
        </p>
      </div>
    </div>
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">Tu compra está protegida por Subastandolo 🛡️</p>
      <p style="color:#555;font-size:11px;margin:0;">SUBASTANDOLO · Notificación automática</p>
    </div>
  </div>
</body>
</html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SUBASTANDOLO <no-reply@subastandolo.com>",
          to: [winnerEmail],
          subject: `🏆 ¡Ganaste "${title}"! Procede al pago`,
          html,
        }),
      });
      notified++;
    }

    // Now archive them
    if (auctions && auctions.length > 0) {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("auctions")
        .update({ archived_at: new Date().toISOString() })
        .eq("status", "finalized")
        .is("archived_at", null)
        .lt("end_time", sixDaysAgo);
    }

    return new Response(
      JSON.stringify({ archived: auctions?.length || 0, winnersNotified: notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
