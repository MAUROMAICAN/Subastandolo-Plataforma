import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ImageOff, FileText, MessageSquareOff, Ban,
  Camera, Sparkles, ShieldAlert, AlertTriangle
} from "lucide-react";

const sections = [
  {
    title: "1. Reglas de las Imágenes (Calidad y Privacidad)",
    icon: Camera,
    intro: "La imagen es el contrato visual con el comprador. Debe ser impecable:",
    items: [
      {
        icon: ImageOff,
        label: "Prohibición de Datos de Contacto",
        text: "Las fotos no pueden contener banners, logos, números de teléfono, direcciones físicas, redes sociales o códigos QR. Cualquier intento de evasión de la plataforma resultará en la suspensión de la cuenta.",
      },
      {
        icon: Camera,
        label: "Fondo y Claridad",
        text: "Se exige que el producto sea el protagonista. Las fotos deben tener buena iluminación y claridad.",
      },
      {
        icon: Sparkles,
        label: "Uso de IA y Edición",
        text: "Está permitido (y recomendado) el uso de herramientas de IA para eliminar fondos ruidosos o de mala calidad y sustituirlos por fondos de colores planos o neutros (blanco, gris claro).",
      },
      {
        icon: ShieldAlert,
        label: "Integridad del Producto",
        text: "Queda estrictamente prohibido usar filtros o ediciones que oculten daños, rayones o defectos reales del producto. La imagen debe ser una representación fiel del estado actual del artículo.",
      },
    ],
  },
  {
    title: "2. Descripción y Veracidad",
    icon: FileText,
    items: [
      {
        icon: FileText,
        label: "Honestidad Total",
        text: "El vendedor debe describir de forma detallada el estado del producto (Nuevo, Como Nuevo, Usado, Para Repuestos).",
      },
      {
        icon: AlertTriangle,
        label: "Sanción por Disputas",
        text: "Si el comprador inicia una disputa y se demuestra que el producto recibido no coincide con las fotos o la descripción (ej. se ocultó un golpe mediante edición), el Dealer perderá la disputa automáticamente, se le devolverá el dinero al cliente y el Dealer deberá asumir los costos de retorno.",
      },
    ],
  },
  {
    title: "3. Comunicación Blindada",
    icon: MessageSquareOff,
    items: [
      {
        icon: MessageSquareOff,
        label: "Cero Contacto Externo",
        text: "No se permite incluir datos de contacto en el título, descripción o sección de preguntas. Toda duda debe resolverse a través del sistema de mensajería oficial de Subastandolo.com.",
      },
      {
        icon: Ban,
        label: "Seguridad de la Transacción",
        text: 'Cualquier Dealer que invite a un comprador a "cerrar el trato por fuera" para evitar la comisión de la plataforma, será expulsado permanentemente.',
      },
    ],
  },
  {
    title: "4. Categorías Prohibidas (Por ahora)",
    icon: Ban,
    items: [
      {
        icon: Ban,
        label: "",
        text: "No se permite la publicación de Vehículos Automotores (carros, camionetas, camiones).",
      },
      {
        icon: Ban,
        label: "",
        text: "No se permite la publicación de Bienes Inmuebles (casas, apartamentos, terrenos).",
      },
      {
        icon: Ban,
        label: "",
        text: "No se permite la venta de artículos ilegales, réplicas no autorizadas o productos que infrinjan derechos de autor.",
      },
    ],
  },
];

const PublicationPolicies = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-heading font-bold">Políticas de Publicación de Avisos</h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto text-justify">
            Para garantizar una experiencia segura y profesional, todos los productos publicados en Subastandolo.com
            deben cumplir con las siguientes normas. Los anuncios que no cumplan con estos requisitos serán rechazados o eliminados.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, idx) => (
            <Card key={idx} className="border border-border rounded-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading font-bold flex items-center gap-2.5">
                  <section.icon className="h-5 w-5 text-primary shrink-0" />
                  {section.title}
                </CardTitle>
                {section.intro && (
                  <p className="text-sm text-muted-foreground mt-1">{section.intro}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      {item.label && (
                        <h4 className="font-heading font-bold text-sm text-foreground mb-0.5">{item.label}</h4>
                      )}
                      <p className="text-sm text-muted-foreground leading-relaxed text-justify">{item.text}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Warning */}
        <Card className="border border-destructive/30 bg-destructive/5 rounded-sm">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground text-justify">
              <strong className="text-foreground">Importante:</strong> El incumplimiento reiterado de estas políticas
              puede resultar en la suspensión temporal o permanente de tu cuenta como Dealer en Subastandolo.com.
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pb-8">
          <p>Última actualización: Febrero 2026</p>
        </div>
      </main>
    </div>
  );
};

export default PublicationPolicies;
