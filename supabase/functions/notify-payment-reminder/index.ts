import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const { email, name, auctionTitle, auctionId, winningBid, imageUrl, userId, operationNumber, auctionDate } = await req.json();
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
        const title = auctionTitle || "la subasta";
        const amount = winningBid ? `$${Number(winningBid).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "";
        const opNumber = operationNumber || "N/A";
        const dateStr = auctionDate || new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

        const subject = `⚠️ Acción requerida: Pago pendiente de tu subasta "${title}"`;

        const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:36px 30px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">⚠️</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Pago Pendiente</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Acción requerida para completar tu compra</p>
    </div>

    ${imageUrl ? `
    <div style="background:#1a1a2e;padding:20px 30px;">
      <img src="${imageUrl}" alt="${title}" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;display:block;" />
    </div>` : ""}

    <!-- Body -->
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 6px;">Estimado/a <strong style="color:#EAB308;">${userName}</strong>,</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Esperamos que se encuentre muy bien. Nos ponemos en contacto desde el equipo de gestión de <strong style="color:#e0e0e0;">Subastándolo</strong> para informarle que, a la fecha, no hemos recibido la confirmación del pago correspondiente a su subasta.
      </p>

      <!-- Auction Details Box -->
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="margin:0 0 14px;font-size:14px;color:#EAB308;font-weight:700;">📋 Detalles de la subasta:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:13px;width:140px;">Artículo:</td>
            <td style="padding:6px 0;color:#e0e0e0;font-size:13px;font-weight:600;">${title}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Monto a pagar:</td>
            <td style="padding:6px 0;color:#EAB308;font-size:16px;font-weight:800;">${amount}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Nº Operación:</td>
            <td style="padding:6px 0;color:#e0e0e0;font-size:13px;font-family:monospace;">${opNumber}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Fecha subasta:</td>
            <td style="padding:6px 0;color:#e0e0e0;font-size:13px;">${dateStr}</td>
          </tr>
        </table>
      </div>

      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Para poder proceder con el envío de su artículo, es necesario completar la transacción a la brevedad. Puede realizar el pago y subir su comprobante directamente desde la plataforma:
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${auctionUrl}" style="display:inline-block;background:linear-gradient(135deg,#EAB308,#F59E0B);color:#000;padding:14px 40px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(234,179,8,0.3);">
          💳 Completar Pago Ahora
        </a>
      </div>

      <!-- Already paid note -->
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #22c55e;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;line-height:1.6;">
          ✅ <strong style="color:#22c55e;">¿Ya realizaste el pago?</strong> Ignora este mensaje y continúa el proceso subiendo tu comprobante en la plataforma de inmediato.
        </p>
      </div>

      <!-- Support note -->
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #3b82f6;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;line-height:1.6;">
          💬 <strong style="color:#60a5fa;">¿Tienes algún inconveniente?</strong> No dudes en contactarnos. Estamos aquí para ayudarte a finalizar tu proceso con éxito.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">Tu compra está protegida por Subastandolo 🛡️</p>
      <p style="color:#555;font-size:11px;margin:0 0 4px;">Este es un recordatorio automático. Si ya completaste tu pago, por favor haz caso omiso.</p>
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
                subject,
                html,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            await logEmail(supabaseAdmin, {
                recipient_email: email, recipient_name: userName, recipient_id: userId,
                email_type: "payment_reminder", subject,
                auction_id: auctionId, auction_title: title, status: "failed", error_message: errText,
                metadata: { winning_bid: winningBid, operation_number: opNumber },
            });
            throw new Error(errText);
        }
        const result = await res.json();

        await logEmail(supabaseAdmin, {
            recipient_email: email, recipient_name: userName, recipient_id: userId,
            email_type: "payment_reminder", subject,
            auction_id: auctionId, auction_title: title, status: "sent", resend_id: result.id,
            metadata: { winning_bid: winningBid, operation_number: opNumber },
        });

        // Push notification
        if (userId) {
            try {
                await supabaseAdmin.functions.invoke("notify-push", {
                    body: {
                        user_id: userId,
                        title: `⚠️ Pago pendiente: "${title}"`,
                        body: `Recuerda completar tu pago de ${amount} para recibir tu producto.`,
                        data: { url: `/subasta/${auctionId}` },
                    },
                });
            } catch (_e) { /* push optional */ }
        }

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
