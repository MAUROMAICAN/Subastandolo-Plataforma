import PolicyPageLayout, { type PolicyPageConfig } from "@/components/PolicyPageLayout";
import SEOHead from "@/components/SEOHead";
import { Camera, FileText, MessageSquareOff, Ban, ShieldCheck, Scale } from "lucide-react";

const config: PolicyPageConfig = {
    badge: { icon: FileText, label: "Publicaciones" },
    titleLines: ["Políticas de", "Publicación de Avisos"],
    accentLine: 1,
    subtitle: "Para garantizar una experiencia segura y profesional, todos los productos publicados deben cumplir con estas normas.",
    highlights: ["Imágenes de calidad", "Descripciones honestas", "Comunicación segura"],
    lastUpdated: "Marzo 2026",

    quickNav: [
        { icon: Camera, label: "Reglas de imágenes", targetId: "imagenes" },
        { icon: FileText, label: "Descripción", targetId: "descripcion" },
        { icon: MessageSquareOff, label: "Comunicación", targetId: "comunicacion" },
        { icon: Ban, label: "Categorías", targetId: "categorias" },
    ],

    sections: [
        {
            id: "imagenes",
            title: "Reglas de las Imágenes",
            intro: "La imagen es el contrato visual con el comprador. Debe ser impecable y fiel al producto.",
            bullets: [
                { bold: "Prohibición de datos de contacto:", text: "Las fotos no pueden contener banners, logos, números de teléfono, direcciones, redes sociales o códigos QR. Intentar evadir la plataforma resultará en suspensión." },
                { bold: "Fondo y claridad:", text: "El producto debe ser el protagonista. Las fotos deben tener buena iluminación y claridad." },
                { bold: "Uso de IA y edición:", text: "Está permitido usar herramientas de IA para eliminar fondos ruidosos y sustituirlos por fondos neutros (blanco, gris claro)." },
                { bold: "Integridad del producto:", text: "Queda prohibido usar filtros o ediciones que oculten daños, rayones o defectos reales. La imagen debe ser fiel al estado actual del artículo." },
            ],
        },
        {
            id: "descripcion",
            title: "Descripción y Veracidad",
            intro: "La honestidad en la descripción protege tanto al comprador como al vendedor.",
            bullets: [
                { bold: "Honestidad total:", text: "El vendedor debe describir de forma detallada el estado del producto (Nuevo, Como Nuevo, Usado, Para Repuestos)." },
                { bold: "Sanción por disputas:", text: "Si el comprador demuestra que el producto no coincide con la descripción (ej. se ocultó un golpe), el Dealer pierde la disputa automáticamente, se reembolsa al cliente y el Dealer asume los costos de retorno." },
            ],
        },
        {
            id: "comunicacion",
            title: "Comunicación Blindada",
            intro: "Toda comunicación entre comprador y vendedor debe realizarse dentro de la plataforma.",
            bullets: [
                { bold: "Cero contacto externo:", text: "No se permite incluir datos de contacto en el título, descripción o preguntas. Toda duda debe resolverse por el sistema de mensajería oficial." },
                { bold: "Seguridad de la transacción:", text: "Cualquier Dealer que invite a un comprador a cerrar el trato por fuera para evitar la comisión será expulsado permanentemente." },
            ],
        },
        {
            id: "categorias",
            title: "Categorías Prohibidas",
            intro: "Ciertas categorías no están disponibles en la plataforma por el momento.",
            bullets: [
                { bold: "Vehículos automotores:", text: "No se permiten publicaciones de carros, camionetas ni camiones." },
                { bold: "Bienes inmuebles:", text: "No se permiten publicaciones de casas, apartamentos ni terrenos." },
                { bold: "Artículos ilegales:", text: "No se permite la venta de artículos ilegales, réplicas no autorizadas o productos que infrinjan derechos de autor." },
            ],
        },
    ],

    darkSection: {
        title: "Consecuencias por Incumplimiento",
        intro: "El incumplimiento de estas políticas tiene consecuencias progresivas para proteger la calidad de la plataforma.",
        bullets: [
            { bold: "1ª infracción:", text: "Eliminación del anuncio + advertencia formal por email." },
            { bold: "2ª infracción:", text: "Suspensión temporal de la cuenta por 15 días + eliminación de todos los anuncios." },
            { bold: "3ª infracción:", text: "Suspensión permanente de la cuenta sin posibilidad de reactivación." },
        ],
    },

    faqs: [
        { q: "¿Puedo usar fotos de internet?", a: "No. Debes usar fotos reales del producto que estás vendiendo. Usar fotos de internet o de otro vendedor puede resultar en la eliminación del anuncio." },
        { q: "¿Puedo editar las fotos?", a: "Sí, puedes mejorar la iluminación y eliminar fondos. Pero NO puedes ocultar defectos del producto con filtros o edición." },
        { q: "¿Puedo poner mi número de teléfono en la descripción?", a: "No. Toda comunicación debe ser por los canales oficiales de Subastandolo. Incluir datos de contacto resulta en suspensión." },
    ],

    crossLinks: [
        { icon: Scale, label: "Artículos Prohibidos", desc: "Lista completa de artículos no permitidos", href: "/articulos-prohibidos" },
        { icon: FileText, label: "Términos y Condiciones", desc: "Reglas generales de la plataforma", href: "/terminos" },
        { icon: ShieldCheck, label: "Garantía Subastandolo", desc: "Protección al comprador", href: "/garantia-subastandolo" },
    ],
};

export default function PublicationPolicies() {
    return (
        <>
            <SEOHead
                title="Políticas de Publicación — Subastandolo"
                description="Normas para publicar productos en Subastandolo. Reglas de imágenes, descripciones, comunicaciones y categorías."
            />
            <PolicyPageLayout config={config} />
        </>
    );
}
