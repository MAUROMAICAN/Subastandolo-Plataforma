import PolicyPageLayout, { type PolicyPageConfig } from "@/components/PolicyPageLayout";
import { ShieldCheck, Database, Lock, Eye, UserCheck, FileText, Scale } from "lucide-react";

const config: PolicyPageConfig = {
    badge: { icon: ShieldCheck, label: "Privacidad" },
    titleLines: ["Centro de", "Privacidad"],
    accentLine: 1,
    subtitle: "Te contamos cómo usamos y protegemos tus datos personales para mejorar nuestros servicios y ofrecerte una experiencia segura.",
    highlights: ["Administra tus datos", "Conoce tus derechos", "Transparencia total"],
    lastUpdated: "Marzo 2026",

    quickNav: [
        { icon: Database, label: "Recolección de datos", targetId: "recoleccion" },
        { icon: Eye, label: "Uso de la información", targetId: "uso" },
        { icon: Lock, label: "Seguridad", targetId: "seguridad" },
        { icon: UserCheck, label: "Verificación", targetId: "verificacion" },
    ],

    sections: [
        {
            id: "recoleccion",
            title: "Recolección de Datos",
            intro: "Recopilamos únicamente la información necesaria para brindarte un servicio seguro y personalizado.",
            bullets: [
                { bold: "Datos básicos:", text: "Nombre, teléfono, correo electrónico y ubicación, necesarios para validar tu identidad y garantizar la seguridad de cada transacción." },
                { bold: "Datos de uso:", text: "Información sobre cómo navegas en nuestra plataforma para mejorar tu experiencia y recomendarte productos relevantes." },
                { bold: "Datos financieros:", text: "Información de pago procesada a través de canales cifrados. Nunca almacenamos datos bancarios completos en nuestros servidores." },
            ],
        },
        {
            id: "uso",
            title: "Uso de la Información",
            intro: "Tus datos solo se comparten con la contraparte (vendedor o comprador) una vez finalizada la transacción.",
            bullets: [
                { bold: "Comunicación post-venta:", text: "Compartimos datos de contacto entre comprador y vendedor únicamente para concretar la entrega del producto." },
                { bold: "Cero venta de datos:", text: "No vendemos, alquilamos ni comercializamos bases de datos a terceros bajo ninguna circunstancia." },
                { bold: "Mejora del servicio:", text: "Utilizamos datos agregados y anónimos para mejorar la experiencia general de la plataforma." },
            ],
        },
        {
            id: "seguridad",
            title: "Medidas de Seguridad",
            intro: "Implementamos múltiples capas de protección para mantener tu información a salvo.",
            bullets: [
                { bold: "Encriptación de extremo a extremo:", text: "Todos los datos sensibles viajan protegidos con protocolos de encriptación de última generación." },
                { bold: "Autenticación segura:", text: "Verificación en dos pasos disponible para proteger tu cuenta contra accesos no autorizados." },
                { bold: "Responsabilidad del usuario:", text: "Es tu responsabilidad mantener la confidencialidad de tu contraseña y reportar cualquier actividad sospechosa." },
            ],
        },
        {
            id: "verificacion",
            title: "Verificación de Identidad",
            intro: "Para transacciones de alto valor, implementamos verificaciones adicionales que protegen a todos los participantes.",
            bullets: [
                { bold: "Verificación de cédula:", text: "Los dealers deben verificar su identidad con documento oficial para poder operar en la plataforma." },
                { bold: "Subastas de alto valor:", text: "Para categorías especiales, Subastandolo podrá solicitar verificación adicional para prevenir fraudes." },
                { bold: "Protección continua:", text: "Monitoreamos activamente la plataforma para detectar y prevenir actividades fraudulentas." },
            ],
        },
    ],

    darkSection: {
        title: "Nuestro Compromiso con tu Privacidad",
        intro: "En Subastandolo nos comprometemos a proteger tu privacidad y a usar tus datos únicamente con el fin de brindarte un servicio seguro y transparente.",
        bullets: [
            { bold: "Transparencia:", text: "Cualquier cambio en esta política será comunicado oportunamente a todos los usuarios." },
            { bold: "Control:", text: "Puedes solicitar la eliminación de tu cuenta y datos personales en cualquier momento desde tu perfil." },
            { bold: "Cumplimiento legal:", text: "Operamos bajo las leyes de protección de datos de la República Bolivariana de Venezuela." },
        ],
        cta: { label: "Contactar Soporte", href: "/contacto" },
    },

    faqs: [
        { q: "¿Puedo eliminar mi cuenta y mis datos?", a: "Sí. Puedes solicitar la eliminación de tu cuenta desde tu perfil. Todos tus datos personales serán eliminados permanentemente en un plazo de 30 días." },
        { q: "¿Comparten mis datos con terceros?", a: "No. Nunca vendemos ni compartimos tu información con terceros. Solo compartimos datos de contacto entre comprador y vendedor después de una transacción exitosa." },
        { q: "¿Cómo protegen mi información de pago?", a: "Utilizamos protocolos de encriptación y procesamos los pagos a través de canales bancarios seguros. No almacenamos datos bancarios completos." },
        { q: "¿Qué datos recopilan exactamente?", a: "Nombre completo, teléfono, correo electrónico, ubicación (estado y ciudad), y datos de uso anónimos para mejorar la plataforma." },
    ],

    crossLinks: [
        { icon: FileText, label: "Términos y Condiciones", desc: "Conoce las reglas de la plataforma", href: "/terminos" },
        { icon: ShieldCheck, label: "Garantía Subastandolo", desc: "Tu compra está protegida", href: "/garantia" },
        { icon: Scale, label: "Artículos Prohibidos", desc: "Qué se puede y qué no publicar", href: "/articulos-prohibidos" },
    ],
};

export default function PrivacyPage() {
    return <PolicyPageLayout config={config} />;
}
