import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth guard: authenticated user or service role ──
  const { isServiceRoleOrUser, unauthorized } = await import("../_shared/auth.ts");
  if (!await isServiceRoleOrUser(req)) return unauthorized(corsHeaders);

  try {
    const { email, name, auctionTitle, auctionId, trackingNumber, shippingCompany, imageUrl } = await req.json();
    if (!email || !auctionId) throw new Error("email y auctionId son requeridos");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const appUrl = "https://subastandolo.com";
    const auctionUrl = `${appUrl}/subasta/${auctionId}`;
    const userName = name || "Usuario";
    const title = auctionTitle || "tu producto";
    const tracking = trackingNumber || "N/D";
    const company = shippingCompany || "Empresa de envío";

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:36px 30px;text-align:center;">
      <div style="font-size:52px;margin-bottom:10px;">📦</div>
      <h1 style="margin:0;color:#fff;font-size:25px;font-weight:800;">¡Tu pedido está en camino!</h1>
      <p style="margin:8px 0 0;color:#ddd6fe;font-size:14px;">El dealer ha registrado la guía de envío.</p>
    </div>

    <!-- Product image -->
    ${imageUrl ? `
    <div style="background:#1a1a2e;padding:20px 30px;">
      <img src="${imageUrl}" alt="${title}" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;display:block;" />
    </div>` : ""}

    <!-- Body -->
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 6px;">¡Hola, <strong style="color:#EAB308;">${userName}</strong>! 🚚</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Tu producto <strong style="color:#fff;">"${title}"</strong> ha sido despachado.
        Puedes hacer seguimiento con los datos de envío abajo.
      </p>

      <!-- Tracking info -->
      <div style="background:#1a1a2e;border:1px solid #8b5cf633;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="margin-bottom:12px;">
          <p style="margin:0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Empresa de envío</p>
          <p style="margin:0;color:#fff;font-size:16px;font-weight:700;">${company}</p>
        </div>
        <div style="border-top:1px solid #2a2a4e;padding-top:12px;">
          <p style="margin:0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Número de guía</p>
          <p style="margin:0;color:#a78bfa;font-size:20px;font-weight:900;font-family:monospace;letter-spacing:2px;">${tracking}</p>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${auctionUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#EAB308,#F59E0B);color:#1a1a2e;font-weight:800;font-size:15px;padding:15px 44px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(234,179,8,0.3);">
          🚚 Ver Estado de mi Envío
        </a>
      </div>

      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #8b5cf6;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;">
          ⏱️ El tiempo de entrega varía según la empresa y tu ubicación. Si no recibes tu producto en el tiempo acordado, puedes abrir una <strong style="color:#fff;">disputa</strong> desde tu panel.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">¡Tu compra está protegida en todo momento! 🛡️</p>
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
        subject: `📦 Tu pedido va en camino — Guía: ${tracking}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await logEmail(supabaseAdmin, { recipient_email: email, recipient_name: userName, email_type: "shipment", subject: `📦 Tu pedido va en camino — Guía: ${tracking}`, auction_id: auctionId, auction_title: title, status: "failed", error_message: errText, metadata: { tracking_number: trackingNumber, shipping_company: shippingCompany } });
      throw new Error(errText);
    }
    const result = await res.json();
    await logEmail(supabaseAdmin, { recipient_email: email, recipient_name: userName, email_type: "shipment", subject: `📦 Tu pedido va en camino — Guía: ${tracking}`, auction_id: auctionId, auction_title: title, status: "sent", resend_id: result.id, metadata: { tracking_number: trackingNumber, shipping_company: shippingCompany } });
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
