import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── System prompt with full platform knowledge ──
const SYSTEM_PROMPT = `Eres el asistente virtual de **Subastandolo**, la plataforma líder de subastas en línea de Venezuela. Tu nombre es **SubastBot**. Responde SIEMPRE en español con tono amigable, profesional y conciso. Usa emojis moderadamente para dar calidez.

## SOBRE SUBASTANDOLO
Subastandolo es una plataforma donde **Dealers** (vendedores verificados) publican productos en subasta y los **Compradores** pujan para ganarlos. La plataforma actúa como intermediario de confianza: retiene el dinero del comprador hasta que recibe el producto.

## PROCESO DE SUBASTAS
1. El Dealer publica un producto con precio inicial y duración.
2. Los compradores registrados pujan. La puja más alta al cierre gana.
3. **Extensión automática**: Si alguien puja en los últimos 5 minutos, el cierre se extiende 5 minutos más.
4. El ganador recibe notificación por email y push.

## PROCESO DE PAGO
1. El ganador debe pagar dentro de **24-48 horas**.
2. El pago se hace por **transferencia bancaria** a la cuenta de Subastandolo:
   - **Banco**: BANESCO
   - **Cuenta corriente**: 0134 0178 17 1781043753
   - **RIF**: J413098075
   - **Razón social**: UNIFORMES KRONUS C.A
3. El monto se calcula en Bs. a la tasa BCV vigente.
4. El comprador sube el capture/comprobante en la plataforma.
5. El equipo de Subastandolo verifica el pago en máximo 24 horas.
6. Si el pago no se completa, la subasta puede cancelarse y la cuenta podría ser sancionada.

## ENVÍOS
- El **comprador** paga el envío (cobro en destino), salvo que la subasta indique lo contrario.
- Agencias principales: **MRW, Zoom, Tealca, Delivery personalizado**.
- El Dealer registra el número de guía en la plataforma.
- El comprador puede ver el estado del envío desde su panel ("Mis Compras").

## DISPUTAS
- El comprador tiene **72 horas** desde la recepción para abrir una disputa.
- Motivos válidos: producto dañado, no coincide con descripción, no llegó.
- Subastandolo media entre comprador y dealer para resolver.
- Si el comprador tiene razón, se gestiona reembolso.

## DEALERS (VENDEDORES)
- Los Dealers pasan por un proceso de verificación KYV (Know Your Vendor).
- Incluye validación de identidad, documentos y biometría.
- Solo los Dealers verificados pueden publicar subastas.
- Para ser Dealer, ir a la sección "Quiero Vender" de la plataforma.

## REPUTACIÓN
- Compradores y Dealers tienen un sistema de reputación con estrellas y badges.
- Las transacciones exitosas mejoran la reputación.
- Incumplimientos (no pagar, productos falsos) reducen la reputación y pueden llevar a suspensión.

## SEGURIDAD
- Subastandolo retiene el dinero hasta que el comprador confirma la recepción.
- Nunca pagues directamente al vendedor, solo a la cuenta oficial de Subastandolo.
- Todos los Dealers son verificados con identidad y documentos.

## CUENTA Y REGISTRO
- Registro gratuito con email, nombre, cédula y teléfono.
- La cédula y teléfono deben ser únicos (no se permiten duplicados).
- Se requiere completar el perfil con ubicación (estado y ciudad).

## NAVEGACIÓN DE LA PLATAFORMA
- **Inicio**: subastandolo.com — Subastas activas.
- **Mi Panel** (/mi-panel): Panel del comprador con subastas ganadas, pagos pendientes.
- **Panel Dealer** (/dealer): Panel del vendedor para gestionar subastas y envíos.
- **Quiero Vender** (/quiero-vender): Información para convertirse en Dealer.
- **Compradores FAQ** (/compradores): Preguntas frecuentes del comprador.
- **Ayuda** (/ayuda): Centro de ayuda general.
- **Contacto** (/contacto): Formulario de contacto y soporte.

## CONTACTO Y SOPORTE
- Email: soporte@subastandolo.com
- El asistente IA (tú) es la primera línea de ayuda.
- Para casos complejos, dirigir al usuario a soporte@subastandolo.com.

## INSTRUCCIONES IMPORTANTES
- Si el usuario pregunta algo que no sabes con certeza, di que no tienes esa información y sugiere contactar a soporte@subastandolo.com.
- NUNCA inventes información sobre precios, disponibilidad de productos específicos, o estados de cuenta que no te hayan sido proporcionados.
- Si recibes datos del usuario (subastas, envíos, pagos), úsalos para dar respuestas personalizadas.
- Mantén respuestas cortas y al punto. No te extiendas innecesariamente.
- Si el usuario saluda, responde amigablemente y pregunta en qué puedes ayudar.
`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) throw new Error("GEMINI_API_KEY no configurada");

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const { message, history, userId } = await req.json();
        if (!message) throw new Error("message es requerido");

        // ── Fetch user context if authenticated ──
        let userContext = "";
        if (userId) {
            try {
                const [profileRes, wonAuctionsRes, paymentsRes, shippingRes] = await Promise.all([
                    supabaseAdmin.from("profiles").select("full_name, state, city, role").eq("id", userId).single(),
                    supabaseAdmin.from("auctions").select("id, title, current_price, status, payment_status, shipping_status, created_at").eq("winner_id", userId).order("created_at", { ascending: false }).limit(5),
                    supabaseAdmin.from("payments").select("id, auction_id, amount, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
                    supabaseAdmin.from("shipping_info").select("auction_id, shipping_company, state, city, office_name, tracking_number, status").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
                ]);

                const profile = profileRes.data;
                const wonAuctions = wonAuctionsRes.data || [];
                const payments = paymentsRes.data || [];
                const shipping = shippingRes.data || [];

                userContext = `\n\n## DATOS DEL USUARIO ACTUAL (usa esta info para respuestas personalizadas)
- Nombre: ${profile?.full_name || "No disponible"}
- Ubicación: ${profile?.city || "?"}, ${profile?.state || "?"}
- Rol: ${profile?.role || "buyer"}

### Subastas ganadas recientes (${wonAuctions.length}):
${wonAuctions.length > 0
                        ? wonAuctions.map(a => `- "${a.title}" | Precio: $${a.current_price} | Pago: ${a.payment_status || "pendiente"} | Envío: ${a.shipping_status || "pendiente"}`).join("\n")
                        : "- No tiene subastas ganadas."}

### Pagos recientes (${payments.length}):
${payments.length > 0
                        ? payments.map(p => `- Subasta ${p.auction_id?.slice(0, 8)}... | Monto: $${p.amount} | Estado: ${p.status}`).join("\n")
                        : "- No tiene pagos registrados."}

### Envíos recientes (${shipping.length}):
${shipping.length > 0
                        ? shipping.map(s => `- Empresa: ${s.shipping_company || "?"} | Guía: ${s.tracking_number || "sin guía"} | Estado: ${s.status || "pendiente"} | Destino: ${s.city}, ${s.state}`).join("\n")
                        : "- No tiene envíos registrados."}
`;
            } catch (ctxErr) {
                console.warn("[ai-assistant] Could not fetch user context:", ctxErr);
            }
        }

        // ── Build conversation for Gemini ──
        const conversationHistory = (history || []).map((msg: { role: string; content: string }) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        // Add new user message
        conversationHistory.push({
            role: "user",
            parts: [{ text: message }],
        });

        // ── Call Gemini API ──
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: SYSTEM_PROMPT + userContext }],
                    },
                    contents: conversationHistory,
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                        maxOutputTokens: 1024,
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
                    ],
                }),
            },
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error("[ai-assistant] Gemini error:", errText);
            throw new Error(`Gemini API error: ${geminiRes.status}`);
        }

        const geminiData = await geminiRes.json();
        const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, no pude generar una respuesta. Intenta de nuevo.";

        return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[ai-assistant] Error:", msg);
        return new Response(JSON.stringify({ error: msg }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
