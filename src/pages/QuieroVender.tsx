import { Link } from "react-router-dom";
import { CheckCircle2, ShieldCheck, Zap, TrendingUp, Handshake, ChevronRight, Store } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";

const QuieroVender = () => {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <SEO
                title="Quiero Vender - Subastandolo"
                description="Conviértete en Dealer Verificado en Subastandolo. Sube tus productos, llega a miles de compradores y maximiza tus ventas de forma segura."
            />
            <Navbar />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative overflow-hidden bg-primary pt-24 pb-32">
                    <div className="absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-primary/90 mix-blend-multiply" />
                        {/* Soft decorative blur circles */}
                        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px] mix-blend-highlight" />
                        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-[#244299]/40 rounded-full blur-[100px] mix-blend-highlight" />
                    </div>

                    <div className="container relative z-10 mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center gap-12">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 bg-accent/15 border border-accent/30 text-accent text-xs font-bold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase shadow-sm">
                                <Store className="h-4 w-4" /> Programa de Dealers 2026
                            </div>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-black text-white leading-[1.1] mb-6 drop-shadow-sm">
                                Tu inventario merece el <span className="text-accent">mejor postor.</span>
                            </h1>
                            <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto lg:mx-0 mb-8 leading-relaxed font-light">
                                Únete como <strong className="font-semibold text-white">Dealer Verificado</strong> a la plataforma líder de subastas en Venezuela. Vende más rápido, más seguro y a miles de usuarios activos que pujan a diario.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                                <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 h-14 px-8 text-base font-bold rounded-full shadow-[0_0_20px_rgba(181,251,5,0.3)] w-full sm:w-auto">
                                    <Link to="/auth">
                                        Regístrate Ahora <ChevronRight className="ml-2 h-5 w-5" />
                                    </Link>
                                </Button>
                                <Button size="lg" variant="outline" asChild className="h-14 px-8 text-base font-bold rounded-full border-white/20 text-white hover:bg-white/10 w-full sm:w-auto mt-2 sm:mt-0">
                                    <a href="#beneficios">Conoce los beneficios</a>
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 w-full max-w-lg lg:max-w-xl mx-auto drop-shadow-2xl">
                            {/* Optional UI Mockup or stylized graphic */}
                            <div className="bg-card/5 border border-white/10 rounded-2xl p-2 backdrop-blur-sm shadow-2xl relative">
                                <div className="absolute -top-4 -right-4 bg-accent text-accent-foreground font-black text-sm px-4 py-2 rounded-xl shadow-xl transform rotate-3">
                                    +300% en alcance
                                </div>
                                <img
                                    src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=800"
                                    alt="Ventas Exitosas"
                                    className="rounded-xl object-cover w-full h-[300px] sm:h-[400px]"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Benefits Section */}
                <section id="beneficios" className="py-20 bg-background relative z-10 -mt-10 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                    <div className="container mx-auto px-4 sm:px-6">
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <h2 className="text-3xl sm:text-4xl font-heading font-black text-foreground mb-4">¿Por qué vender con nosotros?</h2>
                            <p className="text-muted-foreground text-lg">Subastandolo te ofrece las herramientas y el respaldo para que escalar tu negocio sea simple y seguro.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                {
                                    icon: TrendingUp,
                                    title: "Líquidez Inmediata",
                                    desc: "Las subastas impulsan la toma de decisión rápida. Convierte tu inventario estancado en flujo de caja en solo días."
                                },
                                {
                                    icon: ShieldCheck,
                                    title: "Seguridad Anti-Fraude",
                                    desc: "Verificamos la identidad de cada postor y respaldamos cada pago para garantizar que nunca pierdas tu inversión."
                                },
                                {
                                    icon: Zap,
                                    title: "Ventas Dinámicas",
                                    desc: "Sin comisiones ocultas ni regateos largos. Tú pones el precio inicial, y la comunidad se encarga de subir el valor."
                                },
                                {
                                    icon: Handshake,
                                    title: "Soporte Dedicado",
                                    desc: "Nuestro equipo administrativo te acompaña desde la creación de tu primera subasta hasta el cierre del trato final."
                                }
                            ].map((benefit, i) => (
                                <div key={i} className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                                        <benefit.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="font-heading font-bold text-xl mb-3">{benefit.title}</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">{benefit.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Step-by-Step Section */}
                <section className="py-24 bg-secondary/30 border-y border-border">
                    <div className="container mx-auto px-4 sm:px-6">
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <h2 className="text-3xl sm:text-4xl font-heading font-black text-foreground mb-4">Cómo funciona el Programa</h2>
                            <p className="text-muted-foreground text-lg">En tan solo 3 pasos, tu mercancía estará lista para recibir ofertas.</p>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-8 relative">
                            {/* Connecting line for desktop */}
                            <div className="hidden lg:block absolute top-[40px] left-[15%] right-[15%] h-0.5 bg-border z-0" />

                            {[
                                {
                                    step: "01",
                                    title: "Crea tu Cuenta",
                                    desc: "Regístrate en la plataforma y completa el formulario de verificación de Dealer con tu información comercial."
                                },
                                {
                                    step: "02",
                                    title: "Sube tu Producto",
                                    desc: "Toma buenas fotos, escribe una descripción clara, establece tu precio inicial y el tiempo de duración de la subasta."
                                },
                                {
                                    step: "03",
                                    title: "¡Recibe Ofertas!",
                                    desc: "Los usuarios comienzan a pujar. Cuando termine el tiempo, contacta al mejor postor y coordina la entrega o envío."
                                }
                            ].map((item, i) => (
                                <div key={i} className="flex-1 relative z-10 flex flex-col items-center text-center">
                                    <div className="w-20 h-20 bg-card border-4 border-background shadow-lg rounded-full flex items-center justify-center text-xl font-black text-primary mb-6">
                                        {item.step}
                                    </div>
                                    <h3 className="font-heading font-bold text-xl mb-3">{item.title}</h3>
                                    <p className="text-muted-foreground text-sm px-4">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Requirements / FAQ snippet */}
                <section className="py-20 bg-background">
                    <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 sm:p-12 mb-10">
                            <h3 className="font-heading font-bold text-2xl text-foreground mb-6 flex items-center gap-3">
                                <CheckCircle2 className="h-6 w-6 text-primary" /> ¿Qué necesito para empezar?
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                                    <p className="text-foreground text-base">Tener un registro fotográfico legal (RIF o Cédula vigente) para la verificación de identidad anti-fraude corporativa.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                                    <p className="text-foreground text-base">Proporcionar imágenes reales, nítidas y detalladas de los productos que deseas subastar.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                                    <p className="text-foreground text-base">Comprometerse con nuestras políticas de entregas y transparencia financiera dentro de la comunidad de Subastandolo.</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-24 bg-card text-center relative overflow-hidden">
                    <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                    <div className="container relative z-10 mx-auto px-4 max-w-3xl">
                        <h2 className="text-3xl sm:text-5xl font-heading font-black text-foreground mb-6 leading-tight">
                            Abre tu nuevo canal de ventas de forma masiva
                        </h2>
                        <p className="text-muted-foreground text-lg sm:text-xl mb-10">
                            Acepta el modelo 2026 del e-commerce. Más rapidez, mejor liquidez, y un sistema en el que dictas las reglas.
                        </p>
                        <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-10 text-lg font-bold rounded-full shadow-lg">
                            <Link to="/auth">
                                Comenzar Inscripción de Dealer
                            </Link>
                        </Button>
                    </div>
                </section>
            </main>

            <Footer />
            <BottomNav />
        </div>
    );
};

export default QuieroVender;
