import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Ban, Shield, AlertTriangle, Pill, Flame, Skull, FileWarning,
  Wine, Sparkles, Zap, Car, Leaf, Eye, Lock, Scale
} from "lucide-react";

const prohibited = [
  {
    title: "Drogas y Estupefacientes",
    icon: Skull,
    description: "Cualquier tipo de droga ilegal, sustancia psicotrópica, precursores químicos, o utensilios para su producción o consumo.",
  },
  {
    title: "Armas de Fuego y Municiones",
    icon: Ban,
    description: "Armas de fuego, municiones, explosivos, armas de guerra. Incluye réplicas funcionales y kits de conversión.",
  },
  {
    title: "Productos Falsificados",
    icon: Shield,
    description: "Réplicas no autorizadas, imitaciones, productos con marcas falsificadas o que infrinjan derechos de propiedad intelectual.",
  },
  {
    title: "Documentos Legales y Personales",
    icon: FileWarning,
    description: "Cédulas, pasaportes, licencias de conducir, títulos universitarios, certificados oficiales, bases de datos personales.",
  },
  {
    title: "Divisas y Criptomonedas",
    icon: Scale,
    description: "Compra/venta de monedas extranjeras, servicios de cambio, criptomonedas o cualquier instrumento financiero.",
  },
  {
    title: "Bienes del Estado Venezolano",
    icon: Ban,
    description: "Laptops Canaima, teléfonos Vtelca/Orinoquia, vehículos Venirauto, inmuebles adjudicados por el Estado u organismos públicos.",
  },
  {
    title: "Órganos y Partes Humanas",
    icon: Skull,
    description: "Venta de personas, cuerpos, órganos, miembros o residuos humanos. Excepción: pelucas de cabello humano.",
  },
  {
    title: "Software Pirata y Cuentas Digitales",
    icon: Lock,
    description: "Software sin licencia, cracks, seriales, cuentas de streaming/gaming robadas, herramientas de hacking.",
  },
  {
    title: "Material de Odio o Terrorismo",
    icon: Flame,
    description: "Material que promueva violencia, discriminación, odio racial, terrorismo o pornografía infantil.",
  },
  {
    title: "Productos de Vigilancia Ilegal",
    icon: Eye,
    description: "Decodificadores de señal, jammers, dispositivos de escucha clandestina, software espía.",
  },
  {
    title: "Flora y Fauna Protegida",
    icon: Leaf,
    description: "Animales en peligro de extinción, especies protegidas, plantas en riesgo, marfil, pieles no autorizadas.",
  },
  {
    title: "Vehículos e Inmuebles",
    icon: Car,
    description: "Por el momento, no se permiten publicaciones de vehículos automotores (carros, motos) ni bienes inmuebles.",
  },
];

const restricted = [
  {
    title: "Alcohol",
    icon: Wine,
    condition: "Solo vendedores verificados nivel Oro o superior. Envío con restricción de edad.",
  },
  {
    title: "Perfumes y Cosméticos",
    icon: Sparkles,
    condition: "Deben estar sellados en su empaque original, con número de lote y fecha de vencimiento visible.",
  },
  {
    title: "Suplementos Alimenticios",
    icon: Pill,
    condition: "Con registro sanitario válido y etiquetado completo según normativa venezolana.",
  },
  {
    title: "Electrodomésticos de Alto Voltaje",
    icon: Zap,
    condition: "Especificar voltaje (110V/220V), incluir datos de garantía cuando aplique.",
  },
  {
    title: "Cuchillos y Herramientas Cortantes",
    icon: Ban,
    condition: "Solo de uso doméstico, industrial o agrícola. Prohibidas armas blancas decorativas o de colección.",
  },
  {
    title: "Baterías de Litio",
    icon: AlertTriangle,
    condition: "Deben cumplir con restricciones de envío. Indicar capacidad (mAh/Wh) en la descripción.",
  },
];

export default function ProhibitedItems() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Artículos Prohibidos y Restringidos — Subastandolo"
        description="Lista completa de artículos prohibidos y restringidos en Subastandolo. Conoce qué puedes y qué no puedes vender en nuestra plataforma."
      />
      <Navbar />
      <BackButton />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mb-2">
            <Ban className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-3xl font-heading font-bold">Artículos Prohibidos y Restringidos</h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Para mantener una plataforma segura y legal, los siguientes artículos están prohibidos o restringidos
            en Subastandolo. El incumplimiento resultará en la eliminación del anuncio y posible suspensión de la cuenta.
          </p>
        </div>

        {/* Prohibited Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 rounded-full bg-destructive" />
            <h2 className="text-xl font-heading font-bold text-destructive">Totalmente Prohibidos</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Los siguientes artículos NO pueden publicarse bajo ninguna circunstancia. Su publicación resultará en la
            eliminación inmediata del anuncio y suspensión de la cuenta.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prohibited.map((item, i) => (
              <Card key={i} className="border border-destructive/20 hover:border-destructive/40 transition-colors">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="h-4.5 w-4.5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading font-bold text-sm text-foreground mb-0.5">{item.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Restricted Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-8 rounded-full bg-amber-500" />
            <h2 className="text-xl font-heading font-bold text-amber-600 dark:text-amber-400">Restringidos (Con Condiciones)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Los siguientes artículos pueden publicarse SOLO si cumplen con las condiciones especificadas.
            El incumplimiento resultará en la eliminación del anuncio.
          </p>
          <div className="space-y-3">
            {restricted.map((item, i) => (
              <Card key={i} className="border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading font-bold text-sm text-foreground">{item.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">Condición:</span> {item.condition}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Consequences */}
        <Card className="border border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Consecuencias por Incumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-destructive font-bold shrink-0">1ª vez:</span>
              <span>Eliminación del anuncio + advertencia formal por email.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-destructive font-bold shrink-0">2ª vez:</span>
              <span>Suspensión temporal de la cuenta por 15 días + eliminación de todos los anuncios activos.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-destructive font-bold shrink-0">3ª vez:</span>
              <span>Suspensión permanente de la cuenta sin posibilidad de reactivación.</span>
            </div>
          </CardContent>
        </Card>

        {/* Note */}
        <div className="text-center text-xs text-muted-foreground pb-8 space-y-1">
          <p>Subastandolo se reserva el derecho de actualizar esta lista en cualquier momento.</p>
          <p>Si tienes dudas sobre si un artículo está permitido, consulta con nuestro equipo de soporte antes de publicar.</p>
          <p className="mt-2">Última actualización: Marzo 2026</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
