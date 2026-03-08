import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Auth guard: authenticated user required ──
  const { getCallerUser, unauthorized } = await import("../_shared/auth.ts");
  const caller = await getCallerUser(req);
  if (!caller) return unauthorized(corsHeaders);

  try {
    const { ticketId, type } = await req.json();
    // type = "new_ticket" | "admin_reply"

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY no configurada");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch ticket with latest message
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();
    if (ticketErr || !ticket) throw new Error("Ticket no encontrado");

    const { data: messages } = await supabaseAdmin
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastMessage = messages?.[0]?.message || "";
    const appUrl = "https://subastandolo.com";

    const categoryLabels: Record<string, string> = {
      general: "General",
      pago: "Pago",
      envio: "Envío",
      subasta: "Subasta",
      cuenta: "Cuenta",
      dealer: "Dealer",
    };

    if (type === "new_ticket") {
      // Notify admin about new ticket
      const adminEmail = "subastandolo1@gmail.com";
      const subject = `🎫 Nuevo Ticket #${ticket.ticket_number} — ${ticket.subject}`;
      const html = `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#ffffff;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px;text-align:center">
            <h1 style="color:#A6E300;margin:0;font-size:20px">🎫 Nuevo Ticket de Soporte</h1>
          </div>
          <div style="padding:24px">
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <tr><td style="color:#888;padding:6px 0;font-size:13px">Ticket</td><td style="color:#fff;padding:6px 0;font-size:13px;font-weight:bold">#${ticket.ticket_number}</td></tr>
              <tr><td style="color:#888;padding:6px 0;font-size:13px">De</td><td style="color:#fff;padding:6px 0;font-size:13px">${ticket.user_name} (${ticket.user_email})</td></tr>
              <tr><td style="color:#888;padding:6px 0;font-size:13px">Categoría</td><td style="color:#fff;padding:6px 0;font-size:13px">${categoryLabels[ticket.category] || ticket.category}</td></tr>
              <tr><td style="color:#888;padding:6px 0;font-size:13px">Prioridad</td><td style="color:#fff;padding:6px 0;font-size:13px">${ticket.priority.toUpperCase()}</td></tr>
              <tr><td style="color:#888;padding:6px 0;font-size:13px">Asunto</td><td style="color:#fff;padding:6px 0;font-size:13px;font-weight:bold">${ticket.subject}</td></tr>
            </table>
            <div style="background:#1a1a1a;border-left:3px solid #A6E300;padding:16px;border-radius:6px;margin-bottom:20px">
              <p style="color:#ccc;font-size:13px;margin:0;line-height:1.6">${lastMessage}</p>
            </div>
            <a href="${appUrl}/admin" style="display:inline-block;background:#A6E300;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
              Ver en Panel Admin
            </a>
          </div>
        </div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SUBASTANDOLO Soporte <soporte@subastandolo.com>",
          to: [adminEmail],
          reply_to: ticket.user_email,
          subject,
          html,
        }),
      });

      if (res.ok) {
        const r = await res.json();
        await logEmail(supabaseAdmin, { recipient_email: adminEmail, email_type: "support_new_ticket", subject, status: "sent", resend_id: r.id, metadata: { ticket_number: ticket.ticket_number, user_name: ticket.user_name } });
      } else {
        await logEmail(supabaseAdmin, { recipient_email: adminEmail, email_type: "support_new_ticket", subject, status: "failed", error_message: await res.text() });
      }

    } else if (type === "admin_reply") {
      // Notify user about admin reply  
      const subject = `💬 Respuesta a tu Ticket #${ticket.ticket_number} — ${ticket.subject}`;
      const html = `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#ffffff;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px;text-align:center">
            <h1 style="color:#A6E300;margin:0;font-size:20px">💬 Respuesta del Soporte</h1>
            <p style="color:#888;font-size:12px;margin:8px 0 0">Ticket #${ticket.ticket_number}</p>
          </div>
          <div style="padding:24px">
            <p style="color:#aaa;font-size:13px;margin:0 0 12px">Hola <strong style="color:#fff">${ticket.user_name}</strong>,</p>
            <p style="color:#aaa;font-size:13px;margin:0 0 16px">Hemos respondido a tu ticket "<strong style="color:#fff">${ticket.subject}</strong>":</p>
            <div style="background:#1a1a1a;border-left:3px solid #A6E300;padding:16px;border-radius:6px;margin-bottom:20px">
              <p style="color:#ccc;font-size:13px;margin:0;line-height:1.6">${lastMessage}</p>
            </div>
            <a href="${appUrl}/contacto" style="display:inline-block;background:#A6E300;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">
              Ver Conversación
            </a>
            <p style="color:#666;font-size:11px;margin:20px 0 0">Puedes responder directamente desde la plataforma.</p>
          </div>
          <div style="background:#111;padding:16px;text-align:center;border-top:1px solid #222">
            <p style="color:#555;font-size:10px;margin:0">SUBASTANDOLO — Soporte al Cliente</p>
          </div>
        </div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SUBASTANDOLO Soporte <soporte@subastandolo.com>",
          to: [ticket.user_email],
          subject,
          html,
        }),
      });

      if (res.ok) {
        const r = await res.json();
        await logEmail(supabaseAdmin, { recipient_email: ticket.user_email, recipient_name: ticket.user_name, recipient_id: ticket.user_id, email_type: "support_reply", subject, status: "sent", resend_id: r.id, metadata: { ticket_number: ticket.ticket_number } });
      } else {
        await logEmail(supabaseAdmin, { recipient_email: ticket.user_email, recipient_name: ticket.user_name, recipient_id: ticket.user_id, email_type: "support_reply", subject, status: "failed", error_message: await res.text() });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
