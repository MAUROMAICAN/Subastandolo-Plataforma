import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth guard: authenticated user or service role ──
  const { isServiceRoleOrUser, unauthorized } = await import("../_shared/auth.ts");
  if (!await isServiceRoleOrUser(req)) return unauthorized(corsHeaders);

  try {
    const { userId, auctionTitle, auctionId, newBid, imageUrl } = await req.json();
    if (!userId || !auctionId) throw new Error("userId y auctionId son requeridos");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    // Look up email server-side using admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userRecord?.user?.email;
    if (!email) throw new Error("Email del usuario no encontrado");

    // Also get friendly name from profiles if available
    const { data: prof } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).single();
    const userName = prof?.full_name || "Usuario";

    const appUrl = "https://subastandolo.com";
    const auctionUrl = `${appUrl}/subasta/${auctionId}`;
    const title = auctionTitle || "tu subasta";
    const amount = newBid ? `$${Number(newBid).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "";

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
    <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:36px 30px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">⚡</div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">¡Te superaron en la puja!</h1>
      <p style="margin:8px 0 0;color:#fecaca;font-size:14px;">Alguien ofreció más. ¡No pierdas el artículo!</p>
    </div>
    ${imageUrl ? `<div style="background:#1a1a2e;padding:20px 30px;"><img src="${imageUrl}" alt="${title}" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;display:block;" /></div>` : ""}
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 6px;">Hola, <strong style="color:#EAB308;">${userName}</strong> 👋</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 20px;">
        Alguien superó tu puja en <strong style="color:#fff;">"${title}"</strong>.
        ${amount ? `La nueva puja es <strong style="color:#ef4444;">${amount}</strong>.` : ""}
        ¡Vuelve a pujar ahora para no perder este artículo!
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${auctionUrl}" style="display:inline-block;background:linear-gradient(135deg,#EAB308,#F59E0B);color:#1a1a2e;font-weight:800;font-size:16px;padding:16px 48px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(234,179,8,0.35);">
          ⚡ Pujar Ahora
        </a>
      </div>
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #ef4444;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;">⏰ <strong style="color:#fff;">Actúa rápido.</strong> El artículo puede cerrarse pronto.</p>
      </div>
    </div>
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">El mejor postor siempre gana 🔨</p>
      <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">¿Necesitas ayuda? <a href="mailto:soporte@subastandolo.com" style="color:#EAB308;text-decoration:none;font-weight:600;">soporte@subastandolo.com</a></p>
      <p style="color:#555;font-size:11px;margin:0;">SUBASTANDOLO · Este correo es automático, no responder.</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SUBASTANDOLO <no-reply@subastandolo.com>",
        to: [email],
        subject: `⚡ Te superaron en "${title}" — ¡Vuelve a pujar!`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await logEmail(supabaseAdmin, { recipient_email: email, recipient_name: userName, recipient_id: userId, email_type: "outbid", subject: `⚡ Te superaron en "${title}"`, auction_id: auctionId, auction_title: title, status: "failed", error_message: errText, metadata: { new_bid: newBid } });
      throw new Error(errText);
    }
    const result = await res.json();
    await logEmail(supabaseAdmin, { recipient_email: email, recipient_name: userName, recipient_id: userId, email_type: "outbid", subject: `⚡ Te superaron en "${title}"`, auction_id: auctionId, auction_title: title, status: "sent", resend_id: result.id, metadata: { new_bid: newBid } });

    // ── Push notification nativa (FCM) ──
    try {
      await supabaseAdmin.functions.invoke("notify-push", {
        body: {
          user_id: userId,
          title: `⚡ Te superaron en "${title}"`,
          message: amount ? `Nueva puja: ${amount}. ¡Vuelve a pujar!` : "Alguien ofreció más. ¡No pierdas el artículo!",
          type: "outbid",
          link: `/subasta/${auctionId}`,
        },
      });
    } catch (pushErr) {
      console.warn("[notify-outbid] Push notification skipped:", pushErr);
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
