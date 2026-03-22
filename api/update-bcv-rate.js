// Vercel Cron handler — triggers auto-update-bcv-rate Edge Function daily
// Schedule: Monday–Friday at 1:00 PM UTC (9:00 AM VET / Venezuela time)
// Note: BCV publishes the rate on weekdays only. The Friday rate is used Sat-Mon.
export const config = { runtime: "edge" };

export default async function handler(req) {
    // Verify cron secret to prevent unauthorized triggers
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Missing env vars" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/auto-update-bcv-rate`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });

        const data = await res.json();
        console.log("[BCV Cron] Rate updated:", data);

        return new Response(JSON.stringify({ ok: true, ...data }), {
            status: res.ok ? 200 : 500,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[BCV Cron] Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
