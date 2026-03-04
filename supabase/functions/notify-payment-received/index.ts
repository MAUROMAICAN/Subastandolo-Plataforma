import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dealerUserId, buyerName, auctionTitle, auctionId, amountUsd, imageUrl } = await req.json();
    if (!dealerUserId || !auctionId) throw new Error("dealerUserId y auctionId son requeridos");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: dealerUser } = await supabaseAdmin.auth.admin.getUserById(dealerUserId);
    const dealerEmail = dealerUser?.user?.email;
    if (!dealerEmail) throw new Error("Email del dealer no encontrado");

    const { data: dealerProf } = await supabaseAdmin.from("profiles").select("full_name").eq("id", dealerUserId).single();
    const dealer = dealerProf?.full_name || "Dealer";
    const buyer = buyerName || "El comprador";
    const title = auctionTitle || "tu subasta";
    const amount = amountUsd ? `$${Number(amountUsd).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "";
    const appUrl = "https://subastandolo.com";
    const panelUrl = `${appUrl}/dealer`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
    <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:36px 30px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">💰</div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">¡Comprobante de pago recibido!</h1>
      <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Nuestro equipo lo verificará a la brevedad.</p>
    </div>
    ${imageUrl ? `<div style="background:#1a1a2e;padding:20px 30px;"><img src="${imageUrl}" alt="${title}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;display:block;" /></div>` : ""}
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 6px;">Hola, <strong style="color:#EAB308;">${dealer}</strong> 👋</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        <strong style="color:#fff;">${buyer}</strong> ha enviado un comprobante de pago para
        <strong style="color:#fff;">"${title}"</strong>.
        ${amount ? `Monto declarado: <strong style="color:#3b82f6;">${amount}</strong>.` : ""}
        Tu equipo de Subastandolo lo revisará pronto.
      </p>
      <div style="background:#1a1a2e;border:1px solid #3b82f633;border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:24px;">
        <span style="display:inline-block;background:#3b82f620;color:#60a5fa;font-size:13px;font-weight:700;padding:6px 16px;border-radius:20px;border:1px solid #3b82f640;">⏳ En revisión por Subastandolo</span>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${panelUrl}" style="display:inline-block;background:linear-gradient(135deg,#EAB308,#F59E0B);color:#1a1a2e;font-weight:800;font-size:15px;padding:15px 44px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(234,179,8,0.3);">
          📊 Ver mi Panel de Dealer
        </a>
      </div>
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #22c55e;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;">✅ Una vez aprobado, deberás preparar el envío en las próximas <strong style="color:#fff;">24-48 horas</strong>.</p>
      </div>
    </div>
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">¡Gracias por vender en Subastandolo! 🔨</p>
      <p style="color:#555;font-size:11px;margin:0;">SUBASTANDOLO · Notificación automática</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SUBASTANDOLO <no-reply@subastandolo.com>",
        to: [dealerEmail],
        subject: `💰 Nuevo comprobante de pago — "${title}"`,
        html,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
