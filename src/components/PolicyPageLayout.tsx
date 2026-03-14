import { useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { ChevronDown, Clock, ArrowRight } from "lucide-react";

/* ─── Types ─── */
export interface QuickNavItem {
    icon: ElementType;
    label: string;
    targetId: string;
}

export interface SectionBullet {
    bold: string;
    text: string;
}

export interface PolicySection {
    id: string;
    accentColor?: string;          // tailwind color token, e.g. "green-500"
    title: string;
    intro?: string;
    bullets: SectionBullet[];
    cta?: { label: string; href: string };
}

export interface FAQ {
    q: string;
    a: string;
}

export interface CrossLink {
    label: string;
    desc: string;
    href: string;
    icon: ElementType;
}

export interface PolicyPageConfig {
    badge: { icon: ElementType; label: string };
    titleLines: string[];
    accentLine?: number;           // index of the line to accent-color
    subtitle: string;
    highlights?: string[];
    lastUpdated: string;
    quickNav: QuickNavItem[];
    sections: PolicySection[];
    darkSection?: {
        title: string;
        intro?: string;
        bullets: SectionBullet[];
        cta?: { label: string; href: string };
    };
    faqs?: FAQ[];
    crossLinks: CrossLink[];
}

/* ─── FAQ Accordion Item ─── */
function FAQItem({ faq }: { faq: FAQ }) {
    const [open, setOpen] = useState(false);
    return (
        <button
            className="w-full text-left border-b border-border/50 last:border-0"
            onClick={() => setOpen(!open)}
        >
            <div className="flex items-center justify-between py-4 px-1 gap-4">
                <p className="text-sm font-semibold text-foreground leading-snug">{faq.q}</p>
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-40 pb-4" : "max-h-0"}`}>
                <p className="text-sm text-muted-foreground leading-relaxed px-1">{faq.a}</p>
            </div>
        </button>
    );
}

/* ─── Smooth scroll helper ─── */
function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─── Main Layout ─── */
export default function PolicyPageLayout({ config, children }: { config: PolicyPageConfig; children?: React.ReactNode }) {
    const { badge, titleLines, accentLine = 1, subtitle, highlights, lastUpdated, quickNav, sections, darkSection, faqs, crossLinks } = config;
    const BadgeIcon = badge.icon;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />
            <BackButton />

            {/* ═══ HERO ═══ */}
            <section className="bg-nav py-20 sm:py-28 relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage:
                            "radial-gradient(circle at 70% 30%, hsl(var(--accent)) 0%, transparent 60%), radial-gradient(circle at 20% 80%, hsl(var(--primary)) 0%, transparent 50%)",
                    }}
                />
                <div className="container mx-auto px-4 relative z-10 max-w-4xl">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">
                        <div className="flex-1 text-center lg:text-left">
                            {/* Badge pill */}
                            <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 rounded-full px-4 py-1.5 mb-6">
                                <BadgeIcon className="h-3.5 w-3.5 text-accent" />
                                <span className="text-accent text-xs font-semibold tracking-wider uppercase">{badge.label}</span>
                            </div>

                            {/* Title */}
                            <h1 className="text-4xl sm:text-5xl font-heading font-bold text-white mb-5 leading-tight">
                                {titleLines.map((line, i) => (
                                    <span key={i}>
                                        {i === accentLine ? <span className="text-accent">{line}</span> : line}
                                        {i < titleLines.length - 1 && <br />}
                                    </span>
                                ))}
                            </h1>

                            {/* Subtitle */}
                            <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mb-6">
                                {subtitle}
                            </p>

                            {/* Highlight checkmarks */}
                            {highlights && highlights.length > 0 && (
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 justify-center lg:justify-start">
                                    {highlights.map((h, i) => (
                                        <div key={i} className="flex items-center gap-2 text-white/90 text-sm">
                                            <svg className="h-4 w-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            {h}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Last updated bar */}
            <div className="bg-nav-solid border-b border-white/10">
                <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-2 text-white/50 text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Última actualización: {lastUpdated}</span>
                </div>
            </div>

            {/* ═══ QUICK-NAV CARDS ═══ */}
            <section className="py-12 bg-secondary/20">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className={`grid gap-4 ${quickNav.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
                        {quickNav.map((nav) => {
                            const NavIcon = nav.icon;
                            return (
                                <button
                                    key={nav.targetId}
                                    onClick={() => scrollToId(nav.targetId)}
                                    className="group bg-card border border-border rounded-2xl p-5 flex flex-col items-center text-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <NavIcon className="h-7 w-7 text-accent" />
                                    </div>
                                    <span className="text-sm font-bold text-foreground leading-tight">{nav.label}</span>
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ═══ ZIG-ZAG SECTIONS ═══ */}
            <section className="py-16 space-y-0">
                {sections.map((sec, idx) => {
                    const isEven = idx % 2 === 0;
                    const accentColor = sec.accentColor || "accent";
                    return (
                        <div
                            key={sec.id}
                            id={sec.id}
                            className={`scroll-mt-20 ${isEven ? "bg-background" : "bg-secondary/10"}`}
                        >
                            <div className="container mx-auto px-4 max-w-4xl py-14">
                                <div className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"} gap-10 lg:gap-16 items-start`}>
                                    {/* Icon side */}
                                    <div className="lg:w-1/5 flex justify-center lg:justify-start shrink-0">
                                        <div className={`w-20 h-20 rounded-3xl bg-${accentColor}/10 flex items-center justify-center`}>
                                            {quickNav[idx] && (() => {
                                                const Icon = quickNav[idx].icon;
                                                return <Icon className={`h-10 w-10 text-${accentColor}`} />;
                                            })()}
                                        </div>
                                    </div>

                                    {/* Content side */}
                                    <div className="flex-1 space-y-5">
                                        {/* Accent bar */}
                                        <div className={`w-10 h-1 rounded-full bg-${accentColor}`} />

                                        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground leading-tight">
                                            {sec.title}
                                        </h2>

                                        {sec.intro && (
                                            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{sec.intro}</p>
                                        )}

                                        <div className="space-y-4">
                                            {sec.bullets.map((b, bi) => (
                                                <div key={bi} className="flex items-start gap-3">
                                                    <svg className={`h-5 w-5 text-${accentColor} shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                    <div>
                                                        <p className="text-sm text-foreground leading-relaxed">
                                                            <strong>{b.bold}</strong>{" "}
                                                            {b.text}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {sec.cta && (
                                            <div className="flex items-center gap-4 pt-2">
                                                <Link
                                                    to={sec.cta.href}
                                                    className="inline-flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
                                                >
                                                    {sec.cta.label}
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* ═══ CHILDREN (custom content like ProhibitedItems grid) ═══ */}
            {children}

            {/* ═══ DARK CONTRAST SECTION ═══ */}
            {darkSection && (
                <section id="dark-section" className="scroll-mt-20 bg-nav py-16 sm:py-20 relative overflow-hidden">
                    <div
                        className="absolute inset-0 opacity-5"
                        style={{
                            backgroundImage: "radial-gradient(circle at 30% 50%, hsl(var(--accent)) 0%, transparent 60%)",
                        }}
                    />
                    <div className="container mx-auto px-4 max-w-4xl relative z-10">
                        <div className="w-10 h-1 rounded-full bg-accent mb-6" />
                        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-4 leading-tight">
                            {darkSection.title}
                        </h2>
                        {darkSection.intro && (
                            <p className="text-white/70 mb-6 max-w-2xl leading-relaxed">{darkSection.intro}</p>
                        )}
                        <div className="space-y-4 mb-8">
                            {darkSection.bullets.map((b, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <svg className="h-5 w-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    <p className="text-white/90 text-sm leading-relaxed">
                                        <strong className="text-white">{b.bold}</strong>{" "}{b.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                        {darkSection.cta && (
                            <Link
                                to={darkSection.cta.href}
                                className="inline-flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
                            >
                                {darkSection.cta.label}
                            </Link>
                        )}
                    </div>
                </section>
            )}

            {/* ═══ FAQ ACCORDIONS ═══ */}
            {faqs && faqs.length > 0 && (
                <section className="py-16 bg-secondary/10">
                    <div className="container mx-auto px-4 max-w-3xl">
                        <div className="text-center mb-10">
                            <div className="w-10 h-1 rounded-full bg-accent mx-auto mb-4" />
                            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
                                Preguntas Frecuentes
                            </h2>
                        </div>
                        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y-0">
                            {faqs.map((faq, i) => (
                                <FAQItem key={i} faq={faq} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ CROSS-LINKS ═══ */}
            {crossLinks.length > 0 && (
                <section className="py-16 bg-background">
                    <div className="container mx-auto px-4 max-w-4xl">
                        <div className="text-center mb-10">
                            <div className="w-10 h-1 rounded-full bg-accent mx-auto mb-4" />
                            <h2 className="text-2xl font-heading font-bold text-foreground">
                                Documentos Relacionados
                            </h2>
                        </div>
                        <div className={`grid gap-4 ${crossLinks.length === 3 ? "grid-cols-1 sm:grid-cols-3" : crossLinks.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                            {crossLinks.map((link) => {
                                const LinkIcon = link.icon;
                                return (
                                    <Link
                                        key={link.href}
                                        to={link.href}
                                        className="group bg-card border border-border rounded-2xl p-6 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col items-center gap-3"
                                    >
                                        <LinkIcon className="h-6 w-6 text-muted-foreground group-hover:text-accent transition-colors" />
                                        <h3 className="font-heading font-bold text-sm text-foreground">{link.label}</h3>
                                        <p className="text-xs text-muted-foreground leading-snug">{link.desc}</p>
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                                            Consultar <ArrowRight className="h-3 w-3" />
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            <Footer />
        </div>
    );
}
