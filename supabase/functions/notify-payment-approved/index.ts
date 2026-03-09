import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth guard: admin or service role ──
  const { isServiceRoleOrAdmin, unauthorized } = await import("../_shared/auth.ts");
  if (!await isServiceRoleOrAdmin(req)) return unauthorized(corsHeaders);

  try {
    const { buyerUserId, auctionTitle, auctionId, imageUrl } = await req.json();
    if (!buyerUserId || !auctionId) throw new Error("buyerUserId y auctionId son requeridos");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: buyerUser } = await supabaseAdmin.auth.admin.getUserById(buyerUserId);
    const email = buyerUser?.user?.email;
    if (!email) throw new Error("Email del comprador no encontrado");

    const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", buyerUserId).single();
    const userName = prof?.full_name || "Comprador";
    const title = auctionTitle || "tu subasta";
    const appUrl = "https://subastandolo.com";
    const logoUrl = `${appUrl}/logo-dark.png`;
    const auctionUrl = `${appUrl}/auction/${auctionId}`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
    <!-- Logo Strip -->
    <div style="background:#0f0f1a;padding:16px 30px;text-align:center;border-bottom:1px solid #2a2a4e;">
      <a href="${appUrl}" style="text-decoration:none;"><img src="${logoUrl}" alt="Subastandolo" style="height:36px;" /></a>
    </div>
    <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:36px 30px;text-align:center;">
      <div style="font-size:52px;margin-bottom:10px;">✅</div>
      <h1 style="margin:0;color:#fff;font-size:25px;font-weight:800;">¡Tu pago fue aprobado!</h1>
      <p style="margin:8px 0 0;color:#dcfce7;font-size:14px;">El vendedor preparará tu envío muy pronto.</p>
    </div>
    ${imageUrl ? `<div style="background:#1a1a2e;padding:20px 30px;"><img src="${imageUrl}" alt="${title}" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;display:block;" /></div>` : ""}
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 6px;">¡Hola, <strong style="color:#EAB308;">${userName}</strong>! 🎉</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Tu comprobante de pago para <strong style="color:#fff;">"${title}"</strong> ha sido
        <strong style="color:#22c55e;">verificado y aprobado</strong> por Subastandolo.
        El vendedor ha sido notificado y procederá a preparar tu envío.
      </p>
      <div style="background:#1a1a2e;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="font-size:18px;">✅</span><span style="color:#22c55e;font-size:14px;font-weight:700;">Pago verificado</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="font-size:18px;">📦</span><span style="color:#b0b0c0;font-size:14px;">Preparación y empaque del pedido</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:18px;">🚚</span><span style="color:#b0b0c0;font-size:14px;">Envío y entrega</span>
        </div>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${auctionUrl}" style="display:inline-block;background:linear-gradient(135deg,#EAB308,#F59E0B);color:#1a1a2e;font-weight:800;font-size:15px;padding:15px 44px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(234,179,8,0.3);">
          📋 Ver Estado de mi Compra
        </a>
      </div>
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #22c55e;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;">🛡️ <strong style="color:#fff;">Tu compra está protegida.</strong> Si tienes algún inconveniente, abre una disputa desde tu panel.</p>
      </div>
    </div>
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">¡Gracias por confiar en Subastandolo! 🛡️</p>
      <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@subastandolo.com" style="color:#EAB308;text-decoration:none;font-weight:600;">soporte@subastandolo.com</a></p>
      <p style="color:#555;font-size:11px;margin:0;">SUBASTANDOLO · <a href="${appUrl}/mi-panel" style="color:#555;">Ver mi panel</a></p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SUBASTANDOLO <no-reply@subastandolo.com>",
        reply_to: "soporte@subastandolo.com",
        to: [email],
        subject: `✅ Tu pago fue aprobado — "${title}"`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await logEmail(supabaseAdmin, { recipient_email: email, recipient_name: userName, recipient_id: buyerUserId, email_type: "payment_approved", subject: `✅ Tu pago fue aprobado — "${title}"`, auction_id: auctionId, auction_title: title, status: "failed", error_message: errText });
      throw new Error(errText);
    }
    const result = await res.json();
    await logEmail(supabaseAdmin, { recipient_email: email, recipient_name: userName, recipient_id: buyerUserId, email_type: "payment_approved", subject: `✅ Tu pago fue aprobado — "${title}"`, auction_id: auctionId, auction_title: title, status: "sent", resend_id: result.id });
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
