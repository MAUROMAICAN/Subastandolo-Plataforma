import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name } = await req.json();
    if (!email) throw new Error("email requerido");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userName = name || "Usuario";
    const appName = "SUBASTANDOLO";
    const appUrl = "https://subastandolo.com";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${appName} <no-reply@subastanlo.com>`,
        to: [email],
        subject: `🎉 ¡Bienvenido a ${appName}! Tu cuenta está lista`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; color: #e0e0e0; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a4e;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #EAB308, #F59E0B); padding: 40px 30px; text-align: center;">
              <div style="font-size: 52px; margin-bottom: 12px;">🔨</div>
              <h1 style="margin: 0; color: #1a1a2e; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">¡Bienvenido a ${appName}!</h1>
              <p style="margin: 10px 0 0; color: #1a1a2e; font-size: 14px; font-weight: 600;">Tú pones el precio 💰</p>
            </div>

            <!-- Body -->
            <div style="padding: 30px;">
              <p style="font-size: 17px; line-height: 1.6; margin-bottom: 5px;">
                ¡Hola, <strong style="color: #EAB308;">${userName}</strong>! 👋
              </p>
              <p style="font-size: 14px; line-height: 1.7; color: #b0b0c0;">
                Tu cuenta ha sido creada exitosamente. Ya eres parte de la plataforma de subastas más emocionante de Venezuela.
              </p>

              <!-- Features -->
              <div style="margin: 25px 0;">
                <div style="background: #1a1a2e; border-radius: 10px; padding: 18px 20px; margin-bottom: 10px; border-left: 4px solid #EAB308;">
                  <p style="margin: 0; font-size: 14px; color: #fff;">
                    🏷️ <strong>Puja en subastas</strong>
                    <span style="display: block; color: #b0b0c0; font-size: 12px; margin-top: 4px;">Encuentra tecnología, hogar y más al mejor precio.</span>
                  </p>
                </div>
                <div style="background: #1a1a2e; border-radius: 10px; padding: 18px 20px; margin-bottom: 10px; border-left: 4px solid #22C55E;">
                  <p style="margin: 0; font-size: 14px; color: #fff;">
                    🛡️ <strong>Compra protegida</strong>
                    <span style="display: block; color: #b0b0c0; font-size: 12px; margin-top: 4px;">Tu dinero queda resguardado hasta que recibas el producto.</span>
                  </p>
                </div>
                <div style="background: #1a1a2e; border-radius: 10px; padding: 18px 20px; border-left: 4px solid #3B82F6;">
                  <p style="margin: 0; font-size: 14px; color: #fff;">
                    📦 <strong>Solo 5% de comisión</strong>
                    <span style="display: block; color: #b0b0c0; font-size: 12px; margin-top: 4px;">La comisión más baja del mercado. Sin sorpresas.</span>
                  </p>
                </div>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}"
                   style="display: inline-block; background: linear-gradient(135deg, #EAB308, #F59E0B); color: #1a1a2e; font-weight: 800; font-size: 16px; padding: 16px 44px; border-radius: 10px; text-decoration: none; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(234, 179, 8, 0.3);">
                  🔥 Ver Subastas Activas
                </a>
              </div>

              <!-- Dealer CTA -->
              <div style="background: linear-gradient(135deg, #1a1a2e, #1e1e3a); border: 1px solid #EAB30833; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
                <p style="margin: 0 0 8px; font-size: 15px; color: #fff; font-weight: 700;">
                  🏪 ¿Tienes productos que vender?
                </p>
                <p style="margin: 0 0 15px; font-size: 13px; color: #b0b0c0;">
                  Conviértete en Dealer verificado y publica tus subastas.
                </p>
                <a href="${appUrl}/dealer/apply"
                   style="display: inline-block; background: transparent; color: #EAB308; font-weight: 700; font-size: 13px; padding: 10px 28px; border-radius: 8px; text-decoration: none; border: 2px solid #EAB308;">
                  Registrarme como Dealer →
                </a>
              </div>

              <!-- Footer -->
              <div style="border-top: 1px solid #2a2a4e; padding-top: 20px; margin-top: 30px; text-align: center;">
                <p style="color: #EAB308; font-size: 13px; font-style: italic; margin: 0 0 10px;">
                  ¡Bienvenido! El mejor postor siempre gana 🔨
                </p>
                <p style="color: #666; font-size: 11px; margin: 0;">
                  Este correo fue enviado automáticamente por ${appName}. No responder.
                </p>
              </div>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      await logEmail(supabaseAdmin, { recipient_email: email, recipient_name: userName, email_type: "welcome", subject: `🎉 ¡Bienvenido a ${appName}! Tu cuenta está lista`, status: "failed", error_message: errBody });
      throw new Error(`Error enviando email: ${errBody}`);
    }

    const result = await emailRes.json();
    await logEmail(supabaseAdmin, { recipient_email: email, recipient_name: userName, email_type: "welcome", subject: `🎉 ¡Bienvenido a ${appName}! Tu cuenta está lista`, status: "sent", resend_id: result.id });
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
