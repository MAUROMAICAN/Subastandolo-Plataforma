import PolicyPageLayout, { type PolicyPageConfig } from "@/components/PolicyPageLayout";
import { FileText, Clock, ShoppingCart, UserCheck, CreditCard, Shield, Truck, Scale, Store, ShieldCheck } from "lucide-react";

const config: PolicyPageConfig = {
    badge: { icon: FileText, label: "Legal" },
    titleLines: ["Términos y", "Condiciones de Uso"],
    accentLine: 1,
    subtitle: "Conoce las reglas que rigen nuestra plataforma y protegen a todos los participantes, tanto compradores como vendedores.",
    highlights: ["Reglas claras", "Protección para todos", "Transparencia"],
    lastUpdated: "Marzo 2026",

    quickNav: [
        { icon: Clock, label: "Subastas", targetId: "subastas" },
        { icon: ShoppingCart, label: "Comprador", targetId: "comprador" },
        { icon: Truck, label: "Vendedor", targetId: "vendedor" },
        { icon: Scale, label: "Disputas", targetId: "disputas" },
    ],

    sections: [
        {
            id: "subastas",
            title: "Dinámica de Subastas",
            intro: "Al registrarse en Subastandolo.com, el usuario acepta cumplir con las reglas de la plataforma. La cuenta es personal e intransferible.",
            bullets: [
                { bold: "Precio base y tiempo:", text: "Cada subasta tiene un precio base y un tiempo de finalización claramente establecidos." },
                { bold: "Anti-Sniping:", text: "Si se recibe una oferta en los últimos 60 segundos, el reloj se extenderá 2 minutos adicionales para permitir competencia justa." },
                { bold: "Compromiso de compra:", text: "Toda puja es un compromiso de compra. Si ganas la subasta, estás obligado a completar la transacción." },
            ],
        },
        {
            id: "comprador",
            title: "Obligaciones del Comprador",
            intro: "El ganador de una subasta debe cumplir con sus obligaciones para mantener un ecosistema justo para todos.",
            bullets: [
                { bold: "Pago en 24-48 horas:", text: "El ganador debe reportar su pago en un lapso máximo de 24 a 48 horas. De lo contrario, el artículo podrá ser ofrecido al segundo mejor postor." },
                { bold: "Pagos gestionados:", text: "Los fondos se transfieren a las cuentas oficiales de Subastandolo para garantizar la seguridad de la transacción." },
                { bold: "Medios de pago:", text: "Transferencia bancaria a bancos nacionales. No se acepta dinero en efectivo." },
            ],
        },
        {
            id: "vendedor",
            title: "Proceso de Venta y Liberación de Fondos",
            intro: "Para garantizar la seguridad de la comunidad, Subastandolo gestiona todos los pagos e implementa un proceso de liberación controlada.",
            bullets: [
                { bold: "Garantía de envío:", text: "Una vez recibido el pago, el Dealer tiene la obligación de enviar el producto a la agencia de encomiendas seleccionada." },
                { bold: "Liberación por entrega:", text: "Los fondos se liberan al Dealer una vez que el Cliente retira el producto y confirma la recepción exitosa." },
                { bold: "Liberación automática:", text: "Si el producto permanece en la agencia de envío por más de 3 días continuos sin ser retirado, se considera entrega completada y el dinero se libera al Dealer." },
                { bold: "Marketplace:", text: "Los dealers verificados pueden listar productos a precio fijo en la Tienda, cumpliendo con las Políticas de Publicación." },
            ],
        },
        {
            id: "disputas",
            title: "Sistema de Disputas y Resolución de Conflictos",
            intro: "Contamos con un sistema robusto para resolver cualquier problema que pueda surgir en las transacciones.",
            bullets: [
                { bold: "Apertura de disputa:", text: "Si el comprador tiene un problema (producto no recibido, no coincide, dañado o incompleto), puede abrir una disputa desde su panel." },
                { bold: "Plazo del vendedor:", text: "El vendedor tiene 3 días calendario para responder con su versión y evidencia." },
                { bold: "Resolución automática:", text: "Si el vendedor no responde en plazo, la disputa se resuelve automáticamente a favor del comprador." },
                { bold: "Mediación administrativa:", text: "Si no hay acuerdo, un administrador de Subastandolo media el caso y emite una resolución final vinculante." },
                { bold: "Anti-abuso:", text: "Las disputas falsas o reiteradas sin fundamento pueden resultar en la suspensión de la cuenta." },
            ],
        },
    ],

    darkSection: {
        title: "Restricciones y Comisiones",
        intro: "Subastandolo actúa como plataforma de conexión entre compradores y vendedores, con ciertas restricciones para garantizar un servicio seguro.",
        bullets: [
            { bold: "Categorías restringidas:", text: "No se gestionan subastas de bienes inmuebles ni vehículos automotores por el momento." },
            { bold: "Comisiones bancarias:", text: "La plataforma no se hace responsable por comisiones bancarias externas." },
            { bold: "Modificaciones:", text: "Subastandolo se reserva el derecho de modificar estos términos en cualquier momento. Los cambios se notifican por la plataforma." },
        ],
        cta: { label: "Ver Artículos Prohibidos", href: "/articulos-prohibidos" },
    },

    faqs: [
        { q: "¿Qué pasa si no pago después de ganar una subasta?", a: "Si no reportas tu pago en 24-48 horas, el artículo podrá ser ofrecido al segundo mejor postor y tu cuenta podría recibir una sanción." },
        { q: "¿Puedo cancelar una puja después de realizarla?", a: "No. Toda puja es un compromiso de compra vinculante. Asegúrate de revisar bien el producto antes de pujar." },
        { q: "¿Cuánto tarda la liberación de fondos al vendedor?", a: "Los fondos se liberan inmediatamente después de que el comprador confirma la recepción, o automáticamente después de 3 días en la agencia de envío." },
        { q: "¿Qué métodos de pago aceptan?", a: "Transferencia bancaria y Pago Móvil a bancos nacionales de Venezuela. No se acepta efectivo ni criptomonedas." },
    ],

    crossLinks: [
        { icon: ShieldCheck, label: "Política de Privacidad", desc: "Cómo protegemos tus datos", href: "/privacidad" },
        { icon: Shield, label: "Garantía Subastandolo", desc: "Tu compra está protegida", href: "/garantia" },
        { icon: CreditCard, label: "Políticas de Publicación", desc: "Reglas para publicar productos", href: "/politicas-publicacion" },
    ],
};

export default function TermsPage() {
    return <PolicyPageLayout config={config} />;
}
