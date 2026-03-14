import PolicyPageLayout, { type PolicyPageConfig } from "@/components/PolicyPageLayout";
import SEOHead from "@/components/SEOHead";
import { ShieldCheck, Package, AlertTriangle, Clock, MessageSquare, XCircle, HelpCircle, FileText, Scale } from "lucide-react";

const config: PolicyPageConfig = {
    badge: { icon: ShieldCheck, label: "Protección" },
    titleLines: ["Garantía", "Subastandolo"],
    accentLine: 1,
    subtitle: "Tu compra está protegida. Si algo sale mal, te devolvemos tu dinero. Todas las transacciones están cubiertas automáticamente.",
    highlights: ["100% de compras protegidas", "Reembolso garantizado", "Mediación profesional"],
    lastUpdated: "Marzo 2026",

    quickNav: [
        { icon: ShieldCheck, label: "¿Qué cubre?", targetId: "coberturas" },
        { icon: MessageSquare, label: "¿Cómo funciona?", targetId: "proceso" },
        { icon: Package, label: "Para vendedores", targetId: "vendedores" },
    ],

    sections: [
        {
            id: "coberturas",
            title: "¿Qué Cubre la Garantía?",
            intro: "La Garantía Subastandolo protege todas las compras realizadas en subastas y en la tienda de precio fijo.",
            bullets: [
                { bold: "Producto no recibido:", text: "Si tu producto no llega dentro de los 15 días posteriores al envío, recibirás un reembolso completo." },
                { bold: "No coincide con la descripción:", text: "Si el producto recibido es significativamente distinto a lo descrito o mostrado en las fotos, puedes solicitar devolución y reembolso." },
                { bold: "Producto dañado o defectuoso:", text: "Si tu producto llega roto, dañado o con defectos no indicados en la publicación, cubrimos tu devolución." },
                { bold: "Producto incompleto:", text: "Si faltan piezas, accesorios o componentes listados en la publicación, puedes reclamar un reembolso parcial o total." },
            ],
        },
        {
            id: "proceso",
            title: "¿Cómo Funciona el Proceso?",
            intro: "Abrir una disputa es simple y rápido. Te guiamos en cada paso del proceso:",
            bullets: [
                { bold: "Paso 1 — Abre una disputa:", text: "Desde \"Mis Compras\" en tu panel, selecciona el pedido y haz clic en \"Tengo un problema\"." },
                { bold: "Paso 2 — Respuesta del vendedor:", text: "El vendedor tiene 3 días para responder con una propuesta de solución (reembolso, reenvío, etc.)." },
                { bold: "Paso 3 — Resolución:", text: "Si el vendedor no responde en 3 días, la disputa se resuelve automáticamente a tu favor. Si hay desacuerdo, Subastandolo media como árbitro." },
                { bold: "Paso 4 — Reembolso:", text: "Una vez resuelta la disputa, el reembolso se procesa en 24-48 horas por el mismo método de pago utilizado." },
            ],
        },
        {
            id: "vendedores",
            title: "Protección para Vendedores",
            intro: "La Garantía Subastandolo también protege a los vendedores con reglas claras y justas.",
            bullets: [
                { bold: "Pago automático:", text: "Si el comprador confirma la recepción, el pago se libera automáticamente a tu cuenta." },
                { bold: "Anti-abuso:", text: "Las disputas falsas o abusivas resultan en sanciones para el comprador, no para ti." },
                { bold: "Plazo de respuesta:", text: "Siempre tienes 3 días completos para responder antes de cualquier resolución automática." },
                { bold: "Tu mejor defensa:", text: "Fotos y descripciones precisas te protegen ante disputas infundadas. Documenta bien tus productos." },
            ],
        },
    ],

    darkSection: {
        title: "Tu Compra Siempre Protegida",
        intro: "Desde el momento que realizas una compra en Subastandolo, ya sea por subasta o tienda fija, estás cubierto automáticamente.",
        bullets: [
            { bold: "Cobertura total:", text: "Todos los productos, sin importar el precio o la categoría, están protegidos." },
            { bold: "Sin costo adicional:", text: "La Garantía Subastandolo es gratuita y se activa automáticamente en cada compra." },
            { bold: "Mediación imparcial:", text: "Nuestro equipo actúa como mediador neutro entre comprador y vendedor." },
        ],
        cta: { label: "Contactar Soporte", href: "/contacto" },
    },

    faqs: [
        { q: "¿Todos los productos están cubiertos?", a: "Sí, todos los productos comprados a través de Subastandolo están cubiertos por la Garantía, tanto de la tienda como de subastas." },
        { q: "¿Puedo abrir una disputa por arrepentimiento?", a: "No. La Garantía cubre problemas con el producto (no recibido, dañado, diferente). Para devoluciones por arrepentimiento, aplica la política de devoluciones del vendedor." },
        { q: "¿Qué pasa con los productos usados?", a: "Los productos usados están cubiertos siempre que no coincidan con la descripción del vendedor. Si el vendedor describió correctamente el estado, no aplica la disputa." },
        { q: "¿Cuánto tarda el reembolso?", a: "Una vez aprobada la disputa, el reembolso se procesa en 24-48 horas. El tiempo de acreditación depende del método de pago." },
        { q: "¿Qué pasa si abuso del sistema de disputas?", a: "Las disputas falsas o reiteradas sin fundamento pueden resultar en la suspensión de tu cuenta. La Garantía protege a compradores legítimos." },
    ],

    crossLinks: [
        { icon: FileText, label: "Términos y Condiciones", desc: "Reglas de la plataforma", href: "/terminos" },
        { icon: Scale, label: "Artículos Prohibidos", desc: "Qué se puede publicar", href: "/articulos-prohibidos" },
        { icon: HelpCircle, label: "Centro de Ayuda", desc: "Resuelve tus dudas", href: "/ayuda" },
    ],
};

export default function BuyerGuarantee() {
    return (
        <>
            <SEOHead
                title="Garantía Subastandolo — Tu compra está protegida"
                description="Programa de protección al comprador de Subastandolo. Si tu producto no llega, no coincide o llega dañado, te devolvemos tu dinero."
            />
            <PolicyPageLayout config={config} />
        </>
    );
}
