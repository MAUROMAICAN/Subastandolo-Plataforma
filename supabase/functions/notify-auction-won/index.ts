import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth guard: admin or service role ──
  const { isServiceRoleOrAdmin, unauthorized } = await import("../_shared/auth.ts");
  if (!await isServiceRoleOrAdmin(req)) return unauthorized(corsHeaders);

  try {
    const { email, name, auctionTitle, auctionId, winningBid, imageUrl, userId } = await req.json();
    if (!email || !auctionId) throw new Error("email y auctionId son requeridos");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const appUrl = "https://subastandolo.com";
    const logoUrl = `${appUrl}/logo-dark.png`;
    const auctionUrl = `${appUrl}/auction/${auctionId}`;
    const userName = name || "Usuario";
    const title = auctionTitle || "la subasta";

    // Fetch BCV rate for Bs. conversion
    let bcvRate = 0;
    try {
      const { data: rateData } = await supabaseAdmin.from("global_settings").select("value").eq("setting_key", "bcv_rate").single();
      if (rateData?.value) bcvRate = parseFloat(rateData.value);
    } catch (_) { /* fallback: no Bs. shown */ }

    const usdAmount = winningBid ? `$${Number(winningBid).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "";
    const bsAmount = (winningBid && bcvRate) ? `Bs. ${(Number(winningBid) * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
    const amount = bsAmount ? `${usdAmount} / ${bsAmount}` : usdAmount;


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

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#EAB308,#F59E0B);padding:40px 30px;text-align:center;">
      <div style="font-size:52px;margin-bottom:12px;">🏆</div>
      <h1 style="margin:0;color:#1a1a2e;font-size:26px;font-weight:800;letter-spacing:-0.5px;">¡Felicidades, ganaste!</h1>
      <p style="margin:8px 0 0;color:#1a1a2e;font-size:14px;font-weight:600;">Eres el ganador de la subasta. Procede al pago para asegurar tu compra.</p>
    </div>

    <!-- Product image -->
    ${imageUrl ? `
    <div style="background:#1a1a2e;padding:20px 30px;">
      <img src="${imageUrl}" alt="${title}" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px;display:block;" />
    </div>` : ""}

    <!-- Body -->
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 6px;">¡Hola, <strong style="color:#EAB308;">${userName}</strong>! 🎉</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Eres el ganador de <strong style="color:#fff;">"${title}"</strong>.
        ${amount ? `Tu puja ganadora fue de <strong style="color:#22c55e;">${amount}</strong>.` : ""}
        Para asegurar tu compra, realiza el pago a la cuenta oficial de Subastandolo.
      </p>

      <!-- Winning amount highlight -->
      ${amount ? `
      <div style="background:#1a1a2e;border:1px solid #22c55e33;border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Monto ganador</p>
        <p style="margin:0;color:#22c55e;font-size:32px;font-weight:900;">${amount}</p>
      </div>` : ""}

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${auctionUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:800;font-size:16px;padding:16px 48px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(34,197,94,0.35);">
          💳 Proceder al Pago
        </a>
      </div>

      <!-- Steps to receive product -->
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 14px;font-size:14px;color:#EAB308;font-weight:700;">📦 Pasos para recibir tu producto:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 10px;vertical-align:top;">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;text-align:center;line-height:28px;color:#fff;font-weight:800;font-size:13px;">1</div>
            </td>
            <td style="padding:8px 0;color:#e0e0e0;font-size:13px;line-height:1.5;">
              <strong style="color:#fff;">Realiza el pago</strong><br>
              <span style="color:#9ca3af;">Transfiere el monto a la cuenta oficial de Subastandolo (ver datos abajo). NO pagues directo al vendedor.</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 10px;vertical-align:top;">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;text-align:center;line-height:28px;color:#fff;font-weight:800;font-size:13px;">2</div>
            </td>
            <td style="padding:8px 0;color:#e0e0e0;font-size:13px;line-height:1.5;">
              <strong style="color:#fff;">Sube tu comprobante</strong><br>
              <span style="color:#9ca3af;">En la página de la subasta, sube la captura de tu transferencia. Nuestro equipo lo verificará en máximo 24 horas.</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 10px;vertical-align:top;">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;text-align:center;line-height:28px;color:#fff;font-weight:800;font-size:13px;">3</div>
            </td>
            <td style="padding:8px 0;color:#e0e0e0;font-size:13px;line-height:1.5;">
              <strong style="color:#fff;">Completa tus datos de envío</strong><br>
              <span style="color:#9ca3af;">Ingresa tu nombre, cédula, teléfono, estado, ciudad y oficina de la empresa de encomiendas donde recibirás el paquete.</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 10px;vertical-align:top;">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;text-align:center;line-height:28px;color:#fff;font-weight:800;font-size:13px;">4</div>
            </td>
            <td style="padding:8px 0;color:#e0e0e0;font-size:13px;line-height:1.5;">
              <strong style="color:#fff;">Recibe tu producto</strong><br>
              <span style="color:#9ca3af;">El vendedor enviará tu producto y te llegarán actualizaciones con el número de guía para rastrear tu envío.</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Payment instructions teaser -->
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #EAB308;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;line-height:1.6;">
          🏦 <strong style="color:#EAB308;">Cuenta BANESCO:</strong> 01340178171781043753 · RIF J413098075 · UNIFORMES KRONUS C.A<br>
          <span style="font-size:12px;color:#6b7280;">El monto en Bs. se calcula a la tasa BCV vigente al cierre de la subasta.</span>
        </p>
      </div>

      <p style="font-size:12px;color:#6b7280;margin-top:18px;text-align:center;">
        ⚠️ NO realices el pago directamente al vendedor. Solo a la cuenta oficial de Subastandolo.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">Tu compra está protegida por Subastandolo 🛡️</p>
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
        subject: `🏆 ¡Ganaste "${title}"! Procede al pago`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await logEmail(supabaseAdmin, {
        recipient_email: email, recipient_name: userName, recipient_id: userId,
        email_type: "auction_won", subject: `🏆 ¡Ganaste "${title}"! Procede al pago`,
        auction_id: auctionId, auction_title: title, status: "failed", error_message: errText,
        metadata: { winning_bid: winningBid },
      });
      throw new Error(errText);
    }
    const result = await res.json();

    await logEmail(supabaseAdmin, {
      recipient_email: email, recipient_name: userName, recipient_id: userId,
      email_type: "auction_won", subject: `🏆 ¡Ganaste "${title}"! Procede al pago`,
      auction_id: auctionId, auction_title: title, status: "sent", resend_id: result.id,
      metadata: { winning_bid: winningBid, image_url: imageUrl },
    });

    // ── Push notification nativa (FCM) ──
    if (userId) {
      try {
        await supabaseAdmin.functions.invoke("notify-push", {
          body: {
            user_id: userId,
            title: `🏆 ¡Ganaste "${title}"!`,
            message: amount ? `Tu puja de ${amount} fue la ganadora. Procede al pago.` : "Eres el ganador. Procede al pago.",
            type: "auction_won",
            link: `/auction/${auctionId}`,
          },
        });
      } catch (pushErr) {
        console.warn("[notify-auction-won] Push notification skipped:", pushErr);
      }
    }

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
