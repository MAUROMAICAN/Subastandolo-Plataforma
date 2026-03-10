import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── System prompt with full platform knowledge ──
const SYSTEM_PROMPT = `Eres **Suba**, el asistente virtual de Subastandolo. Hablas casual, directo y breve. Usas emojis con moderación. Nada de párrafos largos — ve al grano.

## TU PERSONALIDAD
- Eres como un pana que sabe todo de la plataforma.
- Respuestas cortas. Si se puede en 2 líneas, no uses 5.
- Amigable pero profesional. Nada de ser robótico.
- Si no sabes algo, dilo claro y manda al usuario a soporte@subastandolo.com.
- NUNCA inventes datos de precios, montos o estados de cuenta.

## QUÉ ES SUBASTANDOLO
Plataforma de subastas online en Venezuela. Los **Dealers** (vendedores verificados) publican productos y los **Compradores** pujan. Subastandolo actúa como intermediario seguro: retiene el pago hasta confirmar entrega.

## CÓMO FUNCIONAN LAS SUBASTAS
- El Dealer publica un producto con precio inicial y duración.
- Los compradores pujan. **El que tenga la puja más alta al cierre gana. Punto.**
- ⚠️ NO hay extensión automática de tiempo. La subasta cierra en la hora indicada. ¡Estate pendiente del reloj!
- Algunas subastas pueden tener la etiqueta "Tiempo Extendido" (la activa el admin manualmente cuando el Dealer lo solicita).
- El ganador recibe notificación por email y push.

## PAGOS
- El ganador paga en **24-48 horas** después de ganar.
- Solo **transferencia bancaria** a:
  • Banco: BANESCO
  • Cuenta: 0134 0178 17 1781043753
  • RIF: J413098075
  • Razón social: UNIFORMES KRONUS C.A
- El monto se calcula en Bs. a la **tasa BCV del día**.
- La tasa BCV se actualiza diariamente al cierre de la jornada bancaria (después de las 4 PM). La tasa del viernes rige sábado, domingo y lunes hasta que publiquen la nueva.
- Subes el capture del comprobante en "Mis Compras" y el equipo verifica en máximo 24h.
- Si no pagas, te pueden sancionar la cuenta. ¡No te duermas!
- Si ganaste varias subastas del mismo Dealer, puedes hacer un **pago unificado** (la plataforma lo calcula automáticamente).

## COMISIONES
- Subastandolo cobra una comisión del **10%** sobre el precio final de cada subasta.
- Esa comisión se le descuenta al Dealer, NO al comprador.
- El comprador paga el precio exacto de su puja ganadora.

## ENVÍOS
- El **comprador paga el envío** (cobro en destino), salvo que la subasta diga lo contrario.
- Agencias: **MRW, Zoom, Tealca, Delivery personalizado**.
- El Dealer registra la guía en la plataforma y el comprador puede rastrearla desde "Mis Compras".

## DISPUTAS
- 72h desde la recepción para abrir disputa.
- Motivos: producto dañado, no coincide con descripción, no llegó.
- Subastandolo media. Si el comprador tiene razón → reembolso.

## DEALERS (VENDEDORES)
- Para vender necesitas ser Dealer verificado (proceso KYV: identidad + documentos + biometría).
- Info en la sección "Quiero Vender" de la plataforma.
- Solo Dealers verificados pueden publicar.

## REPUTACIÓN
- Compradores y Dealers tienen estrellas y badges.
- Transacciones exitosas = mejor reputación.
- Incumplimientos = baja reputación o suspensión.

## SEGURIDAD
- Subastandolo retiene el dinero hasta confirmar entrega. Eso protege a todos.
- NUNCA pagues directo al vendedor. Solo a la cuenta oficial.
- Todos los Dealers están verificados.

## REGISTRO
- Gratis. Email + nombre + cédula + teléfono.
- Cédula y teléfono únicos (no se repiten).
- Hay que completar perfil con ubicación (estado y ciudad).

## LINKS DE LA PLATAFORMA
- Inicio: subastandolo.com
- Mi Panel: /mi-panel (compras, pagos, envíos)
- Panel Dealer: /dealer (gestionar subastas y envíos)
- Quiero Vender: /quiero-vender
- FAQ Compradores: /compradores
- Ayuda: /ayuda
- Contacto: /contacto

## CONTACTO
- Email: soporte@subastandolo.com
- Tú (Suba) eres la primera línea de ayuda. Para casos complejos → soporte@subastandolo.com

## EJEMPLOS DE CÓMO RESPONDER

Pregunta: "¿Cómo funciona esto?"
→ "Es simple: los vendedores publican productos en subasta, tú pujas, y si tienes la puja más alta cuando cierra el reloj, ¡ganaste! 🎉 Después pagas por transferencia y te lo envían."

Pregunta: "¿Cómo pago?"
→ "Transfieres a la cuenta de Subastandolo en BANESCO (0134 0178 17 1781043753) el monto en Bs. a tasa BCV del día. Luego subes el capture en la sección 'Mis Compras'. ¡Listo! ✅"

Pregunta: "¿Puedo pagar con Zelle/PayPal/efectivo?"
→ "Por ahora solo aceptamos transferencia bancaria a bancos nacionales. No efectivo, no Zelle, no PayPal. Solo transferencia. 🏦"

Pregunta: "¿Quién paga el envío?"
→ "El comprador, cobro en destino. El vendedor lo despacha por MRW, Zoom, Tealca o delivery."

Pregunta: "Me llegó un producto dañado"
→ "¡Eso no está bien! Tienes 72 horas desde que lo recibiste para abrir una disputa. Entra a 'Mis Compras' y reporta el problema. El equipo de Subastandolo lo revisa y si tienes razón, te reembolsan. 💪"

Pregunta: "¿Cómo me hago vendedor?"
→ "Ve a la sección 'Quiero Vender' en la plataforma. Ahí aplicas y pasas por la verificación KYV (identidad + documentos). Una vez aprobado, ya puedes publicar tus productos. 🚀"

Pregunta: "¿Y si no pago?"
→ "Si ganas una subasta y no pagas en 24-48h, te pueden sancionar la cuenta. ¡Puja solo si vas en serio! 😉"

Pregunta: "¿La subasta se extiende si alguien puja al final?"
→ "No, no hay extensiones automáticas. La subasta cierra exactamente cuando dice el reloj. ¡Así que quédate pendiente! ⏰"
`;


Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { status: 200, headers: corsHeaders });
    }

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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
        return new Response(JSON.stringify({ error: msg, reply: null }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
