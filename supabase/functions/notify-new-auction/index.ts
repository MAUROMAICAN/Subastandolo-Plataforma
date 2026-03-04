import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { followerIds, dealerUserId, auctionTitle, auctionId, startingPrice, imageUrl, endsAt } = await req.json();
    if (!followerIds?.length || !auctionId) throw new Error("followerIds y auctionId son requeridos");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get dealer name
    const { data: dealerProf } = dealerUserId
      ? await supabaseAdmin.from("profiles").select("full_name").eq("id", dealerUserId).single()
      : { data: null };
    const dealer = dealerProf?.full_name || "Tu Dealer";

    const appUrl = "https://subastandolo.com";
    const auctionUrl = `${appUrl}/subasta/${auctionId}`;
    const title = auctionTitle || "Nueva subasta";
    const price = startingPrice ? `$${Number(startingPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "";
    const endsText = endsAt ? new Date(endsAt).toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" }) : "";

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
    <div style="background:linear-gradient(135deg,#EAB308,#F59E0B);padding:36px 30px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">🔔</div>
      <h1 style="margin:0;color:#1a1a2e;font-size:24px;font-weight:800;">¡Nueva subasta disponible!</h1>
      <p style="margin:8px 0 0;color:#1a1a2e;font-size:14px;font-weight:600;">Un dealer que sigues acaba de publicar</p>
    </div>
    ${imageUrl ? `<div style="background:#1a1a2e;padding:20px 30px;"><img src="${imageUrl}" alt="${title}" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px;display:block;" /></div>` : ""}
    <div style="padding:28px 30px;">
      <div style="background:#1a1a2e;border:1px solid #EAB30833;border-radius:12px;padding:18px 20px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:20px;">🏪</span>
          <span style="color:#EAB308;font-size:16px;font-weight:800;">${dealer}</span>
        </div>
        <p style="margin:0;color:#fff;font-size:18px;font-weight:700;line-height:1.4;">${title}</p>
        ${price ? `<div style="margin-top:12px;"><span style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Precio inicial</span><p style="margin:4px 0 0;color:#22c55e;font-size:24px;font-weight:900;">${price}</p></div>` : ""}
        ${endsText ? `<div style="margin-top:10px;border-top:1px solid #2a2a4e;padding-top:10px;"><span style="color:#9ca3af;font-size:12px;">⏰ Cierra: <strong style="color:#b0b0c0;">${endsText}</strong></span></div>` : ""}
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${auctionUrl}" style="display:inline-block;background:linear-gradient(135deg,#EAB308,#F59E0B);color:#1a1a2e;font-weight:800;font-size:16px;padding:16px 48px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(234,179,8,0.35);">
          🔨 Ver Subasta Ahora
        </a>
      </div>
    </div>
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">El mejor postor siempre gana 🔨</p>
      <p style="color:#555;font-size:11px;margin:0;">Recibes esto porque sigues a ${dealer} · SUBASTANDOLO</p>
    </div>
  </div>
</body>
</html>`;

    // Resolve emails and send one by one
    const results = [];
    for (const uid of followerIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
      const email = u?.user?.email;
      if (!email) continue;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SUBASTANDOLO <no-reply@subastandolo.com>",
          to: [email],
          subject: `🔔 ${dealer} publicó: "${title}" — ¡Puja ahora!`,
          html,
        }),
      });
      if (res.ok) results.push(email);
    }

    return new Response(JSON.stringify({ success: true, sent: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
