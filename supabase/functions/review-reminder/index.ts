import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/logEmail.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // ── Auth guard: service role only (called by cron) ──
    const { isServiceRole, unauthorized } = await import("../_shared/auth.ts");
    if (!isServiceRole(req)) return unauthorized(corsHeaders);

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const resendKey = Deno.env.get("RESEND_API_KEY");
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        // ── Find auctions needing review reminders ──
        // Payment approved 6-8 days ago, reminder not yet sent
        const { data: auctions, error: queryErr } = await supabaseAdmin
            .from("auctions")
            .select(`
        id, title, image_url, winner_id, created_by,
        payment_proofs!inner ( status, reviewed_at )
      `)
            .is("review_reminder_sent_at", null)
            .not("winner_id", "is", null)
            .filter("payment_proofs.status", "in", '("verified","approved","released")')
            .filter("payment_proofs.reviewed_at", "not.is", null);

        if (queryErr) {
            console.error("Query error:", queryErr.message);
            // Fallback: use raw RPC or direct query
            throw new Error(`Query error: ${queryErr.message}`);
        }

        if (!auctions || auctions.length === 0) {
            return new Response(JSON.stringify({ processed: 0, message: "No pending reminders" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const now = Date.now();
        const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
        const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
        const appUrl = "https://subastandolo.com";
        const logoUrl = `${appUrl}/logo-dark.png`;

        let processed = 0;
        let skipped = 0;

        for (const auction of auctions) {
            // Check timing: payment approved 6-8 days ago
            const proofs = Array.isArray(auction.payment_proofs)
                ? auction.payment_proofs
                : [auction.payment_proofs];
            const approvedProof = proofs.find((p: any) => p.reviewed_at);
            if (!approvedProof?.reviewed_at) { skipped++; continue; }

            const approvedAt = new Date(approvedProof.reviewed_at).getTime();
            const elapsed = now - approvedAt;
            if (elapsed < SIX_DAYS_MS || elapsed > EIGHT_DAYS_MS) { skipped++; continue; }

            const buyerId = auction.winner_id;
            const dealerId = auction.created_by;
            const title = auction.title || "tu subasta";
            const auctionUrl = `${appUrl}/auction/${auction.id}`;

            // Check if reviews already exist
            const { data: existingReviews } = await supabaseAdmin
                .from("reviews")
                .select("review_type")
                .eq("auction_id", auction.id);

            const hasBuyerReview = existingReviews?.some((r: any) => r.review_type === "buyer_to_dealer");
            const hasDealerReview = existingReviews?.some((r: any) => r.review_type === "dealer_to_buyer");

            // Get profiles for names
            const { data: profiles } = await supabaseAdmin
                .from("profiles")
                .select("id, full_name")
                .in("id", [buyerId, dealerId].filter(Boolean));

            const buyerName = profiles?.find((p: any) => p.id === buyerId)?.full_name || "Comprador";
            const dealerName = profiles?.find((p: any) => p.id === dealerId)?.full_name || "Vendedor";

            // Get buyer and dealer emails
            const [buyerAuth, dealerAuth] = await Promise.all([
                buyerId ? supabaseAdmin.auth.admin.getUserById(buyerId) : null,
                dealerId ? supabaseAdmin.auth.admin.getUserById(dealerId) : null,
            ]);
            const buyerEmail = buyerAuth?.data?.user?.email;
            const dealerEmail = dealerAuth?.data?.user?.email;

            // Get main image
            const { data: imgs } = await supabaseAdmin
                .from("auction_images")
                .select("image_url")
                .eq("auction_id", auction.id)
                .order("display_order")
                .limit(1);
            const mainImage = imgs?.[0]?.image_url || auction.image_url;

            // ── Send to BUYER (if no review yet) ──
            if (!hasBuyerReview && buyerId) {
                // In-app notification
                await supabaseAdmin.from("notifications").insert({
                    user_id: buyerId,
                    title: "⭐ ¿Cómo te fue con tu compra?",
                    message: `Han pasado 7 días desde tu compra "${title}". ¡Califica tu experiencia con el vendedor!`,
                    type: "review_reminder",
                    link: `/auction/${auction.id}`,
                });

                // Push notification
                await supabaseAdmin.functions.invoke("send-push", {
                    body: {
                        user_id: buyerId,
                        title: "⭐ ¿Cómo te fue con tu compra?",
                        body: `Califica tu experiencia con "${title}"`,
                        url: `/auction/${auction.id}`,
                        tag: "review_reminder",
                    },
                });

                // Email
                if (resendKey && buyerEmail) {
                    const html = buildEmailHtml({
                        logoUrl, appUrl, mainImage, title,
                        userName: buyerName,
                        auctionUrl,
                        heading: "¿Cómo te fue con tu compra?",
                        emoji: "⭐",
                        message: `Han pasado 7 días desde que completaste tu compra de <strong style="color:#fff;">"${title}"</strong>. Tu opinión es muy importante para nosotros y para la comunidad.`,
                        cta: "⭐ Calificar mi Compra",
                        ctaUrl: `${auctionUrl}#reviews`,
                    });

                    const res = await fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            from: "SUBASTANDOLO <no-reply@subastandolo.com>",
                            reply_to: "soporte@subastandolo.com",
                            to: [buyerEmail],
                            subject: `⭐ ¿Cómo te fue con "${title}"? — Califica tu compra`,
                            html,
                        }),
                    });

                    const emailStatus = res.ok ? "sent" : "failed";
                    const result = await res.json();
                    await logEmail(supabaseAdmin, {
                        recipient_email: buyerEmail, recipient_name: buyerName, recipient_id: buyerId,
                        email_type: "review_reminder_buyer", subject: `⭐ ¿Cómo te fue con "${title}"?`,
                        auction_id: auction.id, auction_title: title,
                        status: emailStatus, resend_id: result.id, error_message: emailStatus === "failed" ? JSON.stringify(result) : undefined,
                    });
                }
            }

            // ── Send to DEALER (if no review yet) ──
            if (!hasDealerReview && dealerId) {
                // In-app notification
                await supabaseAdmin.from("notifications").insert({
                    user_id: dealerId,
                    title: "⭐ ¿Cómo fue tu experiencia con el comprador?",
                    message: `Han pasado 7 días desde la venta de "${title}". ¡Califica al comprador!`,
                    type: "review_reminder",
                    link: `/auction/${auction.id}`,
                });

                // Push notification
                await supabaseAdmin.functions.invoke("send-push", {
                    body: {
                        user_id: dealerId,
                        title: "⭐ Califica al comprador",
                        body: `¿Cómo fue la transacción de "${title}"?`,
                        url: `/auction/${auction.id}`,
                        tag: "review_reminder",
                    },
                });

                // Email
                if (resendKey && dealerEmail) {
                    const html = buildEmailHtml({
                        logoUrl, appUrl, mainImage, title,
                        userName: dealerName,
                        auctionUrl,
                        heading: "¿Cómo fue tu experiencia con el comprador?",
                        emoji: "⭐",
                        message: `Han pasado 7 días desde que vendiste <strong style="color:#fff;">"${title}"</strong>. Tu calificación del comprador ayuda a mantener una comunidad confiable.`,
                        cta: "⭐ Calificar al Comprador",
                        ctaUrl: `${auctionUrl}#reviews`,
                    });

                    const res = await fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            from: "SUBASTANDOLO <no-reply@subastandolo.com>",
                            reply_to: "soporte@subastandolo.com",
                            to: [dealerEmail],
                            subject: `⭐ Califica al comprador de "${title}"`,
                            html,
                        }),
                    });

                    const emailStatus = res.ok ? "sent" : "failed";
                    const result = await res.json();
                    await logEmail(supabaseAdmin, {
                        recipient_email: dealerEmail, recipient_name: dealerName, recipient_id: dealerId,
                        email_type: "review_reminder_dealer", subject: `⭐ Califica al comprador de "${title}"`,
                        auction_id: auction.id, auction_title: title,
                        status: emailStatus, resend_id: result.id, error_message: emailStatus === "failed" ? JSON.stringify(result) : undefined,
                    });
                }
            }

            // ── Mark reminder sent ──
            await supabaseAdmin.from("auctions").update({
                review_reminder_sent_at: new Date().toISOString(),
            } as any).eq("id", auction.id);

            processed++;
        }

        console.log(`Review reminders: ${processed} processed, ${skipped} skipped`);
        return new Response(JSON.stringify({ processed, skipped }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("review-reminder error:", msg);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

// ── Email template builder ──
function buildEmailHtml(params: {
    logoUrl: string; appUrl: string; mainImage?: string; title: string;
    userName: string; auctionUrl: string;
    heading: string; emoji: string; message: string; cta: string; ctaUrl: string;
}): string {
    const { logoUrl, appUrl, mainImage, title, userName, auctionUrl, heading, emoji, message, cta, ctaUrl } = params;
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a4e;">
    <!-- Logo -->
    <div style="background:#0f0f1a;padding:16px 30px;text-align:center;border-bottom:1px solid #2a2a4e;">
      <a href="${appUrl}" style="text-decoration:none;"><img src="${logoUrl}" alt="Subastandolo" style="height:36px;" /></a>
    </div>
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#EAB308,#F59E0B);padding:36px 30px;text-align:center;">
      <div style="font-size:52px;margin-bottom:10px;">${emoji}</div>
      <h1 style="margin:0;color:#1a1a2e;font-size:24px;font-weight:800;">${heading}</h1>
      <p style="margin:8px 0 0;color:#3d3200;font-size:14px;">Tu opinión hace la diferencia</p>
    </div>
    ${mainImage ? `<div style="background:#1a1a2e;padding:20px 30px;"><img src="${mainImage}" alt="${title}" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;display:block;" /></div>` : ""}
    <!-- Body -->
    <div style="padding:28px 30px;">
      <p style="font-size:16px;color:#e0e0e0;margin:0 0 6px;">¡Hola, <strong style="color:#EAB308;">${userName}</strong>!</p>
      <p style="font-size:14px;color:#b0b0c0;line-height:1.7;margin:0 0 24px;">${message}</p>
      <!-- Stars preview -->
      <div style="text-align:center;margin:0 0 24px;">
        <div style="display:inline-block;background:#1a1a2e;border:1px solid #2a2a4e;border-radius:12px;padding:16px 28px;">
          <p style="color:#888;font-size:12px;margin:0 0 8px;">¿Cómo calificarías tu experiencia?</p>
          <div style="font-size:32px;letter-spacing:8px;">⭐⭐⭐⭐⭐</div>
        </div>
      </div>
      <!-- CTA -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#EAB308,#F59E0B);color:#1a1a2e;font-weight:800;font-size:15px;padding:15px 44px;border-radius:12px;text-decoration:none;box-shadow:0 4px 20px rgba(234,179,8,0.3);">
          ${cta}
        </a>
      </div>
      <div style="background:#1a1a2e;border:1px solid #2a2a4e;border-left:4px solid #EAB308;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#b0b0c0;">💡 <strong style="color:#fff;">Las reseñas ayudan a otros usuarios</strong> a tomar mejores decisiones y construyen la reputación en la plataforma.</p>
      </div>
    </div>
    <!-- Footer -->
    <div style="border-top:1px solid #2a2a4e;padding:20px 30px;text-align:center;">
      <p style="color:#EAB308;font-size:13px;margin:0 0 8px;font-style:italic;">¡Gracias por ser parte de Subastandolo! ⭐</p>
      <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">¿Necesitas ayuda? <a href="mailto:soporte@subastandolo.com" style="color:#EAB308;text-decoration:none;font-weight:600;">soporte@subastandolo.com</a></p>
      <p style="color:#555;font-size:11px;margin:0;">SUBASTANDOLO · <a href="${appUrl}/mi-panel" style="color:#555;">Ver mi panel</a></p>
    </div>
  </div>
</body>
</html>`;
}
