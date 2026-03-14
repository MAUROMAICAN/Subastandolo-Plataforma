import PolicyPageLayout, { type PolicyPageConfig } from "@/components/PolicyPageLayout";
import SEOHead from "@/components/SEOHead";
import {
    Ban, Shield, AlertTriangle, Pill, Flame, Skull, FileWarning,
    Wine, Sparkles, Zap, Car, Leaf, Eye, Lock, Scale, FileText, ShieldCheck
} from "lucide-react";

/* ─── Data ─── */
const prohibited = [
    { title: "Drogas y Estupefacientes", icon: Skull, description: "Cualquier tipo de droga ilegal, sustancia psicotrópica, precursores químicos, o utensilios para su producción o consumo." },
    { title: "Armas de Fuego y Municiones", icon: Ban, description: "Armas de fuego, municiones, explosivos, armas de guerra. Incluye réplicas funcionales y kits de conversión." },
    { title: "Productos Falsificados", icon: Shield, description: "Réplicas no autorizadas, imitaciones, productos con marcas falsificadas o que infrinjan derechos de propiedad intelectual." },
    { title: "Documentos Legales y Personales", icon: FileWarning, description: "Cédulas, pasaportes, licencias de conducir, títulos universitarios, certificados oficiales, bases de datos personales." },
    { title: "Divisas y Criptomonedas", icon: Scale, description: "Compra/venta de monedas extranjeras, servicios de cambio, criptomonedas o cualquier instrumento financiero." },
    { title: "Bienes del Estado Venezolano", icon: Ban, description: "Laptops Canaima, teléfonos Vtelca/Orinoquia, vehículos Venirauto, inmuebles adjudicados por el Estado u organismos públicos." },
    { title: "Órganos y Partes Humanas", icon: Skull, description: "Venta de personas, cuerpos, órganos, miembros o residuos humanos. Excepción: pelucas de cabello humano." },
    { title: "Software Pirata y Cuentas Digitales", icon: Lock, description: "Software sin licencia, cracks, seriales, cuentas de streaming/gaming robadas, herramientas de hacking." },
    { title: "Material de Odio o Terrorismo", icon: Flame, description: "Material que promueva violencia, discriminación, odio racial, terrorismo o pornografía infantil." },
    { title: "Productos de Vigilancia Ilegal", icon: Eye, description: "Decodificadores de señal, jammers, dispositivos de escucha clandestina, software espía." },
    { title: "Flora y Fauna Protegida", icon: Leaf, description: "Animales en peligro de extinción, especies protegidas, plantas en riesgo, marfil, pieles no autorizadas." },
    { title: "Vehículos e Inmuebles", icon: Car, description: "Por el momento, no se permiten publicaciones de vehículos automotores (carros, motos) ni bienes inmuebles." },
];

const restricted = [
    { title: "Alcohol", icon: Wine, condition: "Solo vendedores verificados nivel Oro o superior. Envío con restricción de edad." },
    { title: "Perfumes y Cosméticos", icon: Sparkles, condition: "Deben estar sellados en su empaque original, con número de lote y fecha de vencimiento visible." },
    { title: "Suplementos Alimenticios", icon: Pill, condition: "Con registro sanitario válido y etiquetado completo según normativa venezolana." },
    { title: "Electrodomésticos de Alto Voltaje", icon: Zap, condition: "Especificar voltaje (110V/220V), incluir datos de garantía cuando aplique." },
    { title: "Cuchillos y Herramientas Cortantes", icon: Ban, condition: "Solo de uso doméstico, industrial o agrícola. Prohibidas armas blancas decorativas." },
    { title: "Baterías de Litio", icon: AlertTriangle, condition: "Deben cumplir restricciones de envío. Indicar capacidad (mAh/Wh) en la descripción." },
];

/* ─── Layout Config ─── */
const config: PolicyPageConfig = {
    badge: { icon: Ban, label: "Regulaciones" },
    titleLines: ["Artículos Prohibidos", "y Restringidos"],
    accentLine: 1,
    subtitle: "Para mantener una plataforma segura y legal, los siguientes artículos están prohibidos o tienen restricciones para su publicación.",
    highlights: ["Plataforma segura", "Cumplimiento legal", "Tolerancia cero"],
    lastUpdated: "Marzo 2026",

    quickNav: [
        { icon: Ban, label: "Prohibidos", targetId: "prohibidos" },
        { icon: AlertTriangle, label: "Restringidos", targetId: "restringidos" },
        { icon: Scale, label: "Consecuencias", targetId: "dark-section" },
    ],

    sections: [],  // We use children instead for the custom grid

    darkSection: {
        title: "Consecuencias por Incumplimiento",
        intro: "El incumplimiento tiene consecuencias progresivas para proteger a toda la comunidad.",
        bullets: [
            { bold: "1ª infracción:", text: "Eliminación del anuncio + advertencia formal por email." },
            { bold: "2ª infracción:", text: "Suspensión temporal de la cuenta por 15 días + eliminación de todos los anuncios activos." },
            { bold: "3ª infracción:", text: "Suspensión permanente de la cuenta sin posibilidad de reactivación." },
        ],
    },

    faqs: [
        { q: "¿Puedo publicar alcohol?", a: "Solo si eres un vendedor verificado nivel Oro o superior, y el envío cumple con las restricciones de edad." },
        { q: "¿Las réplicas están permitidas?", a: "No. Cualquier réplica no autorizada o producto con marcas falsificadas está prohibido." },
        { q: "¿Cuándo podrán publicar vehículos e inmuebles?", a: "Estas categorías están en evaluación. Te notificaremos cuando estén disponibles." },
        { q: "¿Tengo dudas sobre si un artículo está permitido?", a: "Consulta con nuestro equipo de soporte antes de publicar. Es mejor preguntar que recibir una sanción." },
    ],

    crossLinks: [
        { icon: FileText, label: "Políticas de Publicación", desc: "Reglas para publicar productos", href: "/politicas-publicacion" },
        { icon: FileText, label: "Términos y Condiciones", desc: "Reglas generales de la plataforma", href: "/terminos" },
        { icon: ShieldCheck, label: "Garantía Subastandolo", desc: "Protección al comprador", href: "/garantia" },
    ],
};

/* ─── Custom grids for prohibited and restricted items ─── */
function ProhibitedGrid() {
    return (
        <section className="py-16 bg-background">
            <div className="container mx-auto px-4 max-w-4xl space-y-16">
                {/* Prohibited */}
                <div id="prohibidos" className="scroll-mt-20 space-y-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-1 rounded-full bg-red-500" />
                            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-red-500">Totalmente Prohibidos</h2>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Los siguientes artículos NO pueden publicarse bajo ninguna circunstancia. Su publicación resultará en la eliminación inmediata y suspensión de la cuenta.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {prohibited.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <div key={i} className="bg-card border border-red-500/20 hover:border-red-500/40 rounded-2xl p-4 flex items-start gap-3 transition-all hover:shadow-md group">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <Icon className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-heading font-bold text-sm text-foreground mb-1">{item.title}</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Restricted */}
                <div id="restringidos" className="scroll-mt-20 space-y-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-1 rounded-full bg-amber-500" />
                            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-amber-600 dark:text-amber-400">Restringidos (Con Condiciones)</h2>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Los siguientes artículos pueden publicarse SOLO si cumplen con las condiciones especificadas.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {restricted.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <div key={i} className="bg-card border border-amber-500/20 hover:border-amber-500/40 rounded-2xl p-4 flex items-start gap-3 transition-all hover:shadow-md group">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-heading font-bold text-sm text-foreground">{item.title}</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                                            <span className="text-amber-600 dark:text-amber-400 font-semibold">Condición:</span> {item.condition}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function ProhibitedItems() {
    return (
        <>
            <SEOHead
                title="Artículos Prohibidos y Restringidos — Subastandolo"
                description="Lista completa de artículos prohibidos y restringidos en Subastandolo. Conoce qué puedes y qué no puedes vender."
            />
            <PolicyPageLayout config={config}>
                <ProhibitedGrid />
            </PolicyPageLayout>
        </>
    );
}
