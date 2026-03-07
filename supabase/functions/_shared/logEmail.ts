/**
 * Logs an email send event to the email_logs table.
 * Call this after every Resend API call in edge functions.
 */
export async function logEmail(
    supabaseAdmin: any,
    params: {
        recipient_email: string;
        recipient_name?: string;
        recipient_id?: string;
        email_type: string;
        subject: string;
        auction_id?: string;
        auction_title?: string;
        status: "sent" | "failed";
        resend_id?: string;
        error_message?: string;
        metadata?: Record<string, any>;
    }
) {
    try {
        await supabaseAdmin.from("email_logs").insert({
            recipient_email: params.recipient_email,
            recipient_name: params.recipient_name || null,
            recipient_id: params.recipient_id || null,
            email_type: params.email_type,
            subject: params.subject,
            auction_id: params.auction_id || null,
            auction_title: params.auction_title || null,
            status: params.status,
            resend_id: params.resend_id || null,
            error_message: params.error_message || null,
            metadata: params.metadata || {},
        });
    } catch (e) {
        console.warn("[logEmail] Failed to log email:", e);
    }
}
