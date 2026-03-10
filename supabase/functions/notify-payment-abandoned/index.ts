import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const { isServiceRoleOrAdmin, unauthorized } = await import("../_shared/auth.ts");
    if (!await isServiceRoleOrAdmin(req)) return unauthorized(corsHeaders);

    try {
        const { auctionId, auctionTitle, buyerId, dealerId, finalPrice } = await req.json();
        if (!auctionId) throw new Error("auctionId requerido");

        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const appUrl = "https://subastandolo.com";
        const logoUrl = `${appUrl}/logo-dark.png`;
        const title = auctionTitle || "la subasta";
        const price = finalPrice ? `$${Number(finalPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "";

        // Fetch buyer and dealer info
        const [buyerRes, dealerRes] = await Promise.all([
            buyerId ? supabaseAdmin.from("profiles").select("full_name, email").eq("id", buyerId).single() : null,
            dealerId ? supabaseAdmin.from("profiles").select("full_name, email").eq("id", dealerId).single() : null,
        ]);

        const buyerName = buyerRes?.data?.full_name || "Comprador";
        const buyerEmail = buyerRes?.data?.email;
        const dealerName = dealerRes?.data?.full_name || "Dealer";
        const dealerEmail = dealerRes?.data?.email;

        // ── Email to BUYER (Warning) ──
        if (buyerEmail) {
            const buyerSubject = `⛔ Subasta abandonada: "${title}" — Pago no recibido`;
            const buyerHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
    <div style="background:#0f0f1a;padding:16px 30px;text-align:center;border-bottom:1px solid #2a2a4e;">
      <a href="${appUrl}" style="text-decoration:none;"><img src="${logoUrl}" alt="Subastandolo" style="height:36px;" /></a>
    </div>
    <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:36px 30px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">⛔</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Subasta Abandonada</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Tu pago no fue recibido en el plazo establecido</p>
    </div>
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 16px;">Hola <strong style="color:#EAB308;">${buyerName}</strong>,</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Lamentamos informarte que tu subasta <strong style="color:#e0e0e0;">"${title}"</strong> ${price ? `por <strong style="color:#EAB308;">${price}</strong>` : ""} ha sido marcada como <strong style="color:#ef4444;">abandonada</strong> porque el pago no fue recibido dentro de las 48 horas posteriores al cierre.
      </p>
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #ef4444;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;line-height:1.6;">
          ⚠️ <strong style="color:#ef4444;">Importante:</strong> El incumplimiento de pago repetido puede resultar en restricciones en tu cuenta. Te recomendamos pujar solo en artículos que estés dispuesto a comprar.
        </p>
      </div>
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #3b82f6;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;line-height:1.6;">
          💬 <strong style="color:#60a5fa;">¿Fue un error?</strong> Si crees que esto es un malentendido, contáctanos a <a href="mailto:soporte@subastandolo.com" style="color:#60a5fa;">soporte@subastandolo.com</a>
        </p>
      </div>
    </div>
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#555;font-size:11px;margin:0;">SUBASTANDOLO · <a href="${appUrl}" style="color:#555;">subastandolo.com</a></p>
    </div>
  </div>
</body></html>`;

            const buyerRes2 = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    from: "SUBASTANDOLO <no-reply@subastandolo.com>",
                    reply_to: "soporte@subastandolo.com",
                    to: [buyerEmail],
                    subject: buyerSubject,
                    html: buyerHtml,
                }),
            });
            const buyerResult = buyerRes2.ok ? await buyerRes2.json() : null;
            await logEmail(supabaseAdmin, {
                recipient_email: buyerEmail, recipient_name: buyerName, recipient_id: buyerId,
                email_type: "payment_abandoned_buyer", subject: buyerSubject,
                auction_id: auctionId, auction_title: title,
                status: buyerRes2.ok ? "sent" : "failed",
                resend_id: buyerResult?.id, error_message: buyerRes2.ok ? undefined : "Send failed",
            });

            // Push to buyer
            try {
                await supabaseAdmin.functions.invoke("notify-push", {
                    body: {
                        user_id: buyerId,
                        title: `⛔ Subasta abandonada: "${title}"`,
                        body: "Tu pago no fue recibido en 48h. Contacta soporte si fue un error.",
                        data: { url: `/auction/${auctionId}` },
                    },
                });
            } catch (_) { /* push optional */ }
        }

        // ── Email to DEALER (Informative) ──
        if (dealerEmail) {
            const dealerSubject = `📋 Subasta abandonada por comprador: "${title}"`;
            const dealerHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
    <div style="background:#0f0f1a;padding:16px 30px;text-align:center;border-bottom:1px solid #2a2a4e;">
      <a href="${appUrl}" style="text-decoration:none;"><img src="${logoUrl}" alt="Subastandolo" style="height:36px;" /></a>
    </div>
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:36px 30px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">📋</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Comprador no pagó</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Puedes republicar tu subasta desde el panel</p>
    </div>
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 16px;">Hola <strong style="color:#EAB308;">${dealerName}</strong>,</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Te informamos que el comprador de tu subasta <strong style="color:#e0e0e0;">"${title}"</strong> ${price ? `(${price})` : ""} no completó el pago dentro del plazo de 48 horas. La subasta ha sido marcada como <strong style="color:#ef4444;">abandonada</strong>.
      </p>
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #22c55e;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;line-height:1.6;">
          🔄 <strong style="color:#22c55e;">¡Puedes republicar!</strong> Ingresa a tu Panel de Dealer → "Mis Subastas" y busca el botón "Republicar". Tu producto volverá a la plataforma sin necesidad de revisión si no realizas cambios.
        </p>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${appUrl}/dealer" style="display:inline-block;background:linear-gradient(135deg,#EAB308,#F59E0B);color:#000;padding:14px 40px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;">
          🔄 Ir a mi Panel
        </a>
      </div>
    </div>
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#555;font-size:11px;margin:0;">SUBASTANDOLO · <a href="${appUrl}" style="color:#555;">subastandolo.com</a></p>
    </div>
  </div>
</body></html>`;

            const dealerRes2 = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    from: "SUBASTANDOLO <no-reply@subastandolo.com>",
                    reply_to: "soporte@subastandolo.com",
                    to: [dealerEmail],
                    subject: dealerSubject,
                    html: dealerHtml,
                }),
            });
            const dealerResult = dealerRes2.ok ? await dealerRes2.json() : null;
            await logEmail(supabaseAdmin, {
                recipient_email: dealerEmail, recipient_name: dealerName, recipient_id: dealerId,
                email_type: "payment_abandoned_dealer", subject: dealerSubject,
                auction_id: auctionId, auction_title: title,
                status: dealerRes2.ok ? "sent" : "failed",
                resend_id: dealerResult?.id, error_message: dealerRes2.ok ? undefined : "Send failed",
            });

            // Push to dealer
            try {
                await supabaseAdmin.functions.invoke("notify-push", {
                    body: {
                        user_id: dealerId,
                        title: `📋 Comprador abandonó: "${title}"`,
                        body: "Puedes republicar esta subasta desde tu panel.",
                        data: { url: "/dealer" },
                    },
                });
            } catch (_) { /* push optional */ }
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
