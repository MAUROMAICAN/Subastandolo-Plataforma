import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { FileText, Clock, ShoppingCart, UserCheck, CreditCard, Shield, Truck, Ban, Scale, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const sections = [
  {
    Icon: UserCheck,
    title: "1. Aceptación",
    content: "Al registrarse en Subastandolo.com, el usuario acepta cumplir con las reglas de la plataforma. La cuenta es personal e intransferible.",
  },
  {
    Icon: Clock,
    title: "2. Dinámica de Subasta",
    content: "Cada subasta tiene un precio base y un tiempo de finalización. Si se recibe una oferta en los últimos 60 segundos, el reloj se extenderá por 2 minutos adicionales para evitar el \"sniping\" y permitir competencia justa.",
  },
  {
    Icon: ShoppingCart,
    title: "3. Obligaciones del Comprador",
    content: "El ganador de una subasta debe reportar su pago en un lapso máximo de 24 a 48 horas. De lo contrario, el artículo podrá ser ofrecido al segundo mejor postor.",
  },
  {
    Icon: Shield,
    title: "4. Protección al Comprador y Gestión de Pagos",
    content: "Para garantizar la seguridad de la comunidad, Subastandolo.com gestiona todos los pagos. El Ganador de la subasta deberá transferir los fondos directamente a las cuentas oficiales de la empresa.",
  },
  {
    Icon: Truck,
    title: "5. Proceso de Liberación de Fondos al Dealer (Vendedor)",
    content: "Garantía de Envío: Una vez recibido el pago, el Dealer tiene la obligación de enviar el producto a la agencia de encomiendas seleccionada.\n\nLiberación por Entrega: Los fondos serán liberados al Dealer una vez que el Cliente retire el producto y se confirme la recepción exitosa.\n\nLiberación Automática: Si el producto permanece en la agencia de envío por más de tres (3) días continuos sin ser retirado por el Cliente, se considerará una entrega completada y el dinero será liberado al Dealer, finalizando la responsabilidad de este último.",
  },
  {
    Icon: Ban,
    title: "6. Restricciones de Categorías",
    content: "Subastandolo.com no gestiona subastas de bienes inmuebles ni vehículos automotores. Consulta la lista completa de artículos prohibidos y restringidos en nuestra página de Artículos Prohibidos.",
  },
  {
    Icon: CreditCard,
    title: "7. Pagos y Comisiones",
    content: "Subastándolo actúa como plataforma de conexión. Los métodos de pago aceptados son transferencia bancaria en bancos nacionales, no se acepta dinero en efectivo. La plataforma no se hace responsable por comisiones bancarias externas.",
  },
  {
    Icon: Scale,
    title: "8. Sistema de Disputas y Resolución de Conflictos",
    content: "Si el comprador tiene un problema con su pedido (producto no recibido, no coincide con la descripción, dañado o incompleto), puede abrir una disputa desde su panel.\n\nPlazo de Respuesta: El vendedor tiene un plazo máximo de tres (3) días calendario para responder a la disputa presentando su versión y evidencia.\n\nResolución Automática: Si el vendedor no responde dentro del plazo, la disputa se resolverá automáticamente a favor del comprador.\n\nMediación Administrativa: Si ambas partes no llegan a un acuerdo, un administrador de Subastandolo mediará el caso y emitirá una resolución final vinculante.\n\nAbuso del Sistema: Las disputas falsas o reiteradas sin fundamento pueden resultar en la suspensión de la cuenta del comprador.",
  },
  {
    Icon: Store,
    title: "9. Marketplace (Tienda de Precio Fijo)",
    content: "Los dealers verificados pueden listar productos a precio fijo en la Tienda. Las publicaciones deben cumplir con las Políticas de Publicación: título máximo de 80 caracteres, precio mínimo de $1.00 USD y máximo de $50,000 USD, y descripción máxima de 3,000 caracteres.\n\nLos artículos prohibidos aplican igualmente para el marketplace. El vendedor es responsable de la veracidad de la descripción y las fotos publicadas.\n\nLa Garantía Subastandolo aplica a todas las compras realizadas en la tienda.",
  },
];

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />

      {/* Hero */}
      <section className="bg-nav py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 70% 30%, hsl(var(--accent)) 0%, transparent 60%), radial-gradient(circle at 20% 80%, hsl(var(--primary)) 0%, transparent 50%)",
          }}
        />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 rounded-full px-4 py-1.5 mb-6">
            <FileText className="h-3.5 w-3.5 text-accent" />
            <span className="text-accent text-xs font-semibold tracking-wider uppercase">Legal</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-heading font-bold text-white mb-4 leading-tight">
            Términos y<br />
            <span className="text-accent">Condiciones de Uso</span>
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            Conoce las reglas que rigen nuestra plataforma y protegen a todos los participantes.
          </p>
        </div>
      </section>

      {/* Last updated */}
      <div className="bg-nav-solid border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center gap-2 text-white/50 text-xs">
          <Clock className="h-3.5 w-3.5" />
          <span>Última actualización: Marzo 2026</span>
        </div>
      </div>

      {/* Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-6">
            {sections.map(({ Icon, title, content }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-7 hover:shadow-lg transition-shadow group">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-lg text-foreground mb-2">{title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed text-justify whitespace-pre-line">{content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mt-12 bg-secondary/20 border border-border rounded-2xl p-7 text-center text-justify">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Subastándolo se reserva el derecho de modificar estos términos en cualquier momento.
              Los cambios serán notificados a través de la plataforma y entrarán en vigencia
              inmediatamente después de su publicación.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-nav py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-4">
            ¿Tienes alguna duda?
          </h2>
          <p className="text-white/70 mb-8 max-w-md mx-auto">
            Nuestro equipo está disponible para resolver cualquier inquietud sobre nuestros términos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
              <Link to="/contacto">Contáctanos</Link>
            </Button>
            <Button size="lg" asChild className="bg-white/10 border border-white/30 text-white hover:bg-white/20 rounded-sm">
              <Link to="/privacidad">Política de Privacidad</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsPage;
