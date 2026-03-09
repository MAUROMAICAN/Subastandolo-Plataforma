import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdmin, unauthorized } from "../_shared/auth.ts";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API = "https://api.resend.com/emails";
const APP_URL = "https://subastandolo.com";
const HEADER_IMG = "https://subastandolo.com/email-header.png";

// ─── Shared email layout (same design as send-test-emails) ─────────────────
function layout(accentColor: string, accentDark: string, emoji: string, heading: string, subheading: string, body: string) {
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

        <!-- LOGO HEADER (precomposed image with dark bg baked in) -->
        <tr>
          <td style="padding:0;border-radius:12px 12px 0 0;overflow:hidden;text-align:center;">
            <img src="${HEADER_IMG}" alt="Subastandolo"
              width="580"
              style="width:100%;max-width:580px;height:auto;display:block;border:0;outline:0;border-radius:12px 12px 0 0;" />
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
            <div style="padding:28px 32px;">
              ${body}
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              Este mensaje fue enviado por <strong style="color:#6b7280;">SUBASTANDOLO</strong><br>
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

function ctaButton(href: string, label: string, bgColor: string, textColor: string) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:${bgColor};color:${textColor};font-weight:700;font-size:15px;padding:15px 44px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">${label}</a>
  </div>`;
}

function infoBox(bgColor: string, borderColor: string, content: string) {
  return `<div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:16px 20px;margin:20px 0;">${content}</div>`;
}

// ─── Template definitions ──────────────────────────────────────────────────
interface EmailTemplate {
  key: string;
  subject: string;
  html: string;
}

function getTemplates(customMessage?: string): Record<string, EmailTemplate> {
  return {
    nuevas_subastas: {
      key: "nuevas_subastas",
      subject: "🔥 ¡Estamos activos con nuevas subastas! — Subastandolo",
      html: layout(
        "linear-gradient(135deg,#EAB308,#F59E0B)", "#1a1a2e",
        "🔥", "¡Nuevas subastas disponibles!", "Productos increíbles esperan por ti",
        `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 👋</p>
         <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
           Tenemos <strong style="color:#111827;">nuevas subastas activas</strong> en la plataforma con productos increíbles 
           a precios que tú decides. Tecnología, hogar, moda y mucho más — todo verificado y con envío seguro.
         </p>
         ${infoBox("#fffbeb", "#fde68a",
          `<table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;color:#374151;font-size:13px;">
                  <span style="display:inline-block;width:24px;">🏷️</span>
                  <strong>Precios desde $1</strong> — Tú pones el precio
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#374151;font-size:13px;">
                  <span style="display:inline-block;width:24px;">🛡️</span>
                  <strong>Compra protegida</strong> — Tu dinero resguardado
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#374151;font-size:13px;">
                  <span style="display:inline-block;width:24px;">🚚</span>
                  <strong>Envío a todo el país</strong> — Rastreo incluido
                </td>
              </tr>
            </table>`
        )}
         ${ctaButton(`${APP_URL}/explorar`, "🔨 Ver Subastas Ahora", "#EAB308", "#1a1a2e")}
         <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">No te quedes sin pujar — las subastas cierran en tiempo real ⏰</p>`
      ),
    },

    bienvenida_general: {
      key: "bienvenida_general",
      subject: "🎉 ¡Gracias por ser parte de Subastandolo!",
      html: layout(
        "linear-gradient(135deg,#22c55e,#15803d)", "#fff",
        "🎉", "¡Gracias por estar aquí!", "Eres parte de la mejor comunidad de subastas",
        `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 👋</p>
         <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
           Queríamos darte las gracias por ser parte de <strong style="color:#111827;">Subastandolo</strong>,
           la plataforma de subastas más segura y emocionante de Venezuela. 
           Cada día sumamos más productos, más dealers verificados y más oportunidades para ti.
         </p>
         ${infoBox("#f0fdf4", "#bbf7d0",
          `<p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
              💚 <strong>Nuestra promesa:</strong> transparencia total, compra protegida, 
              y precios que decides tú. ¡Gracias por confiar en nosotros!
            </p>`
        )}
         ${ctaButton(APP_URL, "🏠 Ir a Subastandolo", "#22c55e", "#ffffff")}
         <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Tu opinión importa — escríbenos a soporte@subastandolo.com</p>`
      ),
    },

    oferta_flash: {
      key: "oferta_flash",
      subject: "⚡ ¡Oferta Flash! Subastas especiales por tiempo limitado",
      html: layout(
        "linear-gradient(135deg,#ef4444,#dc2626)", "#fff",
        "⚡", "¡Oferta Flash!", "Subastas especiales por tiempo limitado",
        `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 🔥</p>
         <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
           Tenemos <strong style="color:#ef4444;">ofertas especiales por tiempo limitado</strong>. 
           Subastas que inician con precios increíblemente bajos y cierran pronto — 
           esta es tu oportunidad de conseguir algo extraordinario.
         </p>
         ${infoBox("#fef2f2", "#fecaca",
          `<p style="margin:0;color:#374151;font-size:14px;font-weight:600;">
              ⏰ <strong style="color:#ef4444;">¡Date prisa!</strong> Estas subastas no durarán mucho. 
              Ingresa ahora y pujas antes que los demás.
            </p>`
        )}
         ${ctaButton(`${APP_URL}/explorar`, "🔨 Ver Ofertas Flash", "#ef4444", "#ffffff")}
         <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Las subastas flash cierran en tiempo real — ¡no pierdas tu oportunidad!</p>`
      ),
    },

    anuncio: {
      key: "anuncio",
      subject: "📢 Anuncio importante — Subastandolo",
      html: layout(
        "linear-gradient(135deg,#3b82f6,#1d4ed8)", "#fff",
        "📢", "Anuncio Importante", "Información que no querrás perderte",
        `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 👋</p>
         <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
           ${customMessage || "Tenemos noticias importantes que queremos compartir contigo. Visita la plataforma para más detalles."}
         </p>
         ${ctaButton(APP_URL, "🔗 Ir a Subastandolo", "#3b82f6", "#ffffff")}
         <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Gracias por ser parte de Subastandolo 💛</p>`
      ),
    },

    mantenimiento: {
      key: "mantenimiento",
      subject: "🛠️ Mantenimiento programado — Subastandolo",
      html: layout(
        "linear-gradient(135deg,#6b7280,#4b5563)", "#fff",
        "🛠️", "Mantenimiento Programado", "Mejoras para una mejor experiencia",
        `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">¡Hola! 👋</p>
         <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
           Te informamos que realizaremos un <strong style="color:#111827;">mantenimiento programado</strong> 
           en la plataforma para implementar mejoras y optimizaciones. 
           Durante este período, es posible que algunos servicios no estén disponibles temporalmente.
         </p>
         ${infoBox("#f9fafb", "#e5e7eb",
          `<table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;color:#374151;font-size:13px;">
                  <span style="display:inline-block;width:24px;">⚙️</span>
                  Optimización de velocidad y rendimiento
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#374151;font-size:13px;">
                  <span style="display:inline-block;width:24px;">🔒</span>
                  Mejoras de seguridad
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#374151;font-size:13px;">
                  <span style="display:inline-block;width:24px;">✨</span>
                  Nuevas funcionalidades
                </td>
              </tr>
            </table>`
        )}
         <p style="color:#374151;font-size:14px;line-height:1.7;margin:16px 0 0;">
           Pedimos disculpas por cualquier inconveniente. ¡Volveremos mejor que nunca!
         </p>
         ${ctaButton(APP_URL, "🏠 Ir a Subastandolo", "#6b7280", "#ffffff")}`
      ),
    },
  };
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth guard: admin only
  if (!(await isAdmin(req))) return unauthorized(corsHeaders);

  try {
    const { templateKey, customMessage, testEmail } = await req.json();
    if (!templateKey) {
      return new Response(JSON.stringify({ error: "templateKey requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const templates = getTemplates(customMessage);
    const template = templates[templateKey];
    if (!template) {
      return new Response(JSON.stringify({ error: `Template '${templateKey}' no encontrado` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If testEmail is provided, send only to that address
    if (testEmail) {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SUBASTANDOLO <no-reply@subastandolo.com>",
          to: [testEmail],
          subject: `[TEST] ${template.subject}`,
          html: template.html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: errText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, total: 1, sent: 1, failed: 0, test: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all user emails via admin API
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Paginate through all users
    const allEmails: string[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(`Error fetching users: ${error.message}`);
      if (!users || users.length === 0) break;
      for (const u of users) {
        if (u.email) allEmails.push(u.email);
      }
      if (users.length < perPage) break;
      page++;
    }

    if (allEmails.length === 0) {
      return new Response(JSON.stringify({ error: "No se encontraron usuarios con email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── PRIVACY FIX: Send ONE email per recipient individually ──
    // Never put multiple addresses in 'to' — that exposes all emails to every recipient!
    const BATCH_SIZE = 40; // Process 40 at a time, then pause for rate limiting
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < allEmails.length; i += BATCH_SIZE) {
      const batch = allEmails.slice(i, i + BATCH_SIZE);

      // Send each email individually within this batch (in parallel for speed)
      const results = await Promise.allSettled(
        batch.map(email =>
          fetch(RESEND_API, {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "SUBASTANDOLO <no-reply@subastandolo.com>",
              to: [email],  // ← Single recipient only!
              subject: template.subject,
              html: template.html,
            }),
          }).then(async (res) => {
            if (!res.ok) throw new Error(await res.text());
            return email;
          })
        )
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          sent++;
        } else {
          failed++;
          errors.push(r.reason?.message || "Unknown error");
        }
      }

      // Log each batch
      await logEmail(adminClient, {
        email_type: "mass_email",
        subject: template.subject,
        recipient_email: `batch_${Math.floor(i / BATCH_SIZE) + 1}@mass`,
        recipient_name: `${batch.length} recipients (individual)`,
        status: failed > 0 ? "failed" : "sent",
        metadata: { templateKey, batchSize: batch.length, batchIndex: Math.floor(i / BATCH_SIZE), sent, failed },
      });

      // Rate limit: delay between batches to respect Resend limits
      if (i + BATCH_SIZE < allEmails.length) {
        await delay(2000);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: allEmails.length,
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
