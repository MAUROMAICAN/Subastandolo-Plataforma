import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldCheck, Package, AlertTriangle, Clock, MessageSquare,
  CheckCircle2, XCircle, HelpCircle, ArrowRight, Gavel
} from "lucide-react";

const coverages = [
  {
    icon: Package,
    title: "Producto no recibido",
    description: "Si tu producto no llega dentro de los 15 días posteriores al envío, recibirás un reembolso completo.",
    deadline: "15 días post-envío",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: AlertTriangle,
    title: "No coincide con la descripción",
    description: "Si el producto recibido es significativamente distinto a lo descrito o mostrado en las fotos, puedes solicitar devolución y reembolso.",
    deadline: "7 días post-recepción",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: XCircle,
    title: "Producto dañado o defectuoso",
    description: "Si tu producto llega roto, dañado o con defectos no indicados en la publicación, cubrimos tu devolución.",
    deadline: "7 días post-recepción",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    icon: HelpCircle,
    title: "Producto incompleto",
    description: "Si faltan piezas, accesorios o componentes que fueron listados en la publicación, puedes reclamar un reembolso parcial o total.",
    deadline: "7 días post-recepción",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

const processSteps = [
  {
    step: 1,
    title: "Abre una disputa",
    description: "Desde \"Mis Compras\" en tu panel de comprador, selecciona el pedido y haz clic en \"Tengo un problema\".",
  },
  {
    step: 2,
    title: "El vendedor responde",
    description: "El vendedor tiene 3 días para responder con una propuesta de solución (reembolso, reenvío, etc.).",
  },
  {
    step: 3,
    title: "Resolución automática o mediación",
    description: "Si el vendedor no responde en 3 días, la disputa se resuelve automáticamente a tu favor. Si hay desacuerdo, Subastandolo media como árbitro.",
  },
  {
    step: 4,
    title: "Reembolso",
    description: "Una vez resuelta la disputa, el reembolso se procesa en 24-48 horas por el mismo método de pago utilizado.",
  },
];

const faqs = [
  {
    q: "¿Todos los productos están cubiertos?",
    a: "Sí, todos los productos comprados a través de Subastandolo están cubiertos por la Garantía, tanto de la tienda como de subastas.",
  },
  {
    q: "¿Puedo abrir una disputa por arrepentimiento?",
    a: "No. La Garantía Subastandolo cubre problemas con el producto (no recibido, dañado, diferente). Para devoluciones por arrepentimiento, aplica la política de devoluciones del vendedor.",
  },
  {
    q: "¿Qué pasa con los productos usados?",
    a: "Los productos usados están cubiertos siempre que no coincidan con la descripción del vendedor. Si el vendedor describió correctamente el estado, la compra no es disputarle.",
  },
  {
    q: "¿Cuánto tarda el reembolso?",
    a: "Una vez aprobada la disputa, el reembolso se procesa en 24-48 horas. El tiempo de acreditación depende del método de pago.",
  },
  {
    q: "¿Qué pasa si abuso del sistema de disputas?",
    a: "Las disputas falsas o reiteradas sin fundamento pueden resultar en la suspensión de tu cuenta. La Garantía está para proteger compradores legítimos.",
  },
];

export default function BuyerGuarantee() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Garantía Subastandolo — Tu compra está protegida"
        description="Programa de protección al comprador de Subastandolo. Si tu producto no llega, no coincide o llega dañado, te devolvemos tu dinero."
      />
      <Navbar />
      <BackButton />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-2">
            <ShieldCheck className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-black">
            Garantía <span className="text-green-500">Subastandolo</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Tu compra está protegida. Si algo sale mal, <strong className="text-foreground">te devolvemos tu dinero</strong>.
          </p>
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-5 py-2 text-sm font-bold text-green-600 dark:text-green-400">
            <ShieldCheck className="h-4 w-4" />
            100% de las compras protegidas
          </div>
        </div>

        {/* Coverages */}
        <div className="space-y-4">
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            ¿Qué cubre la Garantía?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {coverages.map((c, i) => (
              <Card key={i} className="border hover:shadow-md transition-all duration-200">
                <CardContent className="p-5 space-y-3">
                  <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                    <c.icon className={`h-5 w-5 ${c.color}`} />
                  </div>
                  <h3 className="font-heading font-bold text-sm">{c.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Plazo:</span>
                    <span className={c.color}>{c.deadline}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Process */}
        <div className="space-y-4">
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            ¿Cómo funciona?
          </h2>
          <div className="space-y-3">
            {processSteps.map((s, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-heading font-black text-sm">
                    {s.step}
                  </div>
                  {i < processSteps.length - 1 && (
                    <div className="w-0.5 h-8 bg-border group-hover:bg-primary/30 transition-colors" />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <h4 className="font-heading font-bold text-sm text-foreground">{s.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* For Sellers */}
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Gavel className="h-5 w-5" />
              Para Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>La Garantía Subastandolo te protege también a ti:</p>
            <ul className="space-y-1.5 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Si el comprador confirma la recepción, el pago se libera automáticamente.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Las disputas falsas o abusivas resultan en sanciones para el comprador.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Siempre tienes 3 días para responder antes de cualquier resolución automática.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Fotos y descripciones precisas te protegen ante disputas infundadas.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div className="space-y-4">
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            Preguntas Frecuentes
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Card key={i} className="border">
                <CardContent className="p-4">
                  <h4 className="font-heading font-bold text-sm text-foreground flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                    {faq.q}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 ml-5.5 pl-1">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground pb-8">
          <p>Última actualización: Marzo 2026</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
