const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API = "https://api.resend.com/emails";
const APP_URL = "https://subastandolo.com";
const LOGO_URL = "https://subastandolo.com/logo.png";
const FAKE_AUCTION_URL = `${APP_URL}/subasta/test-123`;
const FAKE_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80";

async function send(resendKey: string, to: string, subject: string, html: string) {
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "SUBASTANDOLO <no-reply@subastandolo.com>", to: [to], subject, html }),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, id: json.id, error: json.message };
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Shared layout wrapper ────────────────────────────────────────────────────
function layout(accentColor: string, accentDark: string, emoji: string, heading: string, subheading: string, body: string, imageUrl?: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${heading}</title>
  <style>:root { color-scheme: light only; }</style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f4f6" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;" cellpadding="0" cellspacing="0">

        <!-- LOGO HEADER (white+green logo on dark - no dark mode issues) -->
        <tr>
          <td bgcolor="#111827" style="background-color:#111827;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
            <img src="${LOGO_URL}" alt="Subastandolo"
              width="160"
              style="width:160px;max-width:160px;height:auto;display:block;margin:0 auto;border:0;outline:0;" />
          </td>
        </tr>

        <!-- ACCENT BANNER -->
        <tr>
          <td style="background:${accentColor};padding:28px 32px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:60px;height:60px;line-height:60px;font-size:28px;margin-bottom:12px;">${emoji}</div>
            <h1 style="margin:0;color:${accentDark};font-size:22px;font-weight:800;letter-spacing:-0.3px;line-height:1.2;">${heading}</h1>
            <p style="margin:8px 0 0;color:${accentDark};opacity:0.72;font-size:14px;font-weight:500;">${subheading}</p>
          </td>
        </tr>

        <!-- WHITE CARD BODY -->
        <tr>
          <td style="background:#ffffff;padding:0;">
            ${imageUrl ? `
            <div style="padding:0;">
              <img src="${imageUrl}" alt="Producto" style="width:100%;height:220px;object-fit:cover;display:block;" />
            </div>` : ""}
            <div style="padding:28px 32px;">
              ${body}
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              Este mensaje fue enviado automáticamente por <strong style="color:#6b7280;">SUBASTANDOLO</strong><br>
              <a href="${APP_URL}" style="color:#EAB308;text-decoration:none;">subastandolo.com</a> · El mejor postor siempre gana 🔨
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Reusable sub-components ─────────────────────────────────────────────────
function infoBox(bgColor: string, borderColor: string, content: string) {
  return `<div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:16px 20px;margin:20px 0;">${content}</div>`;
}

function ctaButton(href: string, label: string, bgColor: string, textColor: string) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:${bgColor};color:${textColor};font-weight:700;font-size:15px;padding:15px 44px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">${label}</a>
  </div>`;
}

function greeting(name: string, emoji: string) {
  return `<p style="color:#111827;font-size:16px;font-weight:600;margin:0 0 8px;">Hola, ${name} ${emoji}</p>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />`;
}

// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth guard: admin only ──────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify caller identity
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Verify admin role
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").limit(1);
  if (!roles || roles.length === 0) {
    return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurada" }), { status: 400, headers: corsHeaders });

  const { testEmail } = await req.json().catch(() => ({ testEmail: null }));
  if (!testEmail) return new Response(JSON.stringify({ error: "testEmail requerido" }), { status: 400, headers: corsHeaders });

  const results: Record<string, object> = {};

  // ── 1. Outbid ──────────────────────────────────────────────────────────────
  results["1_outbid"] = await send(resendKey, testEmail,
    `⚡ Te superaron en "Reloj Gucci Original"`,
    layout(
      "linear-gradient(135deg,#ef4444,#dc2626)", "#fff",
      "⚡", "¡Te superaron en la puja!", "Alguien ofreció más — ¡actúa ahora!",
      `${greeting("Mauro", "👋")}
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 4px;">Alguien acaba de superar tu puja en <strong style="color:#111827;">"Reloj Gucci Original"</strong>.</p>
       ${infoBox("#fff7ed", "#fed7aa",
        `<div style="display:flex;justify-content:space-between;align-items:center;">
           <div>
             <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Nueva puja actual</p>
             <p style="margin:4px 0 0;color:#ea580c;font-size:26px;font-weight:800;">$85.00</p>
           </div>
           <div style="text-align:right;">
             <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Tu puja anterior</p>
             <p style="margin:4px 0 0;color:#9ca3af;font-size:18px;font-weight:700;text-decoration:line-through;">$75.00</p>
           </div>
         </div>`
      )}
       ${ctaButton(FAKE_AUCTION_URL, "⚡ Pujar Ahora", "#ef4444", "#ffffff")}
       ${infoBox("#f9fafb", "#e5e7eb", `<p style="margin:0;color:#6b7280;font-size:13px;">⏰ <strong style="color:#374151;">Actúa rápido</strong> — Las pujas cierran en tiempo real y el artículo puede perderse pronto.</p>`)}`,
      FAKE_IMAGE
    )
  );

  await delay(1500);

  // ── 2. Auction Won ─────────────────────────────────────────────────────────
  results["2_auction_won"] = await send(resendKey, testEmail,
    `🏆 ¡Ganaste "Reloj Gucci Original"! Procede al pago`,
    layout(
      "linear-gradient(135deg,#EAB308,#F59E0B)", "#1a1a2e",
      "🏆", "¡Felicidades, ganaste!", "Eres el mejor postor — procede al pago ahora",
      `${greeting("Mauro", "🎉")}
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 4px;">Eres el ganador de <strong style="color:#111827;">"Reloj Gucci Original"</strong>. Para asegurar tu compra realiza el pago a la cuenta oficial de Subastandolo.</p>
       ${infoBox("#f0fdf4", "#bbf7d0",
        `<p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Monto ganador</p>
          <p style="margin:0;color:#16a34a;font-size:32px;font-weight:900;">$75.00</p>`
      )}
       ${ctaButton(FAKE_AUCTION_URL, "💳 Proceder al Pago", "#EAB308", "#1a1a2e")}
       ${divider()}
       ${infoBox("#fffbeb", "#fde68a",
        `<p style="margin:0;color:#374151;font-size:13px;line-height:1.7;">
           🏦 <strong>Cuenta BANESCO</strong><br>
           <span style="font-family:monospace;font-size:15px;font-weight:700;color:#111827;">01340178171781043753</span><br>
           <span style="color:#6b7280;font-size:12px;">RIF J-41309807-5 · UNIFORMES KRONUS C.A</span>
         </p>`
      )}
       <p style="color:#9ca3af;font-size:12px;text-align:center;margin:8px 0 0;">⚠️ Nunca realices pagos directamente al vendedor.</p>`,
      FAKE_IMAGE
    )
  );

  await delay(1500);

  // ── 3. Payment Received (to dealer) ────────────────────────────────────────
  results["3_payment_received"] = await send(resendKey, testEmail,
    `💰 Nuevo comprobante de pago — "Reloj Gucci Original"`,
    layout(
      "linear-gradient(135deg,#3b82f6,#1d4ed8)", "#fff",
      "💰", "¡Comprobante recibido!", "Nuestro equipo lo verificará en las próximas horas",
      `${greeting("Mauro (Dealer)", "👋")}
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 4px;"><strong style="color:#111827;">Carlos Pérez</strong> envió un comprobante de pago para <strong style="color:#111827;">"Reloj Gucci Original"</strong>.</p>
       ${infoBox("#eff6ff", "#bfdbfe",
        `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
           <div>
             <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Monto declarado</p>
             <p style="margin:4px 0 0;color:#1d4ed8;font-size:26px;font-weight:800;">$75.00</p>
           </div>
           <div>
             <span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;border:1px solid #bfdbfe;">⏳ En revisión</span>
           </div>
         </div>`
      )}
       ${ctaButton(`${APP_URL}/dealer`, "📊 Ver mi Panel", "#0f0f1a", "#ffffff")}
       ${infoBox("#f9fafb", "#e5e7eb", `<p style="margin:0;color:#6b7280;font-size:13px;">📦 Una vez aprobado el pago, tendrás <strong style="color:#374151;">48 horas</strong> para registrar la guía de envío.</p>`)}`,
      FAKE_IMAGE
    )
  );

  await delay(1500);

  // ── 4. Payment Approved (to buyer) ─────────────────────────────────────────
  results["4_payment_approved"] = await send(resendKey, testEmail,
    `✅ Tu pago fue aprobado — "Reloj Gucci Original"`,
    layout(
      "linear-gradient(135deg,#22c55e,#15803d)", "#fff",
      "✅", "¡Tu pago fue aprobado!", "El vendedor preparará tu envío muy pronto",
      `${greeting("Mauro", "🎉")}
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 4px;">Tu comprobante de pago para <strong style="color:#111827;">"Reloj Gucci Original"</strong> fue <strong style="color:#16a34a;">verificado y aprobado</strong> por el equipo de Subastandolo.</p>
       ${infoBox("#f0fdf4", "#bbf7d0",
        `<table width="100%" cellpadding="0" cellspacing="0">
           <tr>
             <td style="padding:6px 0;color:#374151;font-size:13px;">
               <span style="display:inline-block;width:24px;">✅</span>
               <strong>Pago verificado</strong>
             </td>
           </tr>
           <tr><td style="padding:6px 0;color:#374151;font-size:13px;"><span style="display:inline-block;width:24px;">📦</span> Preparación y empaque del pedido</td></tr>
           <tr><td style="padding:6px 0;color:#374151;font-size:13px;"><span style="display:inline-block;width:24px;">🚚</span> Envío y entrega a tu dirección</td></tr>
         </table>`
      )}
       ${ctaButton(FAKE_AUCTION_URL, "📋 Ver mi Compra", "#22c55e", "#ffffff")}
       ${infoBox("#f9fafb", "#e5e7eb", `<p style="margin:0;color:#6b7280;font-size:13px;">🛡️ <strong style="color:#374151;">Compra protegida.</strong> Si hay algún problema con el envío, abre una disputa desde tu panel y te ayudaremos.</p>`)}`,
      FAKE_IMAGE
    )
  );

  await delay(1500);

  // ── 5. Shipment ────────────────────────────────────────────────────────────
  results["5_shipment"] = await send(resendKey, testEmail,
    `📦 Tu pedido va en camino — Guía: MRW-987654321`,
    layout(
      "linear-gradient(135deg,#7c3aed,#6d28d9)", "#fff",
      "📦", "¡Tu pedido está en camino!", "El dealer registró la guía de envío",
      `${greeting("Mauro", "🚚")}
       <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 4px;">Tu producto <strong style="color:#111827;">"Reloj Gucci Original"</strong> ha sido despachado. Aquí están los datos de seguimiento:</p>
       ${infoBox("#f5f3ff", "#ddd6fe",
        `<table width="100%" cellpadding="0" cellspacing="0">
           <tr>
             <td style="padding-bottom:12px;">
               <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Empresa de envío</p>
               <p style="margin:4px 0 0;color:#111827;font-size:17px;font-weight:700;">MRW Venezuela</p>
             </td>
           </tr>
           <tr>
             <td style="border-top:1px solid #ddd6fe;padding-top:12px;">
               <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Número de guía</p>
               <p style="margin:4px 0 0;color:#7c3aed;font-size:22px;font-weight:900;font-family:monospace;letter-spacing:2px;">MRW-987654321</p>
             </td>
           </tr>
         </table>`
      )}
       ${ctaButton(FAKE_AUCTION_URL, "🚚 Ver Estado del Envío", "#7c3aed", "#ffffff")}
       ${infoBox("#f9fafb", "#e5e7eb", `<p style="margin:0;color:#6b7280;font-size:13px;">⏱️ El tiempo de entrega varía según la empresa y tu ubicación. Si no recibes tu pedido, abre una <strong style="color:#374151;">disputa</strong> desde tu panel.</p>`)}`,
      FAKE_IMAGE
    )
  );

  await delay(1500);

  // ── 6. New Auction from followed dealer ────────────────────────────────────
  results["6_new_auction"] = await send(resendKey, testEmail,
    `🔔 Kronos Store publicó una nueva subasta`,
    layout(
      "linear-gradient(135deg,#EAB308,#d97706)", "#1a1a2e",
      "🔔", "¡Nueva subasta disponible!", "Eres de los primeros en enterarte",
      `<p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 4px;">El dealer que sigues acaba de publicar un nuevo artículo:</p>
       ${infoBox("#fffbeb", "#fde68a",
        `<table width="100%" cellpadding="0" cellspacing="0">
           <tr>
             <td style="padding-bottom:8px;">
               <span style="font-size:13px;color:#92400e;font-weight:700;">🏪 Kronos Store</span>
             </td>
           </tr>
           <tr>
             <td style="padding-bottom:12px;">
               <p style="margin:0;color:#111827;font-size:18px;font-weight:800;">Reloj Gucci Original</p>
             </td>
           </tr>
           <tr>
             <td>
               <table width="100%" cellpadding="0" cellspacing="0">
                 <tr>
                   <td>
                     <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Precio inicial</p>
                     <p style="margin:4px 0 0;color:#16a34a;font-size:24px;font-weight:900;">$50.00</p>
                   </td>
                   <td style="text-align:right;">
                     <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Cierra</p>
                     <p style="margin:4px 0 0;color:#374151;font-size:13px;font-weight:600;">10 Mar 2026, 6:00 PM</p>
                   </td>
                 </tr>
               </table>
             </td>
           </tr>
         </table>`
      )}
       ${ctaButton(FAKE_AUCTION_URL, "🔨 Ver Subasta Ahora", "#EAB308", "#1a1a2e")}
       <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Recibes este mensaje porque sigues a Kronos Store · <a href="${APP_URL}/mi-panel" style="color:#EAB308;text-decoration:none;">Dejar de seguir</a></p>`,
      FAKE_IMAGE
    )
  );

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
